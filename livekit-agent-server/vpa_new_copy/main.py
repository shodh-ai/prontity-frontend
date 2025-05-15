#!/usr/bin/env python3
"""
LiveKit Voice Processing Agent (VPA) Implementation

This script implements a simple LiveKit voice agent using the VPA pipeline with Deepgram STT and TTS.
"""

import os
import sys
import logging
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import json

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import LiveKit components
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions

# Import VPA pipeline components
try:
    from livekit.plugins import noise_cancellation
    from livekit.plugins import deepgram, openai, silero
    from livekit.plugins.turn_detector.multilingual import MultilingualModel
    from livekit.plugins import tavus # Import tavus for avatars
except ImportError as e:
    logger.error(f"Failed to import required packages: {e}")
    logger.error("Please install the missing packages: pip install 'livekit-agents[deepgram,openai,silero,turn-detector]~=1.0' 'livekit-plugins-noise-cancellation~=0.2' python-dotenv")
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
required_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "OPENAI_API_KEY", "DEEPGRAM_API_KEY"]

# Check for Tavus credentials (optional)
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID", "")
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY", "")

# Check if Tavus is properly configured
TAVUS_ENABLED = bool(TAVUS_REPLICA_ID and TAVUS_PERSONA_ID and TAVUS_API_KEY)
if TAVUS_ENABLED:
    logger.info("Tavus avatar configuration found")
    # Mask the API key in logs
    if TAVUS_API_KEY:
        masked_key = TAVUS_API_KEY[:4] + "*" * (len(TAVUS_API_KEY) - 8) + TAVUS_API_KEY[-4:]
        logger.info(f"Tavus API Key: {masked_key}")
    logger.info(f"Tavus Replica ID: {TAVUS_REPLICA_ID}")
    logger.info(f"Tavus Persona ID: {TAVUS_PERSONA_ID}")
else:
    logger.warning("Tavus avatar not configured - will not use avatar")
for var in required_vars:
    value = os.getenv(var)
    if not value:
        logger.error(f"Missing required environment variable: {var}")
        sys.exit(1)
    if var == "DEEPGRAM_API_KEY":
        logger.info(f"DEEPGRAM_API_KEY: {value[:8]}...{value[-4:]} (length: {len(value)})")

# Global configuration
GLOBAL_PAGE_PATH = "speakingpage"  # Default to speakingpage
GLOBAL_MODEL = "aura-asteria-en"    # Default Deepgram TTS model
GLOBAL_TEMPERATURE = 0.7            # Default temperature
GLOBAL_INSTRUCTIONS = "You are a helpful voice AI assistant. Be concise but thorough in your responses."

# Avatar configuration
GLOBAL_AVATAR_ENABLED = TAVUS_ENABLED  # Enable avatar if Tavus is configured


class Assistant(Agent):
    """Simple voice AI assistant"""
    def __init__(self) -> None:
        super().__init__(instructions=GLOBAL_INSTRUCTIONS)
        
    async def on_transcript(self, transcript: str, language: str) -> None:
        """Called when a user transcript is received"""
        logger.info(f"USER SAID: '{transcript}' (language: {language})")
        
    async def on_reply(self, message: str, audio_url: str = None) -> None:
        """Override to log when assistant replies"""
        logger.info(f"ASSISTANT REPLY: '{message}'")
        if audio_url:
            logger.info(f"AUDIO URL: {audio_url}")
        else:
            logger.warning("NO AUDIO URL PROVIDED - Speech not generated!")


