import os
import sys
import json
import logging
import asyncio
import argparse
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions

# Import the YAML-based configuration loader
from agent_config_loader import (
    get_persona_config_by_identity,
    get_persona_config_for_page,
    get_tools_for_identity,
    PersonaConfig
)

# Import the Gemini client module
from ai.gemini_client import (
    get_or_create_session_state,
    remove_session_state,
    initialize_gemini_model,
    register_tools_with_model,
    reinitialize_chat
)

# Import the tool dispatcher
from tools.tool_dispatcher import process_tool_call

# Import services modules
from services.http_client import initialize, close
from services import canvas_client, content_client, user_progress_client

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import plugins that are actually installed
try:
    from livekit.plugins import noise_cancellation
    from livekit.plugins import google  # For Google's realtime model
    # Optional imports - will be skipped if not available
    try:
        from livekit.plugins.turn_detector.multilingual import MultilingualModel
    except ImportError:
        logger.warning("MultilingualModel not available, will not use turn detection")
        MultilingualModel = None
except ImportError as e:
    logger.error(f"Failed to import required packages: {e}")
    logger.error("Please install the missing packages")
    sys.exit(1)

# Load environment variables from .env file
load_dotenv()

# Verify environment variables
required_env_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]
for var in required_env_vars:
    if not os.getenv(var):
        logger.error(f"Missing required environment variable: {var}")
        logger.error(f"Current value: {os.getenv(var)}")


class Assistant(Agent):
    def __init__(self, persona_config: Optional[PersonaConfig] = None) -> None:
        # Use the instructions from the persona configuration
        instructions = persona_config.instructions if persona_config else "You are a helpful assistant."
        super().__init__(instructions=instructions)
        
        # Tools will be managed in the entrypoint function
        # Note: tools are registered in the entrypoint, not directly set here


# Global variables to store agent configuration
# These must be accessible from all processes
GLOBAL_PAGE_PATH = "vocabpage"  # Default to vocabpage
GLOBAL_ENABLE_TOOLS = True  # Enable or disable tools
GLOBAL_PERSONA_CONFIG = None  # Will be populated from agent_config_loader

