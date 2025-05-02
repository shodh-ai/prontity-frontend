#!/usr/bin/env python3
"""
LiveKit Voice Processing Agent (VPA) Implementation

This script implements a LiveKit agent using the VPA pipeline for natural
conversation with speech recognition, LLM processing, and text-to-speech capabilities.
"""

import os
import sys
import asyncio
import logging
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    cartesia,
    deepgram,
    noise_cancellation,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class VoiceAssistant(Agent):
    """
    Voice Processing Agent that handles natural language conversations
    through speech recognition, LLM processing, and text-to-speech.
    """
    def __init__(self, instructions=None) -> None:
        default_instructions = """
        You are a helpful voice AI assistant that helps users with their tasks.
        Be concise but thorough in your responses. Always provide relevant and
        accurate information. Speak naturally and conversationally.
        """
        super().__init__(instructions=instructions or default_instructions)

async def create_voice_agent_session(room, agent, voice="Lithium", temperature=0.7):
    """
    Create a voice agent session with the specified configuration.
    
    Args:
        room: The LiveKit room object
        agent: An instance of a LiveKit Agent class
        voice: Voice to use for TTS (default: "Lithium")
        temperature: LLM temperature (default: 0.7)
        
    Returns:
        The AgentSession instance
    """
    try:
        logger.info("Creating Voice Processing Agent session...")
        
        # Create the agent session with VPA components
        session = AgentSession(
            stt=deepgram.STT(model="nova-3", language="multi"),
            llm=openai.LLM(model="gpt-4o-mini", temperature=temperature),
            tts=cartesia.TTS(voice=voice),
            vad=silero.VAD.load(),
            turn_detection=MultilingualModel(),
        )
        
        # Configure room input options with noise cancellation
        input_options = RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        )
        
        # Start the agent session
        await session.start(
            room=room,
            agent=agent,
            room_input_options=input_options,
        )
        
        logger.info("Successfully created VPA session")
        return session
        
    except Exception as e:
        logger.error(f"Failed to create VPA session: {e}")
        raise

async def voice_agent_entrypoint(ctx: agents.JobContext, 
                                 instructions=None, 
                                 voice="Lithium", 
                                 temperature=0.7):
    """
    Entrypoint function for the voice agent.
    
    Args:
        ctx: The JobContext from LiveKit Agents
        instructions: Custom instructions for the agent
        voice: Voice to use for TTS (default: "Lithium")
        temperature: LLM temperature (default: 0.7)
    """
    # Connect to the room
    await ctx.connect()
    logger.info(f"Connected to LiveKit room '{ctx.room.name}'")
    
    # Create the voice assistant with instructions
    assistant = VoiceAssistant(instructions=instructions)
    
    # Create and start the agent session
    session = await create_voice_agent_session(
        room=ctx.room,
        agent=assistant,
        voice=voice,
        temperature=temperature
    )
    
    # Send an initial greeting
    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )
    
    logger.info(f"Voice agent successfully started in room {ctx.room.name}")
    
    # Keep the session running
    try:
        # Wait indefinitely while handling room events
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        logger.info("Agent task was cancelled")
    except Exception as e:
        logger.error(f"Error in agent entrypoint: {e}")
    finally:
        logger.info("Agent session ending")

if __name__ == "__main__":
    # This allows the file to be run directly for testing
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=voice_agent_entrypoint
        )
    )
