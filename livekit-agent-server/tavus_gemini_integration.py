#!/usr/bin/env python3
"""
Tavus Avatar + Google Gemini Integration for LiveKit

This script integrates the Tavus avatar functionality with the Google Gemini model
in a LiveKit session. It combines the necessary components from both implementations
to create a seamless experience where the Tavus avatar represents the Google Gemini model.
"""

import os
import sys
import asyncio
import logging
import argparse
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# LiveKit imports - using the CLI approach which is more stable
from livekit.agents.cli import app as livekit_app
# Import Google Gemini Realtime model
from livekit.plugins.google.beta.realtime import RealtimeModel

# Try to import noise cancellation
try:
    import livekit.plugins.noise_cancellation as noise_cancellation
    has_noise_cancellation = True
except ImportError:
    has_noise_cancellation = False
    
# Configure custom Tavus integration
class TavusAvatarConfig:
    """Configuration for Tavus avatar"""
    def __init__(self, api_key, replica_id, persona_id=None):
        self.api_key = api_key
        self.replica_id = replica_id
        self.persona_id = persona_id

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Tavus Avatar + Google Gemini Integration")
    parser.add_argument("--avatar", action="store_true", help="Enable Tavus avatar")
    parser.add_argument("--persona", type=str, default="vocab-teacher", help="Persona ID to use")
    parser.add_argument("--room", type=str, default="AvatarTest", help="LiveKit room name")
    parser.add_argument("--url", type=str, help="LiveKit server URL")
    parser.add_argument("--api-key", type=str, help="LiveKit API key")
    parser.add_argument("--api-secret", type=str, help="LiveKit API secret")
    parser.add_argument("--identity", type=str, default="tavus-ai-assistant", help="Identity in the room")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    return parser.parse_args()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TavusGeminiAgent:
    """Custom agent that integrates Tavus avatar with Google Gemini Realtime model"""
    
    def __init__(self, tavus_config=None):
        """Initialize the agent with optional Tavus configuration"""
        self.tavus_config = tavus_config
        self.name = "AI Assistant"
        self.description = "A vocabulary teacher powered by Google Gemini"
        self.model = None

    def setup_model(self, api_key, voice="male"):
        """Set up the Google Gemini Realtime model"""
        try:
            self.model = RealtimeModel(
                model="gemini-2.0-flash-exp",
                voice=voice,
                api_key=api_key
            )
            logger.info("Google Gemini Realtime model created successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to set up Google Gemini Realtime model: {e}")
            return False

    async def on_message(self, content, participant=None, **kwargs):
        """Process messages from users in the room."""
        sender = participant.identity if participant else "Unknown"
        logger.info(f"Message from {sender}: {content[:50]}{'...' if len(content) > 50 else ''}")
        # The messages are automatically handled by the Gemini Realtime model
        return None

def verify_env_vars():
    """Verify that all required environment variables are set"""
    required_vars = [
        "LIVEKIT_URL", 
        "LIVEKIT_API_KEY", 
        "LIVEKIT_API_SECRET",
        "GOOGLE_API_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set them in your .env file or environment")
        return False
    
    return True

def setup_tavus_avatar():
    """Set up Tavus avatar configuration"""
    tavus_api_key = os.getenv("TAVUS_API_KEY")
    tavus_replica_id = os.getenv("TAVUS_REPLICA_ID")
    tavus_persona_id = os.getenv("TAVUS_PERSONA_ID")
    
    if not all([tavus_api_key, tavus_replica_id]):
        logger.error("Missing required Tavus credentials (TAVUS_API_KEY, TAVUS_REPLICA_ID)")
        return None
    
    logger.info("Setting up Tavus avatar configuration...")
    
    if tavus_api_key:
        # Mask API key for logging
        masked_key = f"{tavus_api_key[:4] if len(tavus_api_key) > 4 else '****'}{'*' * 20}_key"
        logger.info(f"Tavus API Key: {masked_key}")
    
    logger.info(f"Tavus Replica ID: {tavus_replica_id}")
    if tavus_persona_id:
        logger.info(f"Tavus Persona ID: {tavus_persona_id}")
        
    return TavusAvatarConfig(
        api_key=tavus_api_key,
        replica_id=tavus_replica_id,
        persona_id=tavus_persona_id
    )

async def connect_command(ctx):
    """Command to connect to a LiveKit room"""
    # Load environment variables from .env file
    load_dotenv()
    
    # Verify required environment variables
    if not verify_env_vars():
        return 1
    
    # Set up Tavus avatar if enabled
    tavus_config = None
    if ctx.avatar:
        tavus_config = setup_tavus_avatar()
        if not tavus_config:
            logger.error("Failed to set up Tavus avatar configuration")
            return 1
    
    # Create the agent
    agent = TavusGeminiAgent(tavus_config=tavus_config)
    
    # Set up Google Gemini Realtime model
    logger.info("Setting up Google Gemini Realtime model...")
    if not agent.setup_model(api_key=os.getenv("GOOGLE_API_KEY")):
        return 1
    
    # Use identity based on whether we're using Tavus or not
    identity = "tavus-ai-assistant" if ctx.avatar else "gemini-ai-assistant"
    if ctx.identity:
        identity = ctx.identity
    
    # Set LiveKit connection parameters
    url = ctx.url or os.getenv("LIVEKIT_URL")
    api_key = ctx.api_key or os.getenv("LIVEKIT_API_KEY")
    api_secret = ctx.api_secret or os.getenv("LIVEKIT_API_SECRET")
    
    # Create room options
    room_options = {
        "url": url,
        "api_key": api_key,
        "api_secret": api_secret,
        "room_name": ctx.room,
        "identity": identity
    }
    
    # Room input options including noise cancellation if available
    room_input_options = {}
    if has_noise_cancellation:
        try:
            room_input_options["noise_cancellation"] = noise_cancellation.BVC()
            logger.info("Noise cancellation enabled")
        except Exception as e:
            logger.warning(f"Failed to initialize noise cancellation: {e}")
    
    # Log connection details
    logger.info(f"Connecting to LiveKit room '{ctx.room}' with identity '{identity}'")
    logger.info(f"Using LiveKit URL: {url}")
    
    # Return all configurations for the CLI app to use
    return {
        "agent": agent,
        "model": agent.model if hasattr(agent, "model") else None,
        "room_options": room_options,
        "room_input_options": room_input_options
    }

def main():
    """Main entry point for the script"""
    # Parse command line arguments
    args = parse_args()
    
    # Set up logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.setLevel(logging.DEBUG)
    
    # Register our command with the LiveKit CLI app
    livekit_app.command()(connect_command)
    
    # Run the LiveKit CLI app with our arguments
    cli_args = ["connect"]
    
    # Add parsed args to the CLI call
    if args.room:
        cli_args.extend(["--room", args.room])
    if args.url:
        cli_args.extend(["--url", args.url])
    if args.api_key:
        cli_args.extend(["--api-key", args.api_key])
    if args.api_secret:
        cli_args.extend(["--api-secret", args.api_secret])
    if args.identity:
        cli_args.extend(["--identity", args.identity])
    if args.avatar:
        cli_args.append("--avatar")
    if args.verbose:
        cli_args.append("--verbose")
    
    # Run the LiveKit CLI app
    return livekit_app(cli_args)

if __name__ == "__main__":
    # Run the main function which will invoke the LiveKit CLI app
    sys.exit(main())
