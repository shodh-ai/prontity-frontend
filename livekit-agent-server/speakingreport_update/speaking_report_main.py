#!/usr/bin/env python3
"""
Speaking Report LiveKit Agent

This script connects a speaking coach AI agent to LiveKit sessions.
The agent processes audio via the LiveKit SDK and generates responses using
the external agent service defined in speaking_report_agent.py.
"""

import os
import sys
import logging
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv

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
    from livekit.plugins import deepgram, silero  # No direct OpenAI import
    from livekit.plugins.turn_detector.multilingual import MultilingualModel
except ImportError as e:
    logger.error(f"Failed to import required packages: {e}")
    logger.error("Please install the missing packages: pip install 'livekit-agents[deepgram,silero,turn-detector]~=1.0' 'livekit-plugins-noise-cancellation~=0.2' python-dotenv aiohttp")
    sys.exit(1)

# Import the Custom LLM Bridge
try:
    from custom_llm import CustomLLMBridge
except ImportError:
    logger.error("Failed to import CustomLLMBridge. Make sure custom_llm.py exists and aiohttp is installed.")
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
required_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DEEPGRAM_API_KEY", "MY_CUSTOM_AGENT_URL"]
for var in required_vars:
    value = os.getenv(var)
    if not value:
        logger.error(f"Missing required environment variable: {var}")
        sys.exit(1)
    if var == "DEEPGRAM_API_KEY":
        logger.info(f"DEEPGRAM_API_KEY: {value[:8]}...{value[-4:]} (length: {len(value)})")
    if var == "MY_CUSTOM_AGENT_URL":
        logger.info(f"Using custom agent URL: {value}")

# Global configuration
GLOBAL_PAGE_PATH = "speakingreport"  # Default to speakingreport
GLOBAL_MODEL = "aura-asteria-en"    # Default Deepgram TTS model
GLOBAL_INSTRUCTIONS = "You are Coach Alex, a speaking coach AI assistant powered by a custom backend. Help users understand speaking highlights and improve their communication skills."


class SpeakingCoach(Agent):
    """Speaking coach AI assistant"""
    def __init__(self) -> None:
        super().__init__(instructions=GLOBAL_INSTRUCTIONS)
        
    async def on_transcript(self, transcript: str, language: str) -> None:
        """Called when a user transcript is received"""
        logger.info(f"USER SAID: '{transcript}' (language: {language})")
        
    async def on_reply(self, message: str, audio_url: str = None) -> None:
        """Override to log when assistant replies"""
        logger.info(f"SPEAKING COACH: '{message}'")
        if audio_url:
            logger.info(f"AUDIO URL: {audio_url}")
        else:
            logger.warning("NO AUDIO URL PROVIDED - Speech not generated!")


async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint for the agent."""
    # Connect to the room
    try:
        await ctx.connect()
        logger.info(f"Connected to LiveKit room '{ctx.room.name}'")
    except Exception as e:
        logger.error(f"Failed to connect to LiveKit room: {e}")
        return
    
    # Log configuration
    logger.info(f"Using Deepgram TTS model: {GLOBAL_MODEL}")
    
    # Create the speaking coach assistant
    coach = SpeakingCoach()
    
    try:
        # Create the agent session with the VPA pipeline using CustomLLMBridge
        logger.info("Creating agent session with VPA pipeline using CustomLLMBridge...")
        session = AgentSession(
            # Use Deepgram for STT, our custom bridge for LLM, and Deepgram for TTS
            stt=deepgram.STT(model="nova-3", language="multi"),
            llm=CustomLLMBridge(),  # Our custom bridge to the Flask server
            tts=deepgram.TTS(model=GLOBAL_MODEL),
            vad=silero.VAD.load(),
            turn_detection=MultilingualModel(),
        )
        logger.info("Agent session created successfully")
        
        # Start the agent session
        logger.info("Starting agent session...")
        await session.start(
            room=ctx.room,
            agent=coach,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        )
        logger.info("Agent session started successfully")
        
        # Send a greeting via the external agent
        logger.info("Sending greeting via custom backend...")
        try:
            await session.generate_reply(
                instructions="Greet the user as Coach Alex. Introduce yourself as a speaking coach who helps users understand speaking highlights and improve their communication. Ask how you can help today."
            )
            logger.info("Greeting request sent.")
        except Exception as e:
            logger.error(f"Failed to send greeting request: {e}")
        
        logger.info(f"Speaking coach agent is running in room {ctx.room.name}, bridged to custom backend.")
        
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
    
    # Extract our custom arguments without affecting LiveKit's argument parsing
    args, _ = parser.parse_known_args()
    
    # Set up agent configuration from command line arguments
    if args.page_path:
        GLOBAL_PAGE_PATH = args.page_path
        logger.info(f"Using page path: {GLOBAL_PAGE_PATH}")
    
    if args.tts_model:
        GLOBAL_MODEL = args.tts_model
        logger.info(f"Using TTS model: {GLOBAL_MODEL}")
    
    # --- Filter custom args from sys.argv ---
    filtered_argv = [sys.argv[0]]
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg in ['--page-path', '--tts-model'] and i + 1 < len(sys.argv):
            i += 2  # Skip both the flag and its value
        else:
            filtered_argv.append(arg)
            i += 1
    
    # Replace sys.argv with filtered version
    sys.argv = filtered_argv
    
    # Run the agent with the standard CLI interface exactly as in vocab_teacher_main.py
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint
        )
    )
