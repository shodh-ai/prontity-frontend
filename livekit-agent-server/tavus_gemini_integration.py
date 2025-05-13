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
from typing import Optional
from dotenv import load_dotenv

# LiveKit imports
from livekit import agents
from livekit.agents import AgentSession, Agent
from livekit.plugins import tavus  # Our custom Tavus plugin
from livekit.plugins.google.beta.realtime import RealtimeModel
import livekit.plugins.noise_cancellation as noise_cancellation

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Tavus Avatar + Google Gemini Integration")
    parser.add_argument("--room", "-r", type=str, required=True, help="LiveKit room name")
    parser.add_argument("--avatar", action="store_true", help="Enable Tavus avatar")
    parser.add_argument("--persona", type=str, default="vocab-teacher", help="Persona ID to use")
    return parser.parse_args()

async def main():
    """Main entry point for the application."""
    # Load environment variables
    load_dotenv()

    # Parse command line arguments
    args = parse_args()
    
    # Verify required environment variables
    livekit_url = os.getenv("LIVEKIT_URL")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
    google_api_key = os.getenv("GOOGLE_API_KEY")
    
    if not all([livekit_url, livekit_api_key, livekit_api_secret, google_api_key]):
        logger.error("Missing required environment variables.")
        logger.error("Please set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and GOOGLE_API_KEY")
        sys.exit(1)
    
    # Set up Tavus avatar if enabled
    avatar_session = None
    if args.avatar:
        tavus_api_key = os.getenv("TAVUS_API_KEY")
        tavus_replica_id = os.getenv("TAVUS_REPLICA_ID")
        tavus_persona_id = os.getenv("TAVUS_PERSONA_ID")
        
        if not all([tavus_api_key, tavus_replica_id]):
            logger.error("Missing required Tavus credentials.")
            logger.error("Please set TAVUS_API_KEY and TAVUS_REPLICA_ID")
            sys.exit(1)
        
        logger.info("Setting up Tavus avatar...")
        logger.info(f"Tavus API Key: {tavus_api_key[:4]}{'*' * 20}{tavus_api_key[-4:]}")
        logger.info(f"Tavus Replica ID: {tavus_replica_id}")
        if tavus_persona_id:
            logger.info(f"Tavus Persona ID: {tavus_persona_id}")
        
        os.environ["TAVUS_API_KEY"] = tavus_api_key
        
        try:
            # Create avatar session with minimal parameters
            avatar_session = tavus.AvatarSession(
                replica_id=tavus_replica_id,
                persona_id=tavus_persona_id if tavus_persona_id else None
            )
            logger.info("Tavus avatar session created successfully")
        except Exception as e:
            logger.error(f"Failed to set up Tavus avatar: {e}")
            sys.exit(1)
    
    # Set up a pre-configured persona for the agent
    persona = {
        "identity": args.persona,
        "name": "AI Assistant",
        "role": "AI vocabulary teacher",
        "voice": "male",
        "prompt": """
        You are an AI vocabulary teacher that helps users learn new words and improve their vocabulary.
        You can explain word meanings, provide examples, and help users practice using words correctly.
        You should be friendly, supportive, and encouraging.
        """,
        "allowed_tools": ["showWordInfo", "startQuiz", "drawConcept"]
    }
    
    # Create the Google Gemini Realtime model
    logger.info("Setting up Google Gemini Realtime model...")
    try:
        model = RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice=persona["voice"],
            api_key=google_api_key
        )
        logger.info("Google Gemini Realtime model created successfully")
    except Exception as e:
        logger.error(f"Failed to set up Google Gemini Realtime model: {e}")
        sys.exit(1)
    
    # Create the agent session
    logger.info(f"Creating agent session for room: {args.room}")
    
    # Create a custom AI Agent that will be powered by the Google Gemini model
    class CustomAgent(Agent):
        def __init__(self, persona_config):
            self.persona = persona_config
            self.name = persona_config["name"]
            self.identity = persona_config["identity"]
            self.prompt = persona_config["prompt"]
        
        async def on_message(self, content, role="user", **kwargs):
            """Process messages from users in the room."""
            logger.info(f"Received message: {content[:50]}...")
            # The Google Realtime model handles message processing automatically
            pass
    
    # Create the agent
    assistant = CustomAgent(persona)
    
    # Set a unique identity for the agent
    agent_identity = "tavus-avatar-agent" if args.avatar else f"gemini-agent-{args.persona}"
    
    # Create the agent session
    session = AgentSession(identity=agent_identity)
    
    # Log connection details
    logger.info(f"Connecting to LiveKit room '{args.room}' with identity '{agent_identity}'")
    
    # Start the agent session
    try:
        # Set up noise cancellation
        room_input_options = agents.RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        )
        
        # Connect to the room
        await session.connect(url=livekit_url, token=args.room)
        
        # Start the Tavus avatar if enabled
        if args.avatar and avatar_session:
            logger.info("Starting Tavus avatar session...")
            try:
                await avatar_session.start(session=session, room=session.room)
                logger.info("Tavus avatar session started successfully")
            except Exception as e:
                logger.error(f"Failed to start Tavus avatar session: {e}")
        
        # Start the agent session
        await session.start(
            room=session.room,
            agent=assistant,
            model=model,
            room_input_options=room_input_options,
        )
        
        logger.info("Agent session started successfully")
        
        # Keep the session running indefinitely
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Error in agent session: {e}")
    finally:
        # Clean up
        if avatar_session:
            try:
                await avatar_session.stop()
                logger.info("Tavus avatar session stopped")
            except Exception as e:
                logger.error(f"Error stopping Tavus avatar session: {e}")
        
        # Disconnect from LiveKit
        try:
            await session.disconnect()
            logger.info("Disconnected from LiveKit")
        except Exception as e:
            logger.error(f"Error disconnecting from LiveKit: {e}")

if __name__ == "__main__":
    # Run the main function
    asyncio.run(main())
