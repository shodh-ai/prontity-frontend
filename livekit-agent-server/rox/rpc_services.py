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
            try: # Line 65
                # Log the raw custom_data for debugging
                logger.info(f"RPC: Raw custom_data received: {request.custom_data}")
                
                raw_custom_str = request.custom_data
                default_user_id = f"default_{invocation_data.caller_identity or 'user'}"
                parsed_custom_data = {} # Initialize

                try:
                    # Attempt to parse as JSON
                    data = json.loads(raw_custom_str)
                    if isinstance(data, dict):
                        parsed_custom_data = data
                        if "user_id" not in parsed_custom_data:
                            logger.info(f"RPC: Parsed JSON dict is missing 'user_id'. Adding default: {default_user_id}")
                            parsed_custom_data["user_id"] = default_user_id
                    else:
                        # JSON, but not a dict (e.g., a list, string, number)
                        logger.info(f"RPC: custom_data parsed as JSON but is not a dict (type: {type(data)}). Wrapping it.")
                        parsed_custom_data = {
                            "user_id": default_user_id,
                            "value": data  # Store the non-dict JSON data under 'value'
                        }
                except json.JSONDecodeError:
                    # Not valid JSON, treat as a plain string message
                    logger.info(f"RPC: json.loads failed for custom_data. Treating as plain string. Data: '{raw_custom_str}'")
                    parsed_custom_data = {
                        "user_id": default_user_id,
                        "message": raw_custom_str # Store plain string under 'message'
                    }
                except Exception as e:
                    # Catch-all for other unexpected errors during the above processing
                    logger.error(f"RPC: Unexpected error processing custom_data '{raw_custom_str}': {e}", exc_info=True)
                    parsed_custom_data = {
                        "user_id": default_user_id,
                        "error": "custom_data_processing_error",
                        "original_custom_data": raw_custom_str,
                        "exception": str(e)
                    }
                
                # Ensure parsed_custom_data is always a dict and has a user_id if not an error structure
                if not isinstance(parsed_custom_data, dict):
                     logger.error("RPC: parsed_custom_data is not a dict after processing. This is unexpected. Forcing error structure.")
                     parsed_custom_data = {
                        "user_id": default_user_id,
                        "error": "internal_custom_data_handling_failed",
                        "original_custom_data": raw_custom_str
                     }
                elif "user_id" not in parsed_custom_data and "error" not in parsed_custom_data : # Check if it's a dict but missing user_id and not an error dict
                    logger.warning(f"RPC: Processed custom_data is a dict but missing 'user_id'. Adding default: {default_user_id}")
                    parsed_custom_data["user_id"] = default_user_id

                # Store the validated context
                if self.agent_instance:
                    self.agent_instance._latest_student_context = parsed_custom_data
                    logger.info(f"RPC: Updated agent_instance._latest_student_context with: {parsed_custom_data}")
                    
                    # Extract chat history from custom_data if available
                    if isinstance(parsed_custom_data, dict) and 'chatHistory' in parsed_custom_data:
                        chat_history = parsed_custom_data.get('chatHistory', [])
                        
                        # Detailed test logging for chat history
                        print("======== CHAT HISTORY TEST LOGGING ========")
                        print(f"RPC: Received chat history with {len(chat_history)} messages")
                        for i, msg in enumerate(chat_history):
                            print(f"Message #{i+1}:")
                            print(f"  Role: {msg.get('role', 'unknown')}")
                            print(f"  Content: {msg.get('content', '')[:50]}{'...' if len(msg.get('content', '')) > 50 else ''}")
                        print("==========================================")
                        
                        # Ensure the agent instance has a chat history attribute
                        if not hasattr(self.agent_instance, '_latest_chat_history'):
                            self.agent_instance._latest_chat_history = []
                        self.agent_instance._latest_chat_history = chat_history
                        logger.info(f"RPC: Updated agent_instance._latest_chat_history with {len(chat_history)} messages")
                    else:
                        logger.debug("RPC: No chat history found in custom_data")
                        print("======== CHAT HISTORY TEST LOGGING ========")
                        print("RPC: No chat history found in custom_data")
                        print("Key 'chatHistory' not found in:", list(parsed_custom_data.keys()) if isinstance(parsed_custom_data, dict) else f"Not a dict: {type(parsed_custom_data)}")
                        print("==========================================")

                    # Handle session ID (prioritize session_id over sessionId)
                    if isinstance(parsed_custom_data, dict) and 'session_id' in parsed_custom_data:
                        self.agent_instance._latest_session_id = parsed_custom_data['session_id']
                        logger.info(f"RPC: Updated agent_instance._latest_session_id with: {parsed_custom_data['session_id']}")
                    elif isinstance(parsed_custom_data, dict) and 'sessionId' in parsed_custom_data: # Fallback for camelCase
                        self.agent_instance._latest_session_id = parsed_custom_data['sessionId']
                        logger.info(f"RPC: Updated agent_instance._latest_session_id with (from sessionId): {parsed_custom_data['sessionId']}")
                    else:
                        # Generate a session ID if none exists or not found in custom_data
                        if not hasattr(self.agent_instance, '_latest_session_id') or not self.agent_instance._latest_session_id:
                            new_session_id = f"session_{uuid.uuid4().hex}" # Use .hex for a clean string
                            self.agent_instance._latest_session_id = new_session_id
                            if isinstance(parsed_custom_data, dict) and "error" not in parsed_custom_data:
                                parsed_custom_data['session_id'] = new_session_id
                                logger.info(f"RPC: Generated new session_id: {new_session_id}. Agent session ID updated and added to parsed_custom_data.")
                            else: 
                                logger.info(f"RPC: Generated new session_id: {new_session_id}. Agent session ID updated. Not adding to parsed_custom_data as it's not a valid dict or is an error structure.")
                else:
                    logger.warning("RPC: agent_instance is None, cannot update context or session ID.")
                
                # ***** MOVED ALERT LOGIC STARTS HERE *****
                if self.agent_instance and hasattr(self.agent_instance, 'send_ui_action_to_frontend') and request.button_id == "test_rpc_button": 
                    action_data_for_client_rpc = {
                        "action_type_str": "SHOW_ALERT", 
                        "parameters": { 
                            "title": "Button Clicked",
                            "message": f"Button '{request.button_id}' was clicked by {invocation_data.caller_identity}. Context updated.",
                            "buttons": [
                                {
                                    "label": "OK",
                                    "action": {"action_type": "DISMISS_ALERT"} 
                                }
                            ]
                        }
                    }
                    logger.info(f"RPC: Preparing UI action (alert) data for client-side RPC: {action_data_for_client_rpc['parameters']}")
                    logger.info(f"RPC DEBUG: Type of self.agent_instance: {type(self.agent_instance)}")
                    
                    if callable(getattr(self.agent_instance, 'send_ui_action_to_frontend')):
                        await self.agent_instance.send_ui_action_to_frontend(action_data_for_client_rpc)
                        logger.info(f"RPC: Successfully dispatched SHOW_ALERT to frontend for button '{request.button_id}'.")
                    else: 
                        logger.error("RPC Error: agent_instance.send_ui_action_to_frontend is not callable (inner check).")
                elif not (self.agent_instance and hasattr(self.agent_instance, 'send_ui_action_to_frontend')):
                     logger.warning(f"RPC: Cannot send alert for '{request.button_id}'. Agent instance or send_ui_action_to_frontend not available. Agent: {bool(self.agent_instance)}")
                # ***** MOVED ALERT LOGIC ENDS HERE *****

            except Exception as main_e: 
                logger.error(f"RPC: Error processing custom_data or sending alert: {main_e}", exc_info=True)
        elif not self.agent_instance:
            logger.warning("RPC: agent_instance is not available. Cannot update context.")
        elif not request.custom_data:
            logger.info("RPC: No custom_data received in this request.")
        
        # Send a test request to the backend to verify context passing
        if self.agent_instance:
            try:
                import aiohttp
                
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

    async def NotifyPageLoad(self, invocation_data: RpcInvocationData) -> str:
        logger.info(f"RPC NotifyPageLoad: Received call from participant: {invocation_data.caller_identity}")

        request = interaction_pb2.NotifyPageLoadRequest()
        try:
            if isinstance(invocation_data.payload, str):
                logger.info(f"RPC NotifyPageLoad: Payload is a string, assuming base64 encoded. Length: {len(invocation_data.payload)}")
                try:
                    decoded_bytes = base64.b64decode(invocation_data.payload)
                    payload_bytes = decoded_bytes
                except Exception as e:
                    logger.error(f"RPC NotifyPageLoad: Failed to decode base64 payload: {e}")
                    payload_bytes = invocation_data.payload.encode('utf-8') # Fallback
            elif isinstance(invocation_data.payload, bytes):
                logger.info(f"RPC NotifyPageLoad: Payload is already bytes. Length: {len(invocation_data.payload)}")
                payload_bytes = invocation_data.payload
            else:
                logger.error(f"RPC NotifyPageLoad: Cannot handle payload type {type(invocation_data.payload)}")
                error_response = interaction_pb2.AgentResponse(status_message=f"Error: Unhandled payload type {type(invocation_data.payload)}")
                serialized_error = error_response.SerializeToString()
                return base64.b64encode(serialized_error).decode('utf-8')

            request.ParseFromString(payload_bytes)
            logger.info(f"RPC NotifyPageLoad: Successfully parsed NotifyPageLoadRequest: user_id='{request.user_id}', page='{request.current_page}', session_id='{request.session_id}'")

        except Exception as e:
            logger.error(f"RPC NotifyPageLoad: Failed to parse payload: {e}", exc_info=True)
            error_response = interaction_pb2.AgentResponse(
                status_message=f"Error processing NotifyPageLoad request: {str(e)}",
                data_payload="Parse error"
            )
            serialized_error = error_response.SerializeToString()
            return base64.b64encode(serialized_error).decode('utf-8')

        if self.agent_instance:
            # Update agent's context
            page_load_context = {
                "user_id": request.user_id,
                "task_stage": request.task_stage,
                "current_page": request.current_page,
                "session_id": request.session_id,
                "chat_history": request.chat_history, # Assuming it's a JSON string as sent by client
                "transcript": request.transcript, # Optional field
                "page_load_timestamp": time.time()
            }
            self.agent_instance._latest_student_context = page_load_context
            self.agent_instance._latest_session_id = request.session_id
            logger.info(f"RPC NotifyPageLoad: Agent context updated. User: '{request.user_id}', Page: '{request.current_page}', Session: '{request.session_id}'")
            logger.debug(f"RPC NotifyPageLoad: Full context updated: {page_load_context}")

            # --- START MODIFICATION FOR TIMER TEST ---
            if request.current_page == 'writingpractisetest':
                logger.info(f"RPC NotifyPageLoad: Page is 'writingpractisetest'. Attempting to send START_TIMER command to {invocation_data.caller_identity}.")
                try:
                    timer_duration = 10  # seconds
                    ui_action_request = interaction_pb2.AgentToClientUIActionRequest(
                        action_type=interaction_pb2.ClientUIActionType.START_TIMER,
                        start_timer_payload=interaction_pb2.StartTimerPayload(duration_seconds=timer_duration)
                    )
                    
                    if hasattr(self.agent_instance, 'send_action_to_participant'):
                        await self.agent_instance.send_action_to_participant(
                            participant_identity=invocation_data.caller_identity,
                            action_request=ui_action_request
                        )
                        logger.info(f"RPC NotifyPageLoad: START_TIMER command ({timer_duration}s) sent to {invocation_data.caller_identity}.")
                    elif hasattr(self.agent_instance, '_room_manager') and hasattr(self.agent_instance._room_manager, 'send_action_to_participant_in_default_room'):
                         await self.agent_instance._room_manager.send_action_to_participant_in_default_room(
                            participant_identity=invocation_data.caller_identity,
                            action_request=ui_action_request
                        )
                         logger.info(f"RPC NotifyPageLoad: START_TIMER command ({timer_duration}s) sent via RoomManager to {invocation_data.caller_identity}.")
                    else:
                        logger.error("RPC NotifyPageLoad: Agent instance does not have a recognized method to send action to participant. Timer not started.")

                except Exception as e:
                    logger.error(f"RPC NotifyPageLoad: Failed to send START_TIMER command: {e}", exc_info=True)
            # --- END MODIFICATION FOR TIMER TEST ---

            status_msg = f"Page load notification for '{request.current_page}' by user '{request.user_id}' received and processed."
            data_payload_str = f"Session ID: {request.session_id}, Context Updated."
        else:
            logger.warning("RPC NotifyPageLoad: agent_instance is None. Cannot update context.")
            status_msg = "Page load notification received, but agent instance not available to update context."
            data_payload_str = "Agent instance not found."

        response = interaction_pb2.AgentResponse(
            status_message=status_msg,
            data_payload=data_payload_str
        )
        serialized_response = response.SerializeToString()
        return base64.b64encode(serialized_response).decode('utf-8')