async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint for the agent."""
    # Access global variables
    global GLOBAL_PAGE_PATH, GLOBAL_PERSONA_CONFIG, GLOBAL_ENABLE_TOOLS
    
    # Log agent connection information
    logger.info(f"Connected to LiveKit room '{ctx.room.name}'")
    
    # Initialize the HTTP client for service API calls
    logger.info("Initializing HTTP client for external API calls")
    await initialize()
    
    # Use the global page path
    page_path = GLOBAL_PAGE_PATH
    
    # Debug page being used
    logger.info(f"Agent intended for page: http://localhost:3000/{page_path}")
    
    if page_path is None:
        # This shouldn't happen, but let's be defensive
        logger.error("GLOBAL_PAGE_PATH is None in entrypoint, this is a bug!")
        # Set a default value to avoid crashes
        page_path = "vocabpage"  # Default to vocabpage as requested
        GLOBAL_PAGE_PATH = page_path
        logger.warning(f"Setting default page_path to: {page_path}")
    
    # Get persona configuration based on page path
    global GLOBAL_PERSONA_CONFIG
    GLOBAL_PERSONA_CONFIG = get_persona_config_for_page(page_path)
    
    # Force-reload the correct persona for the actual page path to avoid any inconsistencies
    GLOBAL_PERSONA_CONFIG = get_persona_config_for_page(page_path)
    logger.info(f"Using persona '{GLOBAL_PERSONA_CONFIG.identity}' from page_path: {page_path}")
    
    # Log the loaded persona configuration
    logger.info(f"Using persona '{GLOBAL_PERSONA_CONFIG.identity}' for page '{page_path}'")
    logger.info(f"Persona allows tools: {GLOBAL_PERSONA_CONFIG.allowed_tools}")
    
    # Note: We don't need to set the web URL directly
    # The LiveKit client handles this automatically
    
    await ctx.connect()
    
    # We'll store this to use after session is created
    received_review_text = ""
    
    # Helper function to handle context changes from frontend
    async def handle_context_change(page_type, task_id=None, persona_identity=None):
        try:
            logger.info(f"Context change requested: page={page_type}, task={task_id}, persona={persona_identity}")
            
            # Determine which persona to use based on provided identity or page type
            persona_config = None
            if persona_identity:
                # Try to get specific persona by identity
                persona_config = get_persona_config_by_identity(persona_identity)
                if persona_config:
                    logger.info(f"Using specifically requested persona: {persona_identity}")
                else:
                    logger.warning(f"Requested persona '{persona_identity}' not found, falling back to page-based selection")
            
            # If no specific persona was found, use page-type based selection
            if not persona_config:
                persona_config = get_persona_config_for_page(page_type)
                logger.info(f"Selected persona '{persona_config.identity}' for page type '{page_type}'")
            
            # Get tools for this persona
            if GLOBAL_ENABLE_TOOLS:
                tools = get_tools_for_identity(persona_config.identity)
                tool_names = [getattr(tool, 'name', str(tool)) for tool in tools]
                logger.info(f"Loaded {len(tools)} tools for persona {persona_config.identity}: {tool_names}")
            else:
                tools = []
                logger.info("Tools are disabled for this session")
            
            # Update session state with new configuration
            if session:
                # Get or create session state
                session_state = get_or_create_session_state(ctx.room.name, session)
                
                # Update session state
                session_state.update_persona_config(persona_config)
                session_state.update_page_type(page_type)
                
                # Update GLOBAL variables to maintain consistency
                global GLOBAL_PAGE_PATH, GLOBAL_PERSONA_CONFIG
                GLOBAL_PAGE_PATH = page_type
                GLOBAL_PERSONA_CONFIG = persona_config
                logger.info(f"Updated global configuration to: page={page_type}, persona={persona_config.identity}")
                
                # Register tools with the model
                if tools:
                    await register_tools_with_model(session_state, tools)
                
                # Reinitialize the chat with new settings
                await reinitialize_chat(session_state)
                
                # Notify the user about the context change
                await session.send_text(f"I'm now helping you with the {page_type} task.")
                
                return True
            else:
                logger.error("Cannot handle context change: No active session")
                return False
                
        except Exception as e:
            logger.error(f"Error handling context change: {e}")
            return False
            
    # Define a synchronous wrapper for the data handler
    def on_data_received_sync(payload, participant=None, kind=None):
        # Use a regular function (not async) for the event listener
        try:
            nonlocal received_review_text
            try:
                # Try to decode as plain text
                text = payload.decode('utf-8')
                logger.debug(f"Received data payload of {len(text)} bytes")
                
                # Try to parse as JSON
                try:
                    data = json.loads(text)
                    
                    # Handle context change messages
                    if isinstance(data, dict) and data.get('type') == 'CHANGE_CONTEXT':
                        logger.info("Received CHANGE_CONTEXT message")
                        
                        # Extract context data
                        payload = data.get('payload', {})
                        page_type = payload.get('pageType')
                        task_id = payload.get('taskId')
                        persona_identity = payload.get('personaIdentity')
                        
                        # Create a task to handle the context change
                        if page_type:
                            asyncio.create_task(handle_context_change(page_type, task_id, persona_identity))
                        else:
                            logger.error("Missing pageType in CHANGE_CONTEXT message")
                        return
                    
                    # Handle the original content extraction logic
                    elif isinstance(data, dict) and 'content' in data:
                        text = data['content']
                        logger.debug(f"Extracted content from JSON payload: {text[:100]}...")
                except json.JSONDecodeError:
                    # Not JSON, just use the raw text
                    logger.debug(f"Using raw text payload: {text[:100]}...")
                    
                received_review_text = text
                logger.debug(f"Successfully stored review text of length: {len(received_review_text)}")
                
                # Create a task for async work (original behavior)
                if session:
                    logger.debug("Session available, sending text to agent...")
                    
                    # Define an async function to be called as a task
                    async def process_text():
                        try:
                            await session.send_text(f"I've received your presentation to review with {len(text)} characters. Here's my feedback: {text}")
                        except Exception as e:
                            logger.error(f"Error sending text to agent: {e}")
                    
                    # Create a task to run the async function
                    asyncio.create_task(process_text())
                else:
                    logger.warning("Session not available, cannot send text to agent")
            except Exception as e:
                logger.error(f"Error processing payload: {e}")
        except Exception as outer_e:
            logger.error(f"Outer exception in on_data_received: {outer_e}")
    
    # Register the data handler
    ctx.room.on("data", on_data_received_sync)
    
    # Create the session
    session = None
    
    # Get Google API key from environment
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        logger.error("GOOGLE_API_KEY is not set in the environment")
        logger.warning("Agent session creation may fail without a valid API key")
    
    # Create the session with the Google realtime model
    try:
        logger.info("Using LiveKit URL: %s", os.environ.get("LIVEKIT_URL"))
        
        if not api_key:
            logger.error("Creating session without API key (expected to fail)")
            return
        
        # Create the model with our configuration
        model = google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",  # Use the model that was working before
            voice=GLOBAL_PERSONA_CONFIG.voice,
            temperature=GLOBAL_PERSONA_CONFIG.temperature,
            instructions=GLOBAL_PERSONA_CONFIG.instructions,
            api_key=api_key,
        )
        
        session = AgentSession(llm=model)
        logger.info("Created agent session with Google's realtime model")
        
        # Initialize session state
        session_state = get_or_create_session_state(ctx.room.name, session)
        session_state.update_persona_config(GLOBAL_PERSONA_CONFIG)
        
        # Make sure we're using the correct global page path
        # Check if GLOBAL_PAGE_PATH is still None - which shouldn't happen
        if GLOBAL_PAGE_PATH is None:
            logger.error("Critical error: GLOBAL_PAGE_PATH is None in session initialization")
            GLOBAL_PAGE_PATH = "vocabpage"  # Set to vocabpage as requested
            logger.warning(f"Force-setting GLOBAL_PAGE_PATH to: {GLOBAL_PAGE_PATH}")
            
        session_state.update_page_type(GLOBAL_PAGE_PATH)
        logger.info(f"Setting session page type to: {GLOBAL_PAGE_PATH}")
        
        # Register tools if enabled
        if GLOBAL_ENABLE_TOOLS:
            tools = get_tools_for_identity(GLOBAL_PERSONA_CONFIG.identity)
            if tools:
                await register_tools_with_model(session_state, tools)
                logger.info(f"Registered {len(tools)} tools with Gemini model")
    except Exception as e:
        logger.error(f"Failed to create Google realtime model: {e}")
        # Fallback to original session with commented code
        logger.warning("Agent session creation failed")
    
    # Create the agent instance with tools
    assistant = Assistant(GLOBAL_PERSONA_CONFIG)
    
    # Log whether we're using tools or pattern matching
    if GLOBAL_ENABLE_TOOLS and GLOBAL_PERSONA_CONFIG.allowed_tools:
        logger.info(f"Using tool calling for {GLOBAL_PERSONA_CONFIG.allowed_tools}")
    else:
        logger.info("Using pattern matching for commands instead of tools")
    
    # Log persona details
    logger.info(f"Using persona '{GLOBAL_PERSONA_CONFIG.identity}' for {page_path}")
    
    # Start the agent session in the specified room
    # Note: Not using tools since they aren't supported in the current API
    await session.start(
        room=ctx.room,
        agent=assistant,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )
    
    logger.info("Agent started - using data messages for timer control")
    
    # Send initial message about the alternative timer approach
    logger.info("Note: Using data messages instead of tools for timer functionality")
    
    # Define helper function to send timer commands via data messages
    async def send_timer_command(action, duration=None, message=None):
        try:
            timer_command = {
                "type": "timer",
                "action": action
            }
            
            if action == "start":
                timer_command["mode"] = "preparation" if duration == 15 else "speaking"
                timer_command["duration"] = duration
                if message:
                    timer_command["message"] = message
            
            # Send the command as a data message
            await ctx.room.local_participant.publish_data(json.dumps(timer_command).encode())
            logger.info(f"Sent timer command: {action} {f'for {duration}s' if duration else ''}")
            return True
        except Exception as e:
            logger.error(f"Error sending timer command: {e}")
            return False
    
    # Add a text message handler to detect timer commands in AI responses
    import re
    
    async def on_llm_message(message):
        # If this is a message from the AI, check for timer commands
        if message is not None and hasattr(message, 'text'):
            text = message.text.lower()
            logger.info(f"Processing AI message for timer commands: {text[:50]}...")
            
            # Check for preparation timer patterns
            prep_patterns = [
                r"start.*preparation timer",
                r"begin.*preparation",
                r"\d+ seconds to prepare",
                r"prepare for \d+ seconds"
            ]
            
            # Check for speaking timer patterns
            speaking_patterns = [
                r"start.*speaking timer", 
                r"begin.*speaking",
                r"speak for \d+ seconds",
                r"\d+ seconds to speak"
            ]
            
            # Check for timer stop patterns
            stop_patterns = [
                r"stop.*timer",
                r"end.*timer",
                r"time('s)? up"
            ]
            
            # Check for preparation timer
            for pattern in prep_patterns:
                if re.search(pattern, text):
                    logger.info("Detected preparation timer command")
                    await send_timer_command("start", 15, "Preparation Time")
                    return
            
            # Check for speaking timer
            for pattern in speaking_patterns:
                if re.search(pattern, text):
                    logger.info("Detected speaking timer command")
                    await send_timer_command("start", 45, "Speaking Time")
                    return
            
            # Check for timer stop
            for pattern in stop_patterns:
                if re.search(pattern, text):
                    logger.info("Detected timer stop command")
                    await send_timer_command("stop")
                    return
    
    # Make sure we have a valid handler binding
    try:
        # Some versions use this API
        session.on_llm_message(on_llm_message)
        logger.info("Registered message handler with on_llm_message")
    except Exception as e:
        logger.error(f"Error registering message handler: {e}")
        try:
            # Alternative API for some versions
            session.llm.on_message(on_llm_message)
            logger.info("Registered message handler with llm.on_message")
        except Exception as e2:
            logger.error(f"Error registering alternative message handler: {e2}")
    
    # Handle function (tool) calling
    async def on_function_call(data):
        try:
            logger.info(f"Received function call: {data.get('name')}")
            # Process the tool call using our dispatcher
            result = await process_tool_call(session, data)
            logger.info(f"Tool call result: {result}")
            return result
        except Exception as e:
            logger.error(f"Error handling function call: {e}")
            return {
                "name": data.get("name", "unknown"),
                "response": {
                    "success": False,
                    "message": f"Error: {str(e)}"
                }
            }
    
    # Register function call handler
    if GLOBAL_ENABLE_TOOLS:
        try:
            session.on_function_call(on_function_call)
            logger.info("Registered function call handler")
        except Exception as e:
            logger.error(f"Failed to register function call handler: {e}")
    
    # Send an initial greeting appropriate for the current persona
    await session.generate_reply(
        instructions=f"hi. Let me introduce myself as your {GLOBAL_PAGE_PATH} assistant."
    )
    
    try:
        # Keep the agent running until session ends or an exception occurs
        # Different LiveKit versions use different methods for waiting
        try:
            # Try newer method first
            await ctx.wait_for_disconnect()
        except (AttributeError, TypeError):
            # Fall back to alternative approach
            logger.info("Using alternative wait mechanism")
            # Create a future that never completes unless cancelled
            disconnect_future = asyncio.Future()
            
            # Create a handler to cancel the future when the room disconnects
            def on_room_disconnect(*args, **kwargs):
                if not disconnect_future.done():
                    disconnect_future.set_result(None)
            
            # Register the disconnect handler if possible
            try:
                ctx.room.on("disconnected", on_room_disconnect)
            except Exception as e:
                logger.warning(f"Could not register disconnect handler: {e}")
            
            # Wait until the future is cancelled or completed
            try:
                await disconnect_future
            except asyncio.CancelledError:
                logger.info("Wait future cancelled")
    except Exception as e:
        logger.error(f"Error in room connection: {e}")
    finally:
        # Cleanup resources when the session ends
        logger.info("Cleaning up resources")
        # Remove session state
        remove_session_state(ctx.room.name)
        # Close HTTP client
        await close()


if __name__ == "__main__":
    # Parse additional command line arguments
    parser = argparse.ArgumentParser(add_help=False)  # No help to avoid conflicts with livekit cli
    parser.add_argument('--page-path', type=str, help='Path to web page (e.g., "speakingpage")')
    parser.add_argument('--voice', type=str, help='Override the voice from persona config')
    parser.add_argument('--temperature', type=float, help='Override the temperature from persona config')
    parser.add_argument('--instructions', type=str, help='Override the instructions from persona config')
    parser.add_argument('--no-tools', action='store_true', help='Disable tools for the agent')
    
    # Parse known args without raising error for unknown args
    args, remaining = parser.parse_known_args()
    
    # Set up agent configuration from command line arguments
    if args.page_path:
        GLOBAL_PAGE_PATH = args.page_path
        logging.info(f"Using page path from CLI args: {GLOBAL_PAGE_PATH}")
    else:
        # If no page path is provided, default to vocabpage as requested
        GLOBAL_PAGE_PATH = "vocabpage"
        logging.info(f"No page path provided, defaulting to: {GLOBAL_PAGE_PATH}")

    # Set web URL in Chrome (currently disabled due to 'Room' object has no attribute 'client')
    # These are not used and are likely causing errors
    # try:
    #     room.client.set_web_url(f"http://localhost:3000/{GLOBAL_PAGE_PATH}")
    # except Exception as e:
    #     logging.error(f"Error setting web URL: {e}")

    logging.info(f"Agent intended for page: http://localhost:3000/{GLOBAL_PAGE_PATH}")
    
    # Initialize the persona configuration before applying overrides
    if not GLOBAL_PAGE_PATH:
        logger.error("No page path specified! Defaulting to vocabpage")
        GLOBAL_PAGE_PATH = "vocabpage"  # Default to vocabpage as requested
    
    GLOBAL_PERSONA_CONFIG = get_persona_config_for_page(GLOBAL_PAGE_PATH)
    logger.info(f"Initial configuration with persona '{GLOBAL_PERSONA_CONFIG.identity}' for page '{GLOBAL_PAGE_PATH}'")
    
    # Create a copy of the config that we can modify
    config_dict = GLOBAL_PERSONA_CONFIG.to_dict()
    
    # Override specific persona settings if provided via CLI
    if args.instructions:
        config_dict['instructions'] = args.instructions
        logging.info(f"Overriding persona instructions with custom instructions")
        
    # Override voice setting if provided
    if args.voice:
        config_dict['voice'] = args.voice
        logging.info(f"Overriding persona voice with: {args.voice}")
        
    # Override temperature setting if provided
    if args.temperature is not None:
        config_dict['parameters'] = config_dict.get('parameters', {})
        config_dict['parameters']['temperature'] = args.temperature
        logging.info(f"Overriding persona temperature with: {args.temperature}")
        
    # Create a new PersonaConfig with the overridden values
    GLOBAL_PERSONA_CONFIG = PersonaConfig(config_dict)
        
    # Disable tools if requested
    if args.no_tools:
        GLOBAL_ENABLE_TOOLS = False
        logging.info("Tools are disabled for this session")
        
    # Update sys.argv to remove our custom args before passing to LiveKit CLI
    sys.argv = [sys.argv[0]] + remaining
    
    # Get LiveKit credentials from environment variables
    livekit_url = os.getenv("LIVEKIT_URL")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
    
    # Verify that the credentials are available
    if not livekit_url or not livekit_api_key or not livekit_api_secret:
        logger.error("LiveKit credentials are missing from environment variables")
        logger.error("Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in your .env file")
        sys.exit(1)
        
    logger.info(f"Using LiveKit URL: {livekit_url}")
    
    # Set the environment variables explicitly
    os.environ["LIVEKIT_URL"] = livekit_url
    os.environ["LIVEKIT_API_KEY"] = livekit_api_key
    os.environ["LIVEKIT_API_SECRET"] = livekit_api_secret
    
    # Run the agent with the standard CLI interface
    # We've already handled our custom args, so just pass the entrypoint
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint
        )
    )
