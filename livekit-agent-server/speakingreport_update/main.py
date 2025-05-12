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
    # Connect to the room
    try:
        await ctx.connect()
        logger.info(f"Connected to LiveKit room '{ctx.room.name}'")
    except Exception as e:
        logger.error(f"Failed to connect to LiveKit room: {e}")
        return
    
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
            tts=deepgram.TTS(model=GLOBAL_MODEL),
            vad=silero.VAD.load(),
            turn_detection=MultilingualModel(),
        )
        logger.info("Agent session created successfully")
        
        # Start the agent session
        logger.info("Starting agent session...")
        await session.start(
            room=ctx.room,
            agent=assistant,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
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
        
        logger.info(f"Voice agent is running for {GLOBAL_PAGE_PATH}")
        
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
    
    # Remove our custom arguments from sys.argv
    filtered_argv = [sys.argv[0]]
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg in ['--page-path', '--tts-model', '--temperature'] and i + 1 < len(sys.argv):
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
