# custom_llm.py (create this new file or add the class to your main.py)

import os
import json
import logging
import time
import aiohttp # Required for async HTTP requests: pip install aiohttp
from typing import AsyncIterable, Optional, TYPE_CHECKING
import uuid
import asyncio

if TYPE_CHECKING:
    from .main import RoxAgent # Import RoxAgent for type hinting to avoid circular dependency
from contextlib import asynccontextmanager

from livekit.agents.llm import LLM, ChatContext, ChatMessage, ChatRole, ChatChunk, ChoiceDelta
import uuid

logger = logging.getLogger(__name__)

# Get the URL of your custom backend agent from environment variables
# Example: export MY_CUSTOM_AGENT_URL="http://localhost:5005/process"
MY_CUSTOM_AGENT_URL = os.getenv("MY_CUSTOM_AGENT_URL") # Default URL

class CustomLLMBridge(LLM):
    """
    A custom LLM component that bridges to an external backend script/service.
    """
    def __init__(self, 
                 agent_url: str = MY_CUSTOM_AGENT_URL, 
                 page_name: Optional[str] = None, 
                 rox_agent_ref: Optional['RoxAgent'] = None): # Add rox_agent_ref
        super().__init__()
        if not agent_url:
            raise ValueError("External agent URL cannot be empty. Set MY_CUSTOM_AGENT_URL environment variable.")
        self._agent_url = agent_url
        self._page_name = page_name # Store page_name, though not currently used by the bridge logic
        self._rox_agent_ref = rox_agent_ref # Store the RoxAgent reference
        if self._rox_agent_ref:
            logger.info(f"CustomLLMBridge initialized with RoxAgent reference. Will send requests to: {self._agent_url} for page: {self._page_name}")
        else:
            logger.warning(f"CustomLLMBridge initialized WITHOUT RoxAgent reference. Context data will not be available. Will send requests to: {self._agent_url} for page: {self._page_name}")
    def add_user_token(self, user_token: str, user_id: str):
        self._user_token = user_token
        self._user_id = user_id
        logger.info(f"!!!!!!!!!!!!!! User token added to CustomLLMBridge: {self._user_token} and user_id: {self._user_id}!!!!!!!!!!!!!!")
    def chat(self, *, chat_ctx: ChatContext = None, tools = None, tool_choice = None):
        """
        Receives the chat history, sends the latest user message to the external
        backend, and returns an async context manager that yields the response.
        
        Parameters:
        - chat_ctx: The chat context containing message history
        - tools: Optional tools parameter (not used in this implementation)
        - tool_choice: Optional tool choice parameter (not used in this implementation)
        """
        # Return an async context manager
        return self._chat_context_manager(chat_ctx, tools, tool_choice)
    
    @asynccontextmanager
    async def _chat_context_manager(self, chat_ctx: ChatContext, tools, tool_choice):
        """
        An async context manager wrapper that yields an async generator.
        This matches the expected interface in the LiveKit library.
        """
        try:
            # Create the async generator directly inside the context manager
            async def response_generator():
                # Skip if no history
                if not chat_ctx:
                    logger.warning("No chat context provided")
                    yield ChatChunk(id=str(uuid.uuid4()), delta=ChoiceDelta(role='assistant', content=""))
                    return
                
                # Debug the chat context structure - more safely this time
                logger.debug(f"CustomLLMBridge received chat context of type: {type(chat_ctx)}")
                
                # Get messages - try different approaches based on the API
                try:
                    # First attempt: try to access _items directly if it exists
                    if hasattr(chat_ctx, '_items'):
                        messages = getattr(chat_ctx, '_items')
                        logger.debug(f"Got messages from chat_ctx._items: {len(messages)}")
                    # Second attempt: try to use items() as a method
                    elif hasattr(chat_ctx, 'items') and callable(getattr(chat_ctx, 'items')):
                        messages = list(chat_ctx.items())
                        logger.debug(f"Got {len(messages)} messages from chat_ctx.items()")
                    # Third attempt: try to iterate through the object
                    elif hasattr(chat_ctx, '__iter__'):
                        messages = list(chat_ctx)
                        logger.debug(f"Got {len(messages)} messages by iterating chat_ctx")
                    # Last fallback: try using to_dict() if available
                    elif hasattr(chat_ctx, 'to_dict') and callable(getattr(chat_ctx, 'to_dict')):
                        dict_data = chat_ctx.to_dict()
                        if 'messages' in dict_data:
                            messages = dict_data['messages']
                            logger.debug(f"Got {len(messages)} messages from chat_ctx.to_dict()['messages']")
                        else:
                            messages = []
                            logger.debug("chat_ctx.to_dict() doesn't contain 'messages' key")
                    else:
                        messages = []
                        logger.debug("Couldn't find a way to access messages from chat_ctx")
                except Exception as e:
                    logger.error(f"Error accessing messages from chat_ctx: {e}")
                    messages = []
                    logger.debug("Using empty messages list due to error")
                
                if not messages:
                    logger.warning("Empty chat history or couldn't access messages")
                    yield ChatChunk(id=str(uuid.uuid4()), delta=ChoiceDelta(role='assistant', content="I didn't receive any message to process."))
                    return

                # Extract the latest user message (transcript)
                # Be more resilient when checking for user messages
                user_messages = []
                # Log the message structure to help debug
                if messages and len(messages) > 0:
                    logger.debug(f"First message type: {type(messages[0])}")
                    logger.debug(f"First message attributes: {dir(messages[0]) if hasattr(messages[0], '__dir__') else 'No dir attributes'}")
                
                for msg in reversed(messages):
                    try:
                        # More detailed logging of the message
                        logger.debug(f"Processing message: {msg}")
                        
                        # Check if this is a user message using multiple approaches
                        is_user_message = False
                        
                        # Try the direct role attribute
                        if hasattr(msg, 'role'):
                            role_value = getattr(msg, 'role')
                            logger.debug(f"Message has role attribute: {role_value}, type: {type(role_value)}")
                            if str(role_value).lower() == 'user':
                                is_user_message = True
                        
                        # Try accessing it as a dict
                        elif isinstance(msg, dict) and 'role' in msg:
                            logger.debug(f"Message has role key: {msg['role']}")
                            if str(msg['role']).lower() == 'user':
                                is_user_message = True
                        
                        if is_user_message:
                            logger.debug(f"Found a user message: {msg}")
                            user_messages.append(msg)
                    except Exception as e:
                        logger.error(f"Error checking message type: {e}")
                
                # Get the user message from the history
                user_message = user_messages[0] if user_messages else None

                # Initialize empty transcript 
                transcript = ""
                
                # Main try block for all transcript extraction
                try:
                    # Extract transcript from user message if available
                    if user_message and hasattr(user_message, 'content') and user_message.content:
                        try:
                            content = user_message.content
                            # Handle both string and list content formats
                            if isinstance(content, list):
                                transcript = ' '.join(str(item) for item in content)
                            else:
                                transcript = str(content)
                            logger.info(f"CustomLLMBridge: Extracted transcript from speech: '{transcript}'")
                        except Exception as e:
                            logger.error(f"CustomLLMBridge: Error extracting transcript from user_message.content: {e}")
                    elif user_message and isinstance(user_message, dict) and 'content' in user_message:
                        try:
                            content = user_message['content']
                            # Handle both string and list content formats
                            if isinstance(content, list):
                                transcript = ' '.join(str(item) for item in content)
                            else:
                                transcript = str(content)
                            logger.info(f"CustomLLMBridge: Extracted transcript from dictionary: '{transcript}'")
                        except Exception as e:
                            logger.error(f"CustomLLMBridge: Error extracting transcript from dictionary: {e}")
                    elif user_message:
                        try:
                            # Last resort - try to convert the whole message to a string
                            transcript = str(user_message)
                            logger.info(f"CustomLLMBridge: Used message string as transcript: '{transcript}'")
                        except Exception as e:
                            logger.error(f"CustomLLMBridge: Error converting message to string: {e}")
                    else:
                        logger.warning("CustomLLMBridge: No user message found, using empty transcript but continuing to send context")
                    
                    # Log what we're doing with the transcript
                    if transcript:
                        logger.info(f"CustomLLMBridge: Will send transcript to backend: '{transcript}'")
                    else:
                        logger.info("CustomLLMBridge: Will send empty transcript to backend with context only")
                except Exception as e:
                    logger.error(f"Error extracting content from user message: {e}")
                    transcript = "[Error: Could not extract transcript]"
                
                logger.info(f"Sending transcript to external agent at {self._agent_url}: '{transcript}' for page: {self._page_name}")
                # Add more verbosity to help debug
                logger.debug(f"User message object: {user_message}")
                logger.debug(f"User message type: {type(user_message)}")

                response_text = ""
                dom_actions = None
                
                try:
                    # Prepare payload
                    # Always include a transcript field, even if empty
                    payload = {"transcript": transcript, "user_token": self._user_token}
                    logger.info(f"CustomLLMBridge: Initialized payload with transcript: '{transcript}'")

                    # Retrieve and add context
                    if self._rox_agent_ref:
                        # Attempt to get context data from the agent reference
                        logger.info(f"CustomLLMBridge: Attempting to retrieve context. _latest_student_context: {self._rox_agent_ref._latest_student_context}")
                        logger.info(f"CustomLLMBridge: Attempting to retrieve session_id. _latest_session_id: {self._rox_agent_ref._latest_session_id}")
                        
                        student_context = self._rox_agent_ref._latest_student_context
                        session_id_from_context = self._rox_agent_ref._latest_session_id
                        
                        # Validate and add context to payload if available
                        if student_context:
                            # Ensure student_context is a dictionary
                            if not isinstance(student_context, dict):
                                logger.warning(f"CustomLLMBridge: _latest_student_context is not a dictionary. Type: {type(student_context)}")
                                try:
                                    # Try to convert to dict if it's a string that might be JSON
                                    if isinstance(student_context, str):
                                        student_context = json.loads(student_context)
                                        logger.info(f"CustomLLMBridge: Converted string _latest_student_context to dictionary")
                                    else:
                                        # If it's not a string or dict, create a basic dict with it
                                        student_context = {"user_id": "default_user", "data": str(student_context)}
                                        logger.warning(f"CustomLLMBridge: Created basic context dictionary from non-dict data")
                                except Exception as e:
                                    logger.error(f"CustomLLMBridge: Failed to process non-dictionary context: {e}")
                                    # Create a fallback context
                                    student_context = {"user_id": "default_user", "error": str(e)}
                            
                            # Ensure required fields are present
                            if "user_id" not in student_context:
                                logger.warning("CustomLLMBridge: context missing required 'user_id' field. Adding default.")
                                student_context["user_id"] = "default_bridge_user"
                            
                            # Add required task_stage field if missing - this is required by InteractionRequestContext model
                            if "task_stage" not in student_context:
                                logger.warning("CustomLLMBridge: context missing required 'task_stage' field. Adding default.")
                                student_context["task_stage"] = "DEFAULT_CONVERSATION"
                            
                            # Add the validated context to payload
                            payload['current_context'] = student_context
                            logger.info(f"CustomLLMBridge: Added validated current_context to payload: {student_context}")
                        else:
                            # Create a minimal valid context if none exists
                            minimal_context = {
                                "user_id": "default_bridge_user",
                                "task_stage": "DEFAULT_CONVERSATION"  # Add required task_stage field
                            }
                            payload['current_context'] = minimal_context
                            logger.warning(f"CustomLLMBridge: Created minimal context as _latest_student_context was empty: {minimal_context}")
                        
                        # Add session_id to payload if available
                        if session_id_from_context:
                            payload['session_id'] = session_id_from_context
                            logger.info(f"CustomLLMBridge: Added session_id to payload: {session_id_from_context}")
                        else:
                            # Generate a session ID if none exists
                            session_id = f"bridge_session_{uuid.uuid4().hex[:8]}_{int(time.time())}"
                            payload['session_id'] = session_id
                            logger.warning(f"CustomLLMBridge: Generated and added new session_id as none existed: {session_id}")
                    else:
                        # Create minimal context for backend validation even without RoxAgent reference
                        minimal_context = {
                            "user_id": "no_agent_ref_user",
                            "task_stage": "DEFAULT_CONVERSATION"  # Add required task_stage field
                        }
                        payload['current_context'] = minimal_context
                        payload['session_id'] = f"no_ref_session_{uuid.uuid4().hex[:8]}"
                        logger.warning(f"CustomLLMBridge: No RoxAgent reference, created minimal context: {minimal_context}")

                    # Add chat history to the payload if available
                    if self._rox_agent_ref and hasattr(self._rox_agent_ref, '_latest_chat_history'):
                        chat_history = self._rox_agent_ref._latest_chat_history
                        if isinstance(chat_history, list):
                            payload['chat_history'] = chat_history
                            
                            # Detailed test logging for chat history in CustomLLMBridge
                            print("\n======== CUSTOM_LLM_BRIDGE TEST LOGGING ========")
                            print(f"CustomLLMBridge: Sending chat history with {len(chat_history)} messages to backend API")
                            for i, msg in enumerate(chat_history):
                                print(f"Message #{i+1}:")
                                print(f"  Role: {msg.get('role', 'unknown')}")
                                print(f"  Content: {msg.get('content', '')[:50]}{'...' if len(msg.get('content', '')) > 50 else ''}")
                            print("==============================================\n")
                            
                            logger.info(f"CustomLLMBridge: Added chat_history to payload with {len(chat_history)} messages")
                        else:
                            logger.warning(f"CustomLLMBridge: _latest_chat_history is not a list. Type: {type(chat_history)}")
                            payload['chat_history'] = []  # Add empty chat history array to match InteractionRequest model
                            print("\n======== CUSTOM_LLM_BRIDGE TEST LOGGING ========")
                            print(f"CustomLLMBridge: ERROR - Chat history is not a list: {type(chat_history)}")
                            print("==============================================\n")
                    else:
                        logger.debug("CustomLLMBridge: No chat history available to add to payload")
                        payload['chat_history'] = []  # Add empty chat history array to match InteractionRequest model
                        print("\n======== CUSTOM_LLM_BRIDGE TEST LOGGING ========")
                        print("CustomLLMBridge: No chat history attribute found in RoxAgent")
                        print("==============================================\n")
                        
                    # Add diagnostic field to track the flow
                    payload['_debug_source'] = 'custom_llm_bridge'
                    payload['usertoken'] = self._user_token
                    payload['user_id'] = self._user_id
                    
                    # Force logging of the full payload to ensure we can see what's being sent
                    logger.info(f"CustomLLMBridge: CRITICAL - Sending payload to {self._agent_url}: {json.dumps(payload, indent=2)}")

                    # Use aiohttp for async HTTP requests
                    async with aiohttp.ClientSession() as session:
                        try:
                            logger.info(f"CustomLLMBridge: Starting HTTP POST to {self._agent_url, payload}")
                            async with session.post(self._agent_url, json=payload) as response:
                                logger.info(f"CustomLLMBridge: Received HTTP response status: {response.status}")
                                response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
                                result = await response.json() # Expecting JSON back
                                logger.info(f"CustomLLMBridge: Parsed JSON response: {json.dumps(result, indent=2)}")
                                
                                # First try the new field name "response", fall back to old "response_for_tts" for backward compatibility
                                response_text = result.get("response", result.get("response_for_tts", ""))
                                logger.info(f"CustomLLMBridge: Extracted response text: '{response_text}'")
                                
                                # Initialize dom_actions to None
                                dom_actions = None
                                
                                # NEW: First check for ui_actions (new field name)
                                if "ui_actions" in result:
                                    dom_actions = result["ui_actions"]
                                    logger.info(f"CustomLLMBridge: Found ui_actions in response: {dom_actions}")
                                # Check for legacy single action/payload format
                                elif "action" in result and "payload" in result:
                                    action = result["action"]
                                    payload_from_response = result["payload"] # Renamed to avoid conflict
                                    logger.info(f"CustomLLMBridge: Found legacy action/payload in response: {action} with payload: {payload_from_response}")
                                    
                                    # Convert the action and payload to a format that can be sent as metadata
                                    dom_actions = [{
                                        "action_type": action, # Using new field name for forward compatibility
                                        "parameters": payload_from_response # Using new field name for forward compatibility
                                    }]
                                    logger.info(f"CustomLLMBridge: Converted legacy format to ui_actions format: {dom_actions}")
                                # Check for legacy dom_actions (for backward compatibility)
                                elif "dom_actions" in result:
                                    dom_actions = result["dom_actions"]
                                    logger.info(f"CustomLLMBridge: Found legacy dom_actions in response: {dom_actions}")
                                    
                                    # OPTIONAL: Convert legacy dom_actions field names if needed
                                    # This would ensure older backend responses still work with updated RoxAgent.on_llm_response_done
                                    updated_dom_actions = []
                                    for action in dom_actions:
                                        updated_action = {}
                                        if "action" in action:
                                            updated_action["action_type"] = action["action"]
                                        elif "action_type_str" in action:
                                            updated_action["action_type"] = action["action_type_str"]
                                        if "payload" in action:
                                            updated_action["parameters"] = action["payload"]
                                        if "target_id" in action:
                                            updated_action["target_element_id"] = action["target_id"]
                                        # Include any other fields as-is
                                        for k, v in action.items():
                                            if k not in ["action", "action_type_str", "payload", "target_id"] and k not in updated_action:
                                                updated_action[k] = v
                                        updated_dom_actions.append(updated_action)
                                    
                                    if updated_dom_actions:
                                        dom_actions = updated_dom_actions
                                        logger.info(f"CustomLLMBridge: Converted legacy dom_actions field names: {dom_actions}")
                                
                                logger.info(f"Received response from external agent: '{response_text}'")
                        except Exception as e:
                            logger.error(f"CustomLLMBridge: HTTP request error details: {str(e)}")
                            raise # Re-raise the exception for the outer catch block

                except aiohttp.ClientError as e:
                    logger.error(f"Error communicating with external agent at {self._agent_url}: {e}")
                    response_text = "Sorry, I encountered an error trying to process your request." # Error message
                except Exception as e:
                    logger.error(f"An unexpected error occurred in CustomLLMBridge: {e}")
                    response_text = "Sorry, an unexpected error occurred." # Generic error message

                # Prepare metadata if UI actions are present
                current_metadata = None
                if dom_actions:  # Note: Still using dom_actions as variable name for backward compatibility
                    current_metadata = {"ui_actions": json.dumps(dom_actions)}
                
                # Create a special tool call for UI actions if present
                tool_calls = []
                if dom_actions:
                    # Create a special tool call to carry the UI actions
                    # We continue to use _internal_dom_actions as the tool name for backward compatibility with RoxAgent
                    ui_actions_str = json.dumps(dom_actions)
                    tool_call = {
                        # Match the expected ChoiceDelta model structure with top-level fields
                        "call_id": "ui_actions_tool_call",  # Updated call_id for clarity
                        "name": "_internal_dom_actions",    # Keep the same tool name for backward compatibility
                        "arguments": ui_actions_str         # Use the ui_actions_str variable
                    }
                    tool_calls.append(tool_call)
                    logger.info(f"Created special tool call with UI actions: {dom_actions}")
                
                # Create the ChatChunk with basic fields
                chat_chunk = ChatChunk(
                    id=str(uuid.uuid4()),
                    delta=ChoiceDelta(
                        role='assistant',
                        content=response_text,
                        tool_calls=tool_calls  # Include dom_actions as a tool call
                    )
                )
                
                # DIRECT TEST: Explicitly call on_llm_response_done to test dom_actions flow
                # This bypasses the normal event mechanism which might be broken
                if dom_actions and self._rox_agent_ref and hasattr(self._rox_agent_ref, 'on_llm_response_done'):
                    logger.warning("DIRECT TEST: Manually calling on_llm_response_done with chunk containing dom_actions")
                    logger.info(f"DOM Actions being sent to RoxAgent via tool_call: {dom_actions}")
                    # Log the structure of the chat_chunk for debugging
                    tool_calls = getattr(chat_chunk.delta, 'tool_calls', [])
                    logger.info(f"ChatChunk structure: id={chat_chunk.id}, tool_calls={tool_calls}")
                    
                    # Create task to avoid blocking, since on_llm_response_done is async
                    asyncio.create_task(self._rox_agent_ref.on_llm_response_done([chat_chunk]))
                
                # Yield the ChatChunk to the normal LiveKit pipeline
                yield chat_chunk
                logger.debug("Finished yielding response from CustomLLMBridge.")
            
            # Yield the async generator
            yield response_generator()
        except Exception as e:
            logger.error(f"Error in _chat_context_manager: {e}")
            raise