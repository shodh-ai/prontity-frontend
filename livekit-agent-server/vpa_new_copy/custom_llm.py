# custom_llm.py (create this new file or add the class to your main.py)

import os
import logging
import aiohttp # Required for async HTTP requests: pip install aiohttp
from typing import AsyncIterable, Optional
from contextlib import asynccontextmanager

from livekit.agents.llm import LLM, ChatContext, ChatMessage, ChatRole, ChatChunk, ChoiceDelta
import uuid

logger = logging.getLogger(__name__)

# Get the URL of your custom backend agent from environment variables
# Example: export MY_CUSTOM_AGENT_URL="http://localhost:5005/process"
MY_CUSTOM_AGENT_URL = os.getenv("MY_CUSTOM_AGENT_URL", "http://localhost:5005/process") # Default URL

class CustomLLMBridge(LLM):
    """
    A custom LLM component that bridges to an external backend script/service.
    """
    def __init__(self, url: str = MY_CUSTOM_AGENT_URL):
        super().__init__()
        if not url:
            raise ValueError("External agent URL cannot be empty. Set MY_CUSTOM_AGENT_URL environment variable.")
        self._url = url
        logger.info(f"CustomLLMBridge initialized. Will send requests to: {self._url}")

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
                
                user_message = user_messages[0] if user_messages else None

                if not user_message or not user_message.content:
                    logger.warning("No user message found in history to send to external agent.")
                    # You might want to yield an empty response or a default message
                    yield ChatChunk(id=str(uuid.uuid4()), delta=ChoiceDelta(role='assistant', content=""))
                    return

                # Get the transcript content, handling different object structures
                transcript = ""
                try:
                    if hasattr(user_message, 'content'):
                        content = getattr(user_message, 'content')
                        # Handle both string and list content formats
                        if isinstance(content, list):
                            transcript = ' '.join(content)
                        else:
                            transcript = str(content)
                    elif isinstance(user_message, dict) and 'content' in user_message:
                        content = user_message['content']
                        if isinstance(content, list):
                            transcript = ' '.join(content)
                        else:
                            transcript = str(content)
                    else:
                        # Last resort - try to convert the whole message to a string
                        transcript = str(user_message)
                except Exception as e:
                    logger.error(f"Error extracting content from user message: {e}")
                    transcript = "[Error: Could not extract transcript]"
                
                logger.info(f"Sending transcript to external agent at {self._url}: '{transcript}'")
                # Add more verbosity to help debug
                logger.debug(f"User message object: {user_message}")
                logger.debug(f"User message type: {type(user_message)}")

                response_text = ""
                try:
                    # Use aiohttp for async HTTP requests
                    async with aiohttp.ClientSession() as session:
                        payload = {"transcript": transcript} # Send transcript as JSON
                        async with session.post(self._url, json=payload) as response:
                            response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
                            result = await response.json()
                            response_text = result.get("response", "")
                            logger.info(f"Raw response from agent: {result}")
                            logger.info(f"Extracted response_text: '{response_text}'")
                            
                            # Check for action and payload
                            action = result.get("action")
                            payload = result.get("payload")
                            logger.info(f"Extracted action: {action}, payload available: {payload is not None}")
                            
                            logger.info(f"Received response from external agent: '{response_text}'")
                            if action:
                                logger.info(f"Action received: {action} with payload: {payload}")

                except aiohttp.ClientError as e:
                    logger.error(f"Error communicating with external agent at {self._url}: {e}")
                    response_text = "Sorry, I encountered an error trying to process your request." # Error message
                except Exception as e:
                    logger.error(f"An unexpected error occurred in CustomLLMBridge: {e}")
                    response_text = "Sorry, an unexpected error occurred." # Generic error message

                # Yield the response back to the LiveKit pipeline as a single chunk
                # LiveKit expects an AsyncIterable of ChatChunk
                # Create metadata with action and payload if present
                metadata = None
                if action and payload:
                    metadata = {
                        "dom_actions": [{
                            "action": action,
                            "payload": payload
                        }]
                    }
                    logger.info(f"Created metadata: {metadata}")
                
                # Debug the outgoing chunk
                chunk_id = str(uuid.uuid4())
                logger.info(f"Creating ChatChunk with id={chunk_id}, content='{response_text[:50]}...', metadata present: {metadata is not None}")
                
                # Create and yield the chunk
                chunk = ChatChunk(
                    id=chunk_id,
                    delta=ChoiceDelta(
                        role='assistant',
                        content=response_text,
                        metadata=metadata
                    )
                )
                logger.info(f"Yielding chunk with content: '{chunk.delta.content[:50]}...'")
                yield chunk
                logger.debug("Finished yielding response from CustomLLMBridge.")
            
            # Yield the async generator
            yield response_generator()
        except Exception as e:
            logger.error(f"Error in _chat_context_manager: {e}")
            raise