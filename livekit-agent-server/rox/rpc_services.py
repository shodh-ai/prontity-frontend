import logging
import json
import base64
import uuid
import time
import asyncio
from livekit.rtc.rpc import RpcInvocationData # For RPC invocation data
from generated.protos import interaction_pb2 # Your generated protobuf types

logger = logging.getLogger(__name__)

class AgentInteractionService: # Simple class without inheritance
    def __init__(self, agent_instance=None):
        # No base class, so no super().__init__() needed
        self.agent_instance = agent_instance
        logger.info("!!!!!! DEBUG: AgentInteractionService initialized. !!!!!")

    async def HandleFrontendButton(self, invocation_data: RpcInvocationData) -> str:
        print("!!!!!! DEBUG: HandleFrontendButton ENTERED (once) !!!!!!")
        logger.info("!!!!!! DEBUG: HandleFrontendButton ENTERED VIA LOGGER (once) !!!!!!")

        # Deserialize the request from invocation_data.payload
        request = interaction_pb2.FrontendButtonClickRequest()
        # The payload is a base64-encoded string from the LiveKit client
        # We need to decode it first before parsing
        try:
            if isinstance(invocation_data.payload, str):
                logger.info(f"RPC HandleFrontendButton: Payload is a string, assuming base64 encoded. Length: {len(invocation_data.payload)}")
                try:
                    decoded_bytes = base64.b64decode(invocation_data.payload)
                    logger.info(f"Base64 decoded payload. Length: {len(decoded_bytes)}")
                    payload_bytes = decoded_bytes
                except Exception as e:
                    logger.error(f"Failed to decode base64 payload: {e}")
                    payload_bytes = invocation_data.payload.encode('utf-8')
                    logger.info(f"Using raw UTF-8 encoded payload. Length: {len(payload_bytes)}")
            elif isinstance(invocation_data.payload, bytes):
                logger.info(f"RPC HandleFrontendButton: Payload is already bytes. Length: {len(invocation_data.payload)}")
                payload_bytes = invocation_data.payload
            else:
                logger.error(f"RPC HandleFrontendButton: Cannot handle payload type {type(invocation_data.payload)}")
                error_response = interaction_pb2.AgentResponse(status_message=f"Error: Unhandled payload type {type(invocation_data.payload)}", data_payload="")
                serialized_error = error_response.SerializeToString()
                return base64.b64encode(serialized_error).decode('utf-8')
            
            logger.info(f"Attempting to parse protobuf message from payload. First 100 bytes: {payload_bytes[:100]}")
            request.ParseFromString(payload_bytes)
            logger.info(f"Successfully parsed FrontendButtonClickRequest: button_id={request.button_id}, custom_data={request.custom_data}")
        except Exception as e:
            logger.error(f"RPC HandleFrontendButton: Failed to parse payload into FrontendButtonClickRequest: {e}", exc_info=True)
            logger.error(f"Received payload (first 100 bytes): {payload_bytes[:100] if 'payload_bytes' in locals() else 'unknown'}")
            error_response = interaction_pb2.AgentResponse(
                status_message=f"Error processing request: {str(e)}",
                data_payload="Parse error"
            )
            serialized_error = error_response.SerializeToString()
            return base64.b64encode(serialized_error).decode('utf-8')

        logger.info(f"RPC: HandleFrontendButton called by participant: {invocation_data.caller_identity}")
        logger.info(f"RPC: Request button_id='{request.button_id}', custom_data='{request.custom_data}'")

        # Process custom_data if present and agent_instance exists
        if self.agent_instance and request.custom_data:
            try:
                # Log the raw custom_data for debugging
                logger.info(f"RPC: Raw custom_data received: {request.custom_data}")
                
                # Check if it looks like JSON (starts with { or [)
                if (request.custom_data.strip().startswith('{') or request.custom_data.strip().startswith('[')):
                    try:
                        # Try to parse as JSON
                        parsed_custom_data = json.loads(request.custom_data)
                        logger.info(f"RPC: Successfully parsed custom_data as JSON: {parsed_custom_data}")
                        
                        # Handle structured JSON data
                        if isinstance(parsed_custom_data, dict):
                            # Update context if it's a dictionary
                            if 'context' in parsed_custom_data:
                                self.agent_instance._latest_student_context = parsed_custom_data['context']
                                logger.info(f"RPC: Updated student context: {parsed_custom_data['context']}")
                            if 'session_id' in parsed_custom_data:
                                self.agent_instance._latest_session_id = parsed_custom_data['session_id']
                                logger.info(f"RPC: Updated session_id: {parsed_custom_data['session_id']}")
                            
                            # Extract any additional data for further processing
                            if 'action' in parsed_custom_data:
                                logger.info(f"RPC: Client requested action: {parsed_custom_data['action']}")
                        else:
                            logger.warning(f"RPC: Parsed JSON is not a dictionary. Type: {type(parsed_custom_data)}")
                    except json.JSONDecodeError as e:
                        logger.warning(f"RPC: JSON parsing failed despite JSON-like format. Error: {e}")
                        # Fall through to plain string handling
                
                # Handle as plain string (either non-JSON or JSON parsing failed)
                # Create a context with the message
                message_context = {
                    "user_id": f"user_{invocation_data.caller_identity}",
                    "message": request.custom_data
                }
                self.agent_instance._latest_student_context = message_context
                logger.info(f"RPC: Created context with plain string data: {message_context}")
                
                # Generate a session ID if needed
                if not hasattr(self.agent_instance, '_latest_session_id') or not self.agent_instance._latest_session_id:
                    session_id = f"session_{uuid.uuid4().hex[:8]}_{int(time.time())}"
                    self.agent_instance._latest_session_id = session_id
                    message_context['session_id'] = session_id
                    logger.info(f"RPC: Generated new session_id: {session_id}")
            except Exception as e:
                logger.error(f"RPC: Error processing custom_data: {e}", exc_info=True)
                # Create a minimal context for error recovery
                minimal_context = {
                    "user_id": f"error_recovery_{invocation_data.caller_identity}",
                    "error_info": f"Error processing data: {str(e)}",
                    "original_data": request.custom_data
                }
                self.agent_instance._latest_student_context = minimal_context
                
                # Generate a session ID for error recovery
                session_id = f"error_session_{uuid.uuid4().hex[:8]}_{int(time.time())}"
                self.agent_instance._latest_session_id = session_id
                minimal_context['session_id'] = session_id
                
                logger.info(f"RPC: Created minimal context for error recovery: {minimal_context}")
        elif not self.agent_instance:
            logger.warning("RPC: agent_instance is not available. Cannot update context.")
        elif not request.custom_data:
            logger.info("RPC: No custom_data received in this request.")
        
        # Send a test request to the backend to verify context passing
        if self.agent_instance:
            try:
                import aiohttp
                import asyncio
                
                # Create a task to send the request asynchronously
                loop = asyncio.get_event_loop()
                task = loop.create_task(self._send_test_request_to_backend())
                
                # Log that we're sending a test request
                logger.info("RPC: Created async task to send test request to backend API")
            except Exception as e:
                logger.error(f"RPC: Failed to create test request task: {e}")
        
        response_message = f"Button '{request.button_id}' click processed by RoxAgent."
        if request.custom_data:
            response_message += f" Data: '{request.custom_data}'"

        response = interaction_pb2.AgentResponse(
            status_message=response_message,
            data_payload="Successfully processed by agent."
        )
        
        logger.info(f"Sending response: {response}")
        serialized_response = response.SerializeToString()
        logger.info(f"Serialized response length: {len(serialized_response)} bytes")
        
        base64_response = base64.b64encode(serialized_response).decode('utf-8')
        logger.info(f"Base64 encoded response length: {len(base64_response)} characters")
        
        return base64_response
        
    async def _send_test_request_to_backend(self):
        """Send a test request to the backend API and then manually process the UI actions."""
        import aiohttp
        import os
        import json
        import uuid
        from livekit.agents.llm import ChatChunk, ChoiceDelta, FunctionToolCall
        
        if not self.agent_instance:
            logger.error("Cannot send test request: agent_instance is not available")
            return False
            
        # Get the backend URL from environment or use a default
        backend_url = os.environ.get("MY_CUSTOM_AGENT_URL", "http://localhost:5005/process_interaction")
        
        try:
            logger.info(f"Sending test request to backend API at {backend_url}")
            
            # Prepare payload with the context from agent instance
            # Make a copy of the context to avoid modifying the original
            context = dict(self.agent_instance._latest_student_context)
            
            # Add task_stage to the context object (not at top level)
            context["task_stage"] = "testing_specific_context_from_button"  # Special task_stage to trigger UI action test
            
            payload = {
                "transcript": "This is a test request from RPC handler",
                "current_context": context,
                "session_id": self.agent_instance._latest_session_id
            }
            
            logger.info(f"Test request payload: {payload}")
            
            # Send the request
            async with aiohttp.ClientSession() as session:
                async with session.post(backend_url, json=payload) as response:
                    status = response.status
                    response_text = await response.text()
                    
                    logger.info(f"Backend API test response: Status={status}, Response={response_text[:100]}...")
                    
                    # NEW CODE: Process the response to extract DOM actions
                    if status == 200:
                        try:
                            # Parse the JSON response
                            result = json.loads(response_text)
                            
                            # Extract DOM actions if present
                            dom_actions = None
                            if "dom_actions" in result:
                                dom_actions = result["dom_actions"]
                                logger.info(f"Extracted DOM actions from response: {dom_actions}")
                            
                            # If we have DOM actions, create a tool call and manually trigger on_llm_response_done
                            if dom_actions:
                                # Create a special tool call for dom_actions
                                dom_actions_str = json.dumps(dom_actions)
                                tool_call = FunctionToolCall(
                                    type='function',
                                    name='_internal_dom_actions',
                                    arguments=dom_actions_str,
                                    call_id='dom_actions_tool_call'
                                )
                                
                                # Create a ChatChunk with the tool call
                                chat_chunk = ChatChunk(
                                    id=str(uuid.uuid4()),
                                    delta=ChoiceDelta(
                                        role='assistant',
                                        content=result.get("response_for_tts", ""),
                                        tool_calls=[tool_call]
                                    )
                                )
                                
                                logger.info(f"Created ChatChunk with DOM actions tool call: {tool_call}")
                                
                                # Manually call on_llm_response_done to process the DOM actions
                                if hasattr(self.agent_instance, 'on_llm_response_done'):
                                    logger.info("Manually calling on_llm_response_done with DOM actions")
                                    asyncio.create_task(self.agent_instance.on_llm_response_done([chat_chunk]))
                                else:
                                    logger.error("Agent instance does not have on_llm_response_done method")
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse JSON response: {e}")
                        except Exception as e:
                            logger.error(f"Error processing response: {e}", exc_info=True)
            
            return True
        except Exception as e:
            logger.error(f"Error sending test request to backend: {e}", exc_info=True)
            return False