#!/usr/bin/env python3
"""
Simple script to test Tavus avatar functionality
"""

import os
import asyncio
import logging
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import agents
from livekit.plugins import tavus  # Import tavus from livekit.plugins

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Access environment variables with fallbacks
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY", "")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

async def test_avatar(room_name="AvatarTest"):
    """Simple test of Tavus avatar functionality"""
    logger.info("Starting Tavus avatar test...")
    logger.info(f"Tavus credentials: API_KEY={TAVUS_API_KEY[:4]}...{TAVUS_API_KEY[-4:] if TAVUS_API_KEY else 'Not Set'}, "
               f"REPLICA_ID={TAVUS_REPLICA_ID}, PERSONA_ID={TAVUS_PERSONA_ID}")
    
    # Check if required credentials are available
    if not TAVUS_API_KEY or not TAVUS_REPLICA_ID:
        logger.error("Missing required Tavus credentials! Cannot proceed.")
        return
    
    # Configure Tavus with API key
    os.environ["TAVUS_API_KEY"] = TAVUS_API_KEY
    
    try:
        # Create room and connect
        logger.info(f"Connecting to room: {room_name}")
        room = rtc.Room()
        await room.connect(LIVEKIT_URL, room_name)
        logger.info(f"Connected to room {room_name}")
        
        # Set up avatar configuration with explicit video settings
        avatar_config = {
            "video": {
                "enabled": True,
                "width": 640,
                "height": 480,
                "framerate": 30,
            },
            "publish_video": True,
            "publish_audio": True
        }
        
        # Create avatar session with explicit video config
        logger.info("Creating Tavus avatar session...")
        avatar_session = tavus.AvatarSession(
            replica_id=TAVUS_REPLICA_ID,
            persona_id=TAVUS_PERSONA_ID if TAVUS_PERSONA_ID else None,
            avatar_config=avatar_config,
        )
        logger.info("Avatar session created")
        
        # Check available methods on the avatar_session
        avatar_methods = [m for m in dir(avatar_session) if not m.startswith('__')]
        logger.info(f"Available avatar methods: {avatar_methods}")
        
        # Ensure avatar publishes to room
        logger.info("Publishing avatar to room...")
        
        # Manually start the avatar session
        await avatar_session.start(None, room=room)
        logger.info("Avatar session started")
        
        # Check if we have a separate publish method
        if hasattr(avatar_session, 'publish_video'):
            logger.info("Publishing avatar video...")
            await avatar_session.publish_video()
            logger.info("Avatar video published")
        
        # Say something with the avatar to ensure it's working
        logger.info("Making avatar speak...")
        await avatar_session.say("Hello! This is a test of the Tavus avatar. Can you see me?")
        logger.info("Avatar speech completed")
        
        # Keep the connection alive for a while so the user can see the avatar
        logger.info("Keeping connection open for 30 seconds...")
        await asyncio.sleep(30)
        
        # Clean up
        logger.info("Closing connection...")
        await room.disconnect()
        logger.info("Test completed successfully")
        
    except Exception as e:
        logger.error(f"Error during avatar test: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    asyncio.run(test_avatar())
