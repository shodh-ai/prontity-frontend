#!/usr/bin/env python3
"""
LiveKit Voice Processing Agent (VPA) Implementation with Custom Backend Bridge

This script implements a LiveKit voice agent using the VPA pipeline,
replacing the standard LLM with a bridge to a custom backend script.
"""

import os
import sys
import logging
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# --- (Keep your existing logging setup) ---
logging.basicConfig(level=logging.DEBUG,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- (Keep your existing imports for livekit, plugins, etc.) ---
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
try:
    from livekit.plugins import noise_cancellation
    from livekit.plugins import deepgram, silero # Removed openai import
    from livekit.plugins.turn_detector.multilingual import MultilingualModel
except ImportError as e:
    logger.error(f"Failed to import required packages: {e}")
    # Adjusted pip install command if needed (removed openai)
    logger.error("Please install the missing packages: pip install 'livekit-agents[deepgram,silero,turn-detector]~=1.0' 'livekit-plugins-noise-cancellation~=0.2' python-dotenv aiohttp")
    sys.exit(1)

# --- Import your Custom LLM Bridge ---
try:
    from custom_llm import CustomLLMBridge # Assuming you saved the class above in custom_llm.py
except ImportError:
    logger.error("Failed to import CustomLLMBridge. Make sure custom_llm.py exists and aiohttp is installed.")
    sys.exit(1)

# --- (Keep your existing .env loading and checks) ---
# Ensure MY_CUSTOM_AGENT_URL is set in your .env or environment
script_dir = Path(__file__).resolve().parent
env_path = script_dir / '.env'
if env_path.exists():
    logger.info(f"Loading environment from: {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    logger.warning(f"No .env file found at {env_path}, using environment variables")
    load_dotenv()

# Verify critical environment variables (removed OPENAI_API_KEY)
required_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DEEPGRAM_API_KEY", "MY_CUSTOM_AGENT_URL"] # Added custom agent URL
for var in required_vars:
    value = os.getenv(var)
    if not value:
        logger.error(f"Missing required environment variable: {var}")
        sys.exit(1)
    if var == "DEEPGRAM_API_KEY":
        logger.info(f"DEEPGRAM_API_KEY: {value[:8]}...{value[-4:]} (length: {len(value)})")
    if var == "MY_CUSTOM_AGENT_URL":
        logger.info(f"Using custom agent URL: {value}")


# --- (Keep Global configuration, but temperature might not be needed unless your backend uses it) ---
GLOBAL_PAGE_PATH = "speakingpage"
GLOBAL_MODEL = "aura-asteria-en" # Deepgram TTS model
# GLOBAL_TEMPERATURE = 0.7 # No longer directly used by OpenAI LLM here
GLOBAL_INSTRUCTIONS = "You are a helpful voice AI assistant powered by a custom backend. Be concise." # Updated instructions slightly


# --- (Keep your Assistant class as is) ---
class Assistant(Agent):
    """Simple voice AI assistant"""
    def __init__(self) -> None:
        super().__init__(instructions=GLOBAL_INSTRUCTIONS)

    async def on_transcript(self, transcript: str, language: str) -> None:
        """Called when a user transcript is received"""
        logger.info(f"USER SAID: '{transcript}' (language: {language})")

    async def on_reply(self, message: str, audio_url: str = None) -> None:
        """Override to log when assistant replies"""
        logger.info(f"ASSISTANT REPLY (from custom backend): '{message}'") # Clarified origin
        if audio_url:
            logger.info(f"AUDIO URL: {audio_url}")
        else:
            logger.warning("NO AUDIO URL PROVIDED - Speech not generated!")


async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint for the agent."""
    try:
        await ctx.connect()
        logger.info(f"Connected to LiveKit room '{ctx.room.name}'")
    except Exception as e:
        logger.error(f"Failed to connect to LiveKit room: {e}")
        return

    logger.info(f"Using Deepgram TTS model: {GLOBAL_MODEL}")
    # logger.info(f"Using temperature: {GLOBAL_TEMPERATURE}") # Temperature not directly applicable here

    assistant = Assistant()

    try:
        logger.info("Creating agent session with VPA pipeline using CustomLLMBridge...")
        session = AgentSession(
            stt=deepgram.STT(model="nova-3", language="multi"),
            # --- Use your CustomLLMBridge here ---
            llm=CustomLLMBridge(), # It reads the URL from the environment variable
            # --- Keep TTS, VAD, Turn Detection ---
            tts=deepgram.TTS(model=GLOBAL_MODEL),
            vad=silero.VAD.load(),
            turn_detection=MultilingualModel(),
        )
        logger.info("Agent session created successfully")

        logger.info("Starting agent session...")
        await session.start(
            room=ctx.room,
            agent=assistant,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        )
        logger.info("Agent session started successfully")

        # Send a greeting (this will now go through your custom backend if it handles instructions)
        # Note: The CustomLLMBridge currently only sends the *last user message*.
        # Handling initial greetings or system prompts might require adjusting the bridge
        # or how your backend interprets requests with no preceding user message.
        # For simplicity, let's try sending it. The bridge might need refinement
        # if your backend expects a specific format for initial prompts.
        logger.info("Sending greeting via custom backend...")
        try:
            await session.generate_reply(
                instructions="Greet the user with a simple hello and introduce yourself."
            )
            logger.info("Greeting request sent.")
        except Exception as e:
            logger.error(f"Failed to send greeting request: {e}")

        logger.info(f"Voice agent is running for {GLOBAL_PAGE_PATH}, bridged to custom backend.")

        try:
            disconnect_future = asyncio.Future()
            await disconnect_future
        except asyncio.CancelledError:
            logger.info("Agent canceled")
    except Exception as e:
        logger.error(f"Error in entrypoint: {e}")


if __name__ == "__main__":
    # --- (Keep your argument parsing, but remove --temperature if not needed) ---
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--page-path', type=str, help='Path to web page')
    parser.add_argument('--tts-model', type=str, help='Deepgram TTS model to use')
    # parser.add_argument('--temperature', type=float, help='LLM temperature') # Removed

    args, _ = parser.parse_known_args()

    if args.page_path:
        GLOBAL_PAGE_PATH = args.page_path
        logger.info(f"Using page path: {GLOBAL_PAGE_PATH}")

    if args.tts_model:
        GLOBAL_MODEL = args.tts_model
        logger.info(f"Using TTS model: {GLOBAL_MODEL}")

    # if args.temperature is not None: # Removed
    #     GLOBAL_TEMPERATURE = args.temperature
    #     logger.info(f"Using temperature: {GLOBAL_TEMPERATURE}")

    # Filter custom args from sys.argv (update the list of flags to skip)
    filtered_argv = [sys.argv[0]]
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        # Updated list of flags to remove
        if arg in ['--page-path', '--tts-model'] and i + 1 < len(sys.argv):
            i += 2  # Skip both the flag and its value
        else:
            filtered_argv.append(arg)
            i += 1

    sys.argv = filtered_argv

    # --- (Keep running the agent) ---
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint
        )
    )