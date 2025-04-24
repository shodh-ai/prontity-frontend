import os
import sys
import json
import logging
import asyncio
import argparse
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions

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
        # Use the global instructions value which can be set via CLI args
        super().__init__(instructions=GLOBAL_INSTRUCTIONS)


# Global variables to store agent configuration
GLOBAL_PAGE_PATH = 'speakingpage'  # Default to speakingpage
GLOBAL_VOICE = 'Puck'     # Default voice - Puck is compatible with gemini-2.0-flash-exp
GLOBAL_TEMPERATURE = 0.7  # Default temperature
GLOBAL_INSTRUCTIONS = 'You are a helpful assistant for TOEFL speaking practice.'  # Default instructions

async def entrypoint(ctx: agents.JobContext):
    # Use the global page path
    page_path = GLOBAL_PAGE_PATH
    
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
                            print("Successfully sent review to agent session")
                        except Exception as e:
                            print(f"Error in async handler: {e}")
                    
                    # This properly handles async code from a sync callback
                    import asyncio
                    asyncio.create_task(process_text())
                    print("Created async task for processing the review")
                else:
                    print("Session not available yet, storing for later use")
            except UnicodeDecodeError:
                print("Received binary data that couldn't be decoded as UTF-8")
        except Exception as e:
            print(f"Error processing data message: {str(e)}")
    
    # Register the synchronous event handler
    ctx.room.on('DataReceived', on_data_received_sync)
    
    # Initialize session as None first
    session = None
    
    # Create agent session using Google's realtime model
    try:
        # Get the API key from the environment
        api_key = os.environ.get('GOOGLE_API_KEY')
        if not api_key:
            logger.error("GOOGLE_API_KEY environment variable not set")
            logger.error("Please set this in your .env file")
            return
        
        # Create the model with our configuration
        model = google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",  # Use the model that was working before
            voice=GLOBAL_VOICE,
            temperature=GLOBAL_TEMPERATURE,
            instructions=GLOBAL_INSTRUCTIONS,
            api_key=api_key,
        )
        
        session = AgentSession(llm=model)
        logger.info("Created agent session with Google's realtime model")
    except Exception as e:
        logger.error(f"Failed to create Google realtime model: {e}")
        # Fallback to original session with commented code
        logger.warning("Agent session creation failed")
    
    # Start the agent session in the specified room
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )
    
    # Send an initial greeting
    await session.generate_reply(
        instructions="hi."
    )


if __name__ == "__main__":
    # Parse additional command line arguments
    parser = argparse.ArgumentParser(add_help=False)  # No help to avoid conflicts with livekit cli
    parser.add_argument('--page-path', type=str, help='Path to web page (e.g., "speakingpage")')
    parser.add_argument('--voice', type=str, help='Voice to use for the agent')
    parser.add_argument('--temperature', type=float, help='Temperature for LLM responses')
    parser.add_argument('--instructions', type=str, help='Instructions for the AI agent')
    
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
    
    # Save instructions if provided
    if args.instructions:
        GLOBAL_INSTRUCTIONS = args.instructions
        logging.info(f"Using custom instructions: {GLOBAL_INSTRUCTIONS[:50]}...")
        
    # Save voice setting if provided
    if args.voice:
        GLOBAL_VOICE = args.voice
        logging.info(f"Using voice: {GLOBAL_VOICE}")
        
    # Save temperature setting if provided
    if args.temperature is not None:
        GLOBAL_TEMPERATURE = args.temperature
        logging.info(f"Using temperature: {GLOBAL_TEMPERATURE}")
        
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
