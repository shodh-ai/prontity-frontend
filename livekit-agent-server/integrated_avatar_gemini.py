#!/usr/bin/env python3
"""
Integrated Tavus Avatar + Google Gemini LiveKit Agent

This script integrates the Tavus avatar functionality with the Google Gemini model
in a LiveKit session. It combines both implementations to create a seamless experience
where the Tavus avatar represents the Google Gemini model responses.
"""

import os
import sys
import logging
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import LiveKit components
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions, RoomOutputOptions

# Import required plugins
try:
    from livekit.plugins import noise_cancellation
    from livekit.plugins import tavus  # Import tavus for avatars
    from livekit.plugins.google.beta.realtime import RealtimeModel
except ImportError as e:
    logger.error(f"Failed to import required packages: {e}")
    logger.error("Please install the missing packages with:")
    logger.error("pip install livekit-agents~=1.0 livekit-plugins-noise-cancellation~=0.2 livekit.plugins.google python-dotenv")
    sys.exit(1)

# Find and load .env file
script_dir = Path(__file__).resolve().parent
env_path = script_dir / '.env'
if env_path.exists():
    logger.info(f"Loading environment from: {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    logger.warning(f"No .env file found at {env_path}, using environment variables")
    load_dotenv()

# Verify critical environment variables
required_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GOOGLE_API_KEY"]

# Check for Tavus credentials (optional)
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID", "")
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY", "")

# Check if Tavus is properly configured
TAVUS_ENABLED = bool(TAVUS_REPLICA_ID and TAVUS_API_KEY)
if TAVUS_ENABLED:
    logger.info("Tavus avatar configuration found")
    # Mask the API key in logs
    if TAVUS_API_KEY:
        masked_key = TAVUS_API_KEY[:4] + "*" * (len(TAVUS_API_KEY) - 8) + TAVUS_API_KEY[-4:] if len(TAVUS_API_KEY) >= 8 else "****"
        logger.info(f"Tavus API Key: {masked_key}")
    logger.info(f"Tavus Replica ID: {TAVUS_REPLICA_ID}")
    if TAVUS_PERSONA_ID:
        logger.info(f"Tavus Persona ID: {TAVUS_PERSONA_ID}")
else:
    logger.warning("Tavus avatar not configured - will not use avatar")

# Check other required environment variables
def verify_env_vars():
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            logger.error(f"Missing required environment variable: {var}")
            return False
    return True

if not verify_env_vars():
    sys.exit(1)

# Fix URL format if needed
livekit_url = os.getenv("LIVEKIT_URL")
if livekit_url:
    # Remove any double protocol prefixes
    if livekit_url.startswith("https://wss://"):
        livekit_url = livekit_url.replace("https://wss://", "wss://")
    elif livekit_url.startswith("http://ws://"):
        livekit_url = livekit_url.replace("http://ws://", "ws://")
    
    # Ensure the URL has the correct protocol
    if not (livekit_url.startswith("ws://") or livekit_url.startswith("wss://")):
        livekit_url = "wss://" + livekit_url
        
    # Update the environment variable
    os.environ["LIVEKIT_URL"] = livekit_url
    logger.info(f"Using LiveKit URL: {livekit_url}")

# Global configuration
GLOBAL_AVATAR_ENABLED = TAVUS_ENABLED  # Enable avatar if Tavus is configured
GLOBAL_PAGE_PATH = "avatar-test"  # Default page path
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_MODEL = "gemini-2.0-flash-exp"  # Default Gemini model
GLOBAL_INSTRUCTIONS = """
You are an AI assistant that helps users with their inquiries.
Be concise, informative, and friendly in your responses.
"""

class GeminiAssistant(Agent):
    """Google Gemini powered AI assistant"""
    def __init__(self) -> None:
        super().__init__(instructions=GLOBAL_INSTRUCTIONS)
        
    async def on_message(self, content, participant=None, **kwargs):
        """Process messages from users in the room."""
        sender = participant.identity if participant else "Unknown"
        logger.info(f"Message from {sender}: {content[:100]}...")
        # The messages are automatically handled by the Gemini Realtime model
        return None
        
    async def on_transcript(self, transcript: str, language: str = "en") -> None:
        """Called when a user transcript is received"""
        logger.info(f"USER SAID: '{transcript}' (language: {language})")
        
    async def on_reply(self, message: str, audio_url: str = None) -> None:
        """Override to log when assistant replies"""
        logger.info(f"ASSISTANT REPLY: '{message}'")


async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint for the agent."""
    # Get command line arguments for avatar control and page path
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--avatar', action='store_true', help='Enable Tavus avatar')
    parser.add_argument('--page-path', type=str, help='Path to web page')
    args, _ = parser.parse_known_args()
    
    # Set page path from command line if provided
    page_path = GLOBAL_PAGE_PATH
    if args.page_path:
        page_path = args.page_path
        logger.info(f"Using page path: {page_path}")
    
    # Determine if avatar should be enabled
    use_avatar = GLOBAL_AVATAR_ENABLED
    if args.avatar is not None:
        use_avatar = args.avatar
        logger.info(f"Avatar {'enabled' if use_avatar else 'disabled'} by command line arg")
    
    # Set identity BEFORE connecting to room
    # Use a consistent identity for the agent that the frontend can recognize
    agent_identity = "tavus-avatar-ai" if use_avatar else "gemini-ai-assistant"
    
    # Create the agent session
    session = AgentSession()
    
    # Connect to the room
    logger.info(f"Connecting to room: {ctx.room.name} with identity: {agent_identity}")
    
    # Create the Google Gemini Realtime model with detailed configuration
    logger.info("Setting up Google Gemini Realtime model...")
    try:
        logger.info(f"Using Google API key: {GOOGLE_API_KEY[:4]}****{GOOGLE_API_KEY[-4:] if len(GOOGLE_API_KEY) > 8 else ''}")
        logger.info(f"Using Google model: {GOOGLE_MODEL}")
        model = RealtimeModel(
            model=GOOGLE_MODEL,
            voice="male",  # You can customize the voice
            api_key=GOOGLE_API_KEY
        )
        logger.info(f"Google Gemini Realtime model created successfully: {model.__class__.__name__}")
    except Exception as e:
        logger.error(f"Failed to set up Google Gemini Realtime model: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        sys.exit(1)
    
    # Create the assistant
    assistant = GeminiAssistant()
    
    # Set up avatar if enabled
    avatar_session = None
    if use_avatar and TAVUS_ENABLED:
        logger.info("Setting up Tavus avatar...")
        try:
            os.environ["TAVUS_API_KEY"] = TAVUS_API_KEY
            
            # Set up Tavus avatar session
            avatar_config = {
                "replica_id": TAVUS_REPLICA_ID
            }
            if TAVUS_PERSONA_ID:
                avatar_config["persona_id"] = TAVUS_PERSONA_ID
                
            # Create avatar session with proper initialization
            logger.info(f"Creating Tavus avatar session with config: {avatar_config}")
            try:
                # Ensure TAVUS_API_KEY is set in environment (required by the plugin)
                os.environ["TAVUS_API_KEY"] = TAVUS_API_KEY
                
                # Create the avatar session
                avatar_session = tavus.AvatarSession(**avatar_config)
                logger.info("Tavus avatar session created successfully")
                
                # Check if avatar session has expected attributes
                expected_methods = ['start', 'stop', 'publish_video', 'publish_audio']
                for method in expected_methods:
                    if hasattr(avatar_session, method):
                        logger.info(f"Avatar session has method: {method}")
                    else:
                        logger.warning(f"Avatar session MISSING method: {method}")
            except Exception as e:
                logger.error(f"Failed to create Tavus avatar session: {e}")
                raise
            
            # Start the avatar session
            logger.info("Starting Tavus avatar session...")
            try:
                await avatar_session.start(session=session, room=ctx.room)
                logger.info("Tavus avatar session started successfully")
                
                # Explicitly publish audio/video tracks if available
                if hasattr(avatar_session, 'publish_video'):
                    logger.info("Publishing avatar video track...")
                    await avatar_session.publish_video()
                    logger.info("Avatar video track published successfully")
                else:
                    logger.warning("No publish_video method available on avatar session")
                    
                if hasattr(avatar_session, 'publish_audio'):
                    logger.info("Publishing avatar audio track...")
                    await avatar_session.publish_audio()
                    logger.info("Avatar audio track published successfully")
                else:
                    logger.warning("No publish_audio method available on avatar session")
            except Exception as e:
                logger.error(f"Error starting Tavus avatar session: {e}")
                raise
        except Exception as e:
            logger.error(f"Failed to set up Tavus avatar: {e}")
            logger.error(f"Error type: {type(e).__name__}, details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            avatar_session = None
    
    try:
        # Start the agent session
        logger.info("Starting agent session...")
        
        # Set agent identity explicitly before starting session if using Tavus avatar
        if avatar_session and hasattr(ctx.room, 'local_participant'):
            logger.info(f"Setting local participant identity to: tavus-avatar-ai")
            ctx.room.local_participant.identity = "tavus-avatar-ai"
        
        # Start the agent session with detailed configuration
        logger.info(f"Starting agent session with model: {model.__class__.__name__ if model else 'None'}")
        
        try:
            # Different versions of LiveKit have different API requirements
            # The 'model' parameter might not be accepted by session.start()
            # Let's dynamically configure our agent with the model
            
            # Here's how to configure the agent with the Google Gemini model
            assistant.model = model
            
            # Start the session without the 'model' parameter
            await session.start(
                room=ctx.room,
                agent=assistant,
                room_input_options=RoomInputOptions(
                    noise_cancellation=noise_cancellation.BVC(),
                ),
                room_output_options=RoomOutputOptions(
                    # Disable audio output if using avatar - it will publish its own audio
                    audio_enabled=not avatar_session,
                ),
            )
            logger.info("Agent session started successfully with the following configuration:")
            logger.info(f"- Using Tavus avatar: {bool(avatar_session)}")
            logger.info(f"- Room name: {ctx.room.name}")
            logger.info(f"- Audio enabled: {not bool(avatar_session)}")
        except Exception as e:
            logger.error(f"Failed to start agent session: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
        
        logger.info("Agent session started successfully")
        
        # Send a greeting
        logger.info("Sending greeting...")
        try:
            await session.generate_reply(
                instructions="Greet the user with a simple hello and introduce yourself as a voice assistant powered by Google Gemini."
            )
            logger.info("Greeting sent successfully")
        except Exception as e:
            logger.error(f"Failed to send greeting: {e}")
        
        logger.info("Integrated Tavus + Gemini agent is running")
        
        # Keep the agent running until interrupted
        try:
            disconnect_future = asyncio.Future()
            await disconnect_future
        except asyncio.CancelledError:
            logger.info("Agent canceled")
    except Exception as e:
        logger.error(f"Error in entrypoint: {e}")
    finally:
        # Clean up avatar if it was started
        if avatar_session:
            try:
                await avatar_session.stop()
                logger.info("Tavus avatar session stopped")
            except Exception as e:
                logger.error(f"Failed to stop avatar session: {e}")


if __name__ == "__main__":
    # Parse command line arguments without affecting LiveKit's argument parsing
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--avatar', action='store_true', help='Enable Tavus avatar')
    parser.add_argument('--page-path', type=str, help='Path to web page')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    # Extract our custom arguments
    args, _ = parser.parse_known_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.setLevel(logging.DEBUG)
    
    # Remove our custom arguments from sys.argv
    filtered_argv = [sys.argv[0]]
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg in ['--avatar']:
            i += 1  # Skip the flag
        elif arg in ['--page-path'] and i + 1 < len(sys.argv):
            i += 2  # Skip the flag and its value
        elif arg in ['--verbose', '-v']:
            i += 1  # Skip the flag
        else:
            filtered_argv.append(arg)
            i += 1
    
    # Replace sys.argv with filtered version
    sys.argv = filtered_argv
    
    # Run the agent with the standard CLI interface
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint
        )
    )
