import asyncio
import os
import logging
import json
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from livekit import RoomServiceClient

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="LiveKit Agent Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your actual domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check if required environment variables are set
required_env_vars = [
    "LIVEKIT_API_KEY", 
    "LIVEKIT_API_SECRET", 
    "LIVEKIT_URL",
    "OPENAI_API_KEY",
]

for var in required_env_vars:
    if not os.getenv(var):
        logger.error(f"Missing required environment variable: {var}")

# LiveKit configuration
livekit_url = os.getenv("LIVEKIT_URL")
api_key = os.getenv("LIVEKIT_API_KEY")
api_secret = os.getenv("LIVEKIT_API_SECRET")

# Set up LiveKit room service client
room_service = RoomServiceClient(
    livekit_url,
    api_key,
    api_secret
)

# Active agent sessions
active_sessions: Dict[str, Dict[str, Any]] = {}

# Request models
class AgentConnectRequest(BaseModel):
    room_name: str
    instructions: Optional[str] = "You are a english teacher that will help with pronunciation and grammar."
    voice: Optional[str] = "alloy"  # Default OpenAI voice


class AgentInfo(BaseModel):
    identity: str = "ai-assistant"
    name: str = "AI Assistant"


@app.get("/")
async def root():
    return {"status": "LiveKit Agent Server is running"}


@app.post("/connect-agent")
async def connect_agent(request: AgentConnectRequest, background_tasks: BackgroundTasks):
    """Connect an agent to a LiveKit room"""
    try:
        room_name = request.room_name
        
        # Check if there's already an active session for this room
        if room_name in active_sessions:
            return {"status": "Agent already connected to this room"}
        
        # In a full implementation, we would create the LiveKit Agent here
        # Since we don't have the plugins available, we're creating a simplified version
        agent_identity = f"ai-assistant-{room_name}"
        
        # Store session info
        active_sessions[room_name] = {
            "status": "initializing",
            "identity": agent_identity,
            "instructions": request.instructions,
            "voice": request.voice
        }
        
        # Generate a token for the agent
        try:
            # Create a token for the agent using the LiveKit API
            logger.info(f"Creating token for agent in room: {room_name}")
            
            # This would be where we create an agent token
            # But for now, we'll simulate it
            background_tasks.add_task(simulate_agent_connection, room_name)
            
            return {
                "status": "Agent connecting to room",
                "room": room_name,
                "identity": agent_identity
            }
            
        except Exception as e:
            logger.error(f"Error creating agent token: {str(e)}")
            if room_name in active_sessions:
                del active_sessions[room_name]
            raise HTTPException(status_code=500, detail=f"Error creating agent token: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error connecting agent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error connecting agent: {str(e)}")


async def simulate_agent_connection(room_name: str):
    """Simulate an agent connecting to a room for demonstration purposes"""
    try:
        if room_name not in active_sessions:
            logger.error(f"Room {room_name} not found in active sessions")
            return
            
        # Update status to connecting
        active_sessions[room_name]["status"] = "connecting"
        logger.info(f"Agent connecting to room: {room_name}")
        
        # Wait a bit to simulate connection process
        await asyncio.sleep(2)
        
        # Update status to connected
        active_sessions[room_name]["status"] = "connected"
        logger.info(f"Agent successfully connected to room: {room_name}")
        
    except Exception as e:
        if room_name in active_sessions:
            active_sessions[room_name]["status"] = "error"
        logger.error(f"Error connecting agent: {str(e)}")


@app.get("/status/{room_name}")
async def get_agent_status(room_name: str):
    """Get the status of an agent in a room"""
    if room_name not in active_sessions:
        return {"status": "not_connected"}
    
    return {"status": active_sessions[room_name]["status"]}


@app.post("/disconnect-agent/{room_name}")
async def disconnect_agent(room_name: str):
    """Disconnect an agent from a room"""
    if room_name not in active_sessions:
        return {"status": "Agent not connected to this room"}
    
    try:
        # In a full implementation, we would stop the LiveKit Agent session here
        logger.info(f"Disconnecting agent from room: {room_name}")
        
        # Remove the session
        agent_identity = active_sessions[room_name].get("identity", "unknown")
        del active_sessions[room_name]
        
        return {
            "status": "Agent disconnected from room",
            "agent_identity": agent_identity
        }
    except Exception as e:
        logger.error(f"Error disconnecting agent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error disconnecting agent: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
