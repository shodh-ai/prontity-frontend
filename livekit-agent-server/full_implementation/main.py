import os
import sys
import json
import logging
import asyncio
import argparse
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions

# Import the persona configuration module
from personas import get_persona_config

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
    def __init__(self) -> None:
        # Use the instructions from the persona configuration
        super().__init__(instructions=GLOBAL_PERSONA['instructions'])
        
        # Tools will be managed in the entrypoint function
        # Note: tools are registered in the entrypoint, not directly set here


# Global variables to store agent configuration
GLOBAL_PAGE_PATH = 'speakingpage'  # Default to speakingpage
GLOBAL_ENABLE_TOOLS = True  # Enable or disable tools

# Will be populated from personas module based on page path
GLOBAL_PERSONA = None

async def entrypoint(ctx: agents.JobContext):
    # Initialize the HTTP client for service API calls
    logger.info("Initializing HTTP client for external API calls")
    await initialize()
    
    # Use the global page path
    page_path = GLOBAL_PAGE_PATH
    
    # Get persona configuration based on page path
    global GLOBAL_PERSONA
    GLOBAL_PERSONA = get_persona_config(page_path)
    
    # Simply log the intended URL - no need to set it directly
    # The web browser will handle navigation based on the UI
    logger.info(f"Agent intended for page: http://localhost:3000/{page_path}")
    
    # Note: We don't need to set the web URL directly
    # The LiveKit client handles this automatically
    
    await ctx.connect()
    
    # We'll store this to use after session is created
    received_review_text = ""
    
    # Define a synchronous wrapper for the data handler
    def on_data_received_sync(payload, participant=None, kind=None):
        # Use a regular function (not async) for the event listener
        try:
            nonlocal received_review_text
            try:
                # Try to decode as plain text
                text = payload.decode('utf-8')
                print(f"Received data payload of {len(text)} bytes")
                
                # Try to parse as JSON if it's structured that way
                try:
                    import json
                    data = json.loads(text)
                    if isinstance(data, dict) and 'content' in data:
                        text = data['content']
                        print(f"Extracted content from JSON payload: {text[:100]}...")
                except json.JSONDecodeError:
                    # Not JSON, just use the raw text
                    print(f"Using raw text payload: {text[:100]}...")
                    
                received_review_text = text
                print(f"Successfully stored review text of length: {len(received_review_text)}")
                
                # Create a task for async work
                if session:
                    print("Session available, sending text to agent...")
                    
                    # Define an async function to be called as a task
                    async def process_text():
                        try:
                            await session.send_text(f"I've received your presentation to review with {len(text)} characters. Here's my feedback: {text}")
                        except Exception as e:
                            print(f"Error sending text to agent: {e}")
                    
                    # Create a task to run the async function
                    asyncio.create_task(process_text())
                else:
                    print("Session not available, cannot send text to agent")
            except Exception as e:
                print(f"Error processing payload: {e}")
        except Exception as outer_e:
            print(f"Outer exception in on_data_received: {outer_e}")
    
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
            voice=GLOBAL_PERSONA['voice'],
            temperature=GLOBAL_PERSONA['temperature'],
            instructions=GLOBAL_PERSONA['instructions'],
            api_key=api_key,
        )
        
        session = AgentSession(llm=model)
        logger.info("Created agent session with Google's realtime model")
    except Exception as e:
        logger.error(f"Failed to create Google realtime model: {e}")
        # Fallback to original session with commented code
        logger.warning("Agent session creation failed")
    
    # Create the agent instance with tools
    assistant = Assistant()
    
    # Not using tools - we'll use pattern matching instead
    logger.info("Using pattern matching for timer commands instead of tools")
    
    # Timer instructions are now handled by the personas module
    logger.info(f"Using persona for {GLOBAL_PAGE_PATH} with specialized instructions")
    
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
    
    # Send an initial greeting
    await session.generate_reply(
        instructions="hi. Let me introduce myself as your TOEFL speaking practice assistant."
    )
    
    try:
        # Keep the agent running until session ends or an exception occurs
        await ctx.wait_for_disconnect()
    finally:
        # Cleanup resources when the session ends
        logger.info("Cleaning up resources")
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
        logging.info(f"Using page path: {GLOBAL_PAGE_PATH}")

    # Set web URL in Chrome (currently disabled due to 'Room' object has no attribute 'client')
    # These are not used and are likely causing errors
    # try:
    #     room.client.set_web_url(f"http://localhost:3000/{GLOBAL_PAGE_PATH}")
    # except Exception as e:
    #     logging.error(f"Error setting web URL: {e}")

    logging.info(f"Agent intended for page: http://localhost:3000/{GLOBAL_PAGE_PATH}")
    
    # Initialize the persona configuration before applying overrides
    GLOBAL_PERSONA = get_persona_config(GLOBAL_PAGE_PATH)
    
    # Override specific persona settings if provided via CLI
    if args.instructions:
        GLOBAL_PERSONA['instructions'] = args.instructions
        logging.info(f"Overriding persona instructions with custom instructions")
        
    # Override voice setting if provided
    if args.voice:
        GLOBAL_PERSONA['voice'] = args.voice
        logging.info(f"Overriding persona voice with: {args.voice}")
        
    # Override temperature setting if provided
    if args.temperature is not None:
        GLOBAL_PERSONA['temperature'] = args.temperature
        logging.info(f"Overriding persona temperature with: {args.temperature}")
        
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