async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint for the agent."""
    # Set identity BEFORE connecting to room
    # Use a consistent identity for the agent that the frontend can recognize
    if GLOBAL_AVATAR_ENABLED:
        ctx.identity = "tavus-avatar-agent"
        logger.info(f"Set agent identity to: {ctx.identity}")
    else:
        # Generate a random ID suffix
        import uuid
        id_suffix = uuid.uuid4().hex[:12]
        ctx.identity = f"simulated-agent-{id_suffix}"
        logger.info(f"Set agent identity to: {ctx.identity}")
    
    # Connect to the room
    try:
        await ctx.connect()
        logger.info(f"Connected to LiveKit room '{ctx.room.name}' as {ctx.identity}")
    except Exception as e:
        logger.error(f"Failed to connect to LiveKit room: {e}")
        return
        
    # Set up Tavus avatar if enabled
    avatar_session = None
    if GLOBAL_AVATAR_ENABLED:
        try:
            logger.info("Setting up Tavus avatar...")
            logger.info(f"Tavus credentials: API_KEY={TAVUS_API_KEY[:4]}...{TAVUS_API_KEY[-4:] if TAVUS_API_KEY else 'Not Set'}, "
                      f"REPLICA_ID={TAVUS_REPLICA_ID}, PERSONA_ID={TAVUS_PERSONA_ID}")
            
            # Check if we have all required credentials
            if not TAVUS_API_KEY or not TAVUS_REPLICA_ID:
                logger.error("Missing required Tavus credentials! Cannot create avatar.")
                raise ValueError("Missing required Tavus credentials")
            
            # Configure Tavus with API key
            os.environ["TAVUS_API_KEY"] = TAVUS_API_KEY
            
            # Create avatar session with additional configuration
            try:
                # Import the PublishOptions if available
                try:
                    from livekit.rtc import PublishOptions, VideoPublishOptions, AudioPublishOptions
                    has_publish_options = True
                    logger.info("Found PublishOptions class, will use it for enhanced video publishing")
                except ImportError:
                    has_publish_options = False
                    logger.warning("PublishOptions class not found in LiveKit SDK, using basic options")
                
                # Set up avatar configuration options with video settings
                avatar_config = {
                    "video": {
                        "enabled": True,     # Ensure video is enabled
                        "width": 640,        # Set video width
                        "height": 480,       # Set video height
                        "framerate": 30,     # Set framerate
                        "quality": "high",  # Request high quality
                    },
                    "publish_video": True,    # Explicitly enable video publishing
                    "publish_audio": True,    # Explicitly enable audio publishing
                    "simulcast": True,       # Enable simulcast for better quality
                    "priority": "high"      # Set high priority for this track
                }
                
                # If PublishOptions is available, create explicit options
                if has_publish_options:
                    # Create video options with higher quality settings
                    video_options = VideoPublishOptions(
                        simulcast=True,      # Enable simulcast
                        width=640,           # Set resolution width
                        height=480,          # Set resolution height
                        frame_rate=30,       # Set frame rate
                        encoding_bitrate=1500000,  # Increase bitrate for better quality
                    )
                    
                    # Create audio options
                    audio_options = AudioPublishOptions(
                        enabled=True,
                    )
                    
                    # Create overall publish options
                    publish_options = PublishOptions(
                        video=video_options,
                        audio=audio_options,
                    )
                    
                    # Add to avatar config
                    avatar_config["publish_options"] = publish_options
                
                # Create avatar session with minimal parameters to avoid errors
                # Removed avatar_config parameter that was causing errors
                avatar_session = tavus.AvatarSession(
                    replica_id=TAVUS_REPLICA_ID,  # ID of the Tavus replica to use
                    persona_id=TAVUS_PERSONA_ID if TAVUS_PERSONA_ID else None,  # Optional persona ID
                )
                logger.info("Tavus avatar session created successfully with minimal parameters")
                
                # Identity was already set at the start of the function, so we'll leave it as is
                # Just log the current identity for debugging
                logger.info(f"Current agent identity: {ctx.identity}")
                
                # Test avatar session capabilities
                if hasattr(avatar_session, 'get_capabilities'):
                    capabilities = avatar_session.get_capabilities()
                    logger.info(f"Avatar capabilities: {capabilities}")
                else:
                    logger.info("Avatar session does not have get_capabilities method")
                
            except TypeError as type_error:
                logger.error(f"Tavus API parameter error: {type_error}")
                # Try with minimal parameters
                logger.info("Trying with minimal parameters...")
                avatar_session = tavus.AvatarSession(
                    replica_id=TAVUS_REPLICA_ID
                )
                logger.info("Tavus avatar session created with minimal parameters")
        except Exception as e:
            logger.error(f"Failed to set up Tavus avatar: {e}")
            logger.error(f"Error type: {type(e).__name__}, details: {str(e)}")
            avatar_session = None
    
    # Log configuration
    logger.info(f"Using Deepgram TTS model: {GLOBAL_MODEL}")
    logger.info(f"Using temperature: {GLOBAL_TEMPERATURE}")
    
    # Create an assistant instance
    assistant = Assistant()
    
    try:
        # Create the agent session with the VPA pipeline
        logger.info("Creating agent session with VPA pipeline...")
        session = AgentSession(
            # Use Deepgram for both STT and TTS
            stt=deepgram.STT(model="nova-3", language="multi"),
            llm=openai.LLM(
                model="gpt-4o-mini", 
                temperature=GLOBAL_TEMPERATURE,
            ),
            # Use standard Deepgram TTS without custom options
            # Removed voice and sample_rate parameters that caused errors
            tts=deepgram.TTS(model=GLOBAL_MODEL),
            vad=silero.VAD.load(),
            turn_detection=MultilingualModel(),
        )
        logger.info("Agent session created successfully")
        
        # Start avatar session if enabled
        if avatar_session:
            try:
                logger.info("Starting avatar session with room")
                
                # Enable detailed logging for Tavus debugging
                tavus_logger = logging.getLogger('tavus')
                tavus_logger.setLevel(logging.DEBUG)
                
                # Get available methods on avatar_session
                avatar_methods = [method for method in dir(avatar_session) if not method.startswith('__')]
                logger.info(f"Available avatar methods: {avatar_methods}")
                
                # Inspect room details before avatar start
                logger.info(f"Room details before avatar start: name={ctx.room.name}, sid={ctx.room.sid}")
                
                # Ensure the avatar joins the room and publishes its video track
                logger.info("Calling avatar_session.start()...")
                await avatar_session.start(session, room=ctx.room)
                logger.info("Avatar session start() completed successfully")
                
                # Verify that the avatar is publishing a video track
                logger.info("Getting room participants after avatar start...")
                # Fix: Use get_participants() method instead of accessing participants property
                participants = []
                try:
                    if hasattr(ctx.room, 'get_participants'):
                        participants = await ctx.room.get_participants()
                    elif hasattr(ctx.room, 'participants') and ctx.room.participants is not None:
                        participants = list(ctx.room.participants.values())
                    else:
                        logger.warning("No method to access participants found in Room object")
                except Exception as e:
                    logger.error(f"Error accessing participants: {e}")
                    
                logger.info(f"Room participants: {[p.identity for p in participants] if participants else 'None'}")
                
                # Check if tavus-avatar-agent is publishing a video track
                # If not, try to force the avatar to publish a video track
                has_video_track = False
                for p in participants:
                    if p.identity == 'tavus-avatar-agent':
                        logger.info(f"Found avatar participant: {p.identity}")
                        for track in p.tracks:
                            logger.info(f"Avatar track: {track.kind}, {track.source}")
                            if track.kind == 'video':
                                has_video_track = True
                
                if not has_video_track:
                    logger.warning("Avatar is not publishing a video track, attempting to force publish...")
                    try:
                        # Try to republish the avatar's video track
                        if hasattr(avatar_session, 'publish_video'):
                            logger.info("Calling avatar_session.publish_video()...")
                            await avatar_session.publish_video()
                            logger.info("publish_video() called successfully")
                        else:
                            logger.warning("Avatar session does not have publish_video method")
                    except Exception as e:
                        logger.error(f"Error forcing video publish: {e}")
                
                logger.info("Avatar setup completed, video track should be available")
                
                # Log information about the avatar's tracks again after setup
                # to verify if video track is now available
                participants = []
                try:
                    if hasattr(ctx.room, 'get_participants'):
                        participants = await ctx.room.get_participants()
                    elif hasattr(ctx.room, 'participants') and ctx.room.participants is not None:
                        participants = list(ctx.room.participants.values())
                    else:
                        logger.warning("No method found to access room participants")
                except Exception as e:
                    logger.error(f"Error accessing participants: {e}")
                
                for p in participants:
                    if p.identity == 'tavus-avatar-agent':
                        logger.info(f"Final track check for avatar participant: {p.identity}")
                        for track in p.tracks:
                            logger.info(f"Final avatar track: {track.kind}, {track.source}")
                
                # Wait a bit for avatar to initialize
                logger.info("Waiting 1 second for avatar initialization...")
                await asyncio.sleep(1)
                
                # Verify avatar state
                if hasattr(avatar_session, 'is_active'):
                    logger.info(f"Avatar active state: {avatar_session.is_active}")
                elif hasattr(avatar_session, 'state'):
                    logger.info(f"Avatar state: {avatar_session.state}")
                else:
                    logger.info("No state attribute found on avatar_session")
                
                # Get detailed track information
                try:
                    participants = []
                    if hasattr(ctx.room, 'get_participants'):
                        participants = await ctx.room.get_participants()
                    elif hasattr(ctx.room, 'participants') and ctx.room.participants is not None:
                        participants = list(ctx.room.participants.values())
                        
                    for p in participants:
                        logger.info(f"Participant: {p.identity}")
                        if hasattr(p, 'tracks'):
                            logger.info(f"  Tracks for {p.identity}: {p.tracks}")
                except Exception as e:
                    logger.error(f"Error getting participant track information: {e}")
                
                # Force publishing the avatar video if that method exists
                avatar_video_published = False
                if hasattr(avatar_session, 'publish_video'):
                    logger.info("Explicitly publishing avatar video track")
                    try:
                        await avatar_session.publish_video()
                        logger.info("Avatar video track published successfully")
                        avatar_video_published = True
                    except Exception as e:
                        logger.error(f"Failed to publish avatar video: {e}")
                elif hasattr(avatar_session, 'enable_video'):
                    logger.info("Calling enable_video()")
                    try:
                        await avatar_session.enable_video()
                        logger.info("enable_video() completed")
                        avatar_video_published = True
                    except Exception as e:
                        logger.error(f"Failed to enable avatar video: {e}")
                else:
                    logger.warning("No publish_video or enable_video method available")
                    
                # FALLBACK: If avatar video wasn't published, create a static video source
                if not avatar_video_published:
                    logger.info("Avatar video was not published. Using fallback mechanism...")
                    try:
                        # Try to use the rtc module to create a camera track
                        try:
                            from livekit.rtc import VideoTrack, TrackSource
                            # Import any video source providers
                            try:
                                from livekit.plugins.video_source import StaticImageSource
                                # Create a static image source as fallback
                                logger.info("Creating static image video source")
                                image_path = os.path.join(os.path.dirname(__file__), 'resources', 'avatar.png')
                                # Use default image if custom one doesn't exist
                                if not os.path.exists(image_path):
                                    logger.info(f"Image {image_path} not found, using solid color")
                                    # Create a video track with a solid color
                                    video_track = await ctx.room.local_participant.create_video_track(
                                        source=TrackSource.CAMERA,
                                        name="avatar"
                                    )
                                else:
                                    logger.info(f"Using image from {image_path}")
                                    source = StaticImageSource(image_path)
                                    video_track = VideoTrack.create_from_source(source, "avatar")
                                
                                # Publish the track
                                logger.info("Publishing fallback video track")
                                await ctx.room.local_participant.publish_track(video_track)
                                logger.info("Fallback video track published successfully")
                            except ImportError:
                                logger.error("StaticImageSource not available, trying direct video track creation")
                                video_track = await ctx.room.local_participant.create_video_track(
                                    source=TrackSource.CAMERA,
                                    name="avatar"
                                )
                                await ctx.room.local_participant.publish_track(video_track)
                        except ImportError as e:
                            logger.error(f"Video track creation failed: {e}")
                    except Exception as e:
                        logger.error(f"Fallback video mechanism failed: {e}")
                        logger.error(f"Error type: {type(e).__name__}, details: {str(e)}")
                        import traceback
                        logger.error(f"Traceback: {traceback.format_exc()}")
                
                # Wait a moment for video to initialize
                logger.info("Waiting for video initialization...")
                await asyncio.sleep(2)
                    
                # Check avatar's audio status
                if hasattr(avatar_session, 'is_audio_enabled'):
                    logger.info(f"Avatar audio enabled: {avatar_session.is_audio_enabled}")
                    # Force enable audio if it's not enabled
                    if hasattr(avatar_session, 'is_audio_enabled') and not avatar_session.is_audio_enabled:
                        logger.warning("Avatar audio is not enabled, attempting to enable it...")
                        if hasattr(avatar_session, 'enable_audio'):
                            try:
                                await avatar_session.enable_audio()
                                logger.info("Successfully enabled avatar audio")
                            except Exception as audio_err:
                                logger.error(f"Failed to enable avatar audio: {audio_err}")
                
                if hasattr(avatar_session, 'is_video_enabled'):
                    logger.info(f"Avatar video enabled: {avatar_session.is_video_enabled}")
                
                # Ensure audio track is published
                logger.info("Verifying audio track publication...")
                audio_track_published = False
                participants = []
                try:
                    if hasattr(ctx.room, 'get_participants'):
                        participants = await ctx.room.get_participants()
                    elif hasattr(ctx.room, 'participants') and ctx.room.participants is not None:
                        participants = list(ctx.room.participants.values())
                except Exception as e:
                    logger.error(f"Error accessing participants for audio check: {e}")
                    
                for p in participants:
                    if p.identity == 'tavus-avatar-agent':
                        for track in p.tracks:
                            if track.kind == 'audio':
                                audio_track_published = True
                                logger.info(f"Found audio track for tavus-avatar-agent: {track}")
                
                if not audio_track_published:
                    logger.warning("No audio track found for tavus-avatar-agent, trying to publish audio track...")
                    try:
                        # Try to force publish audio track if the method exists
                        if hasattr(avatar_session, 'publish_audio'):
                            await avatar_session.publish_audio()
                            logger.info("Called publish_audio() on avatar session")
                        else:
                            logger.warning("No publish_audio method available on avatar session")
                    except Exception as e:
                        logger.error(f"Failed to publish audio track: {e}")
                
                logger.info("Avatar setup complete")
            except Exception as e:
                logger.error(f"Failed to start avatar session: {e}")
                logger.error(f"Error type: {type(e).__name__}, details: {str(e)}")
                # Print traceback for more detailed error info
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
        else:
            logger.warning("Avatar session not available, continuing without avatar")

        # Start the agent session
        logger.info("Starting agent session...")
        from livekit.agents import RoomOutputOptions
        
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
        logger.info("Agent session started successfully")
        
        # Send a greeting
        logger.info("Sending greeting...")
        try:
            await session.generate_reply(
                instructions="Greet the user with a simple hello and introduce yourself as a voice assistant."
            )
            logger.info("Greeting sent successfully")
        except Exception as e:
            logger.error(f"Failed to send greeting: {e}")
        
        # Use explicit page path from command line args instead of global var
        # Fix the JobContext job_config error
        try:
            # Check if job_config exists
            if hasattr(ctx, 'job_config') and ctx.job_config is not None:
                page_path = ctx.job_config.get("page_path", GLOBAL_PAGE_PATH)
            else:
                # Fallback to global configuration or command line args
                logger.info("No job_config found, using global page path")
                page_path = GLOBAL_PAGE_PATH
                
            logger.info(f"Using page path: {page_path}")
        except Exception as e:
            logger.error(f"Error accessing job_config: {e}")
            page_path = GLOBAL_PAGE_PATH
            logger.info(f"Falling back to global page path: {page_path}")
        logger.info(f"Voice agent is running for {page_path}")
        
        # Keep the agent running until interrupted
        try:
            disconnect_future = asyncio.Future()
            await disconnect_future
        except asyncio.CancelledError:
            logger.info("Agent canceled")
    except Exception as e:
        logger.error(f"Error in entrypoint: {e}")


if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--page-path', type=str, help='Path to web page')
    parser.add_argument('--tts-model', type=str, help='Deepgram TTS model to use')
    parser.add_argument('--temperature', type=float, help='LLM temperature')
    parser.add_argument('--avatar-enabled', type=bool, help='Enable or disable Tavus avatar')
    
    # Extract our custom arguments without affecting LiveKit's argument parsing
    args, _ = parser.parse_known_args()
    
    # Set up agent configuration from command line arguments
    if args.page_path:
        GLOBAL_PAGE_PATH = args.page_path
        logger.info(f"Using page path: {GLOBAL_PAGE_PATH}")
    
    if args.tts_model:
        GLOBAL_MODEL = args.tts_model
        logger.info(f"Using TTS model: {GLOBAL_MODEL}")
    
    if args.temperature is not None:
        GLOBAL_TEMPERATURE = args.temperature
        logger.info(f"Using temperature: {GLOBAL_TEMPERATURE}")
        
    if args.avatar_enabled is not None:
        GLOBAL_AVATAR_ENABLED = args.avatar_enabled
        logger.info(f"Avatar {'enabled' if GLOBAL_AVATAR_ENABLED else 'disabled'} by command line arg")
    
    # Remove our custom arguments from sys.argv
    filtered_argv = [sys.argv[0]]
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg in ['--page-path', '--tts-model', '--temperature', '--avatar-enabled'] and i + 1 < len(sys.argv):
            i += 2  # Skip both the flag and its value
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
