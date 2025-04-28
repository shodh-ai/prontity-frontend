"""
Timer Tools

This module implements handlers for timer-related tools like startTimer.
These tools allow the agent to control timer UI elements in the client.
"""

import logging
import json
import asyncio
from typing import Dict, Any, Optional

from livekit.agents import AgentSession

logger = logging.getLogger(__name__)

# Session context for timer state tracking
timer_sessions = {}

async def handle_start_timer(session: AgentSession, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle startTimer tool calls by sending a timer control message through the LiveKit data channel.
    
    Args:
        session: The current agent session
        args: Arguments from the tool call
            - duration: Integer duration in seconds
            - purpose: Optional string purpose ("preparation" or "speaking")
            
    Returns:
        Response data for the tool call
    """
    duration = args.get("duration", 0)
    purpose = args.get("purpose", "speaking")  # Default to speaking if not specified
    
    # Validate the duration parameter
    if not isinstance(duration, int) or duration <= 0:
        return {
            "success": False,
            "message": "Invalid duration provided. Must be a positive integer."
        }
        
    # Validate the purpose parameter if provided
    if purpose and purpose not in ["preparation", "speaking"]:
        return {
            "success": False,
            "message": "Invalid purpose provided. Must be 'preparation' or 'speaking'."
        }
    
    logger.info(f"Starting {purpose} timer for {duration} seconds")
    
    # Create the timer command data
    timer_data = {
        "action": "start",
        "duration": duration,
        "purpose": purpose
    }
    
    # Send the timer command through the data channel
    try:
        # Send message to all participants including the UI
        await session.room.local_participant.publish_data(
            json.dumps({
                "type": "timer_control",
                "data": timer_data
            }).encode("utf-8"),
            topic="agent-tools"  # Use a custom topic for tool events
        )
        
        # Store the timer state in session context
        session_id = session.room.name
        timer_sessions[session_id] = {
            "active": True,
            "duration": duration,
            "purpose": purpose,
            "start_time": asyncio.get_event_loop().time()
        }
        
        # Provide a successful response to the model
        return {
            "success": True,
            "message": f"Started {purpose} timer for {duration} seconds",
            "timerStarted": True,
            "duration": duration,
            "purpose": purpose
        }
    except Exception as e:
        logger.error(f"Error sending timer control: {str(e)}")
        return {
            "success": False,
            "message": f"Failed to start timer: {str(e)}"
        }


async def check_timer_status(session: AgentSession) -> Dict[str, Any]:
    """
    Check the status of an active timer for the session.
    
    Args:
        session: The current agent session
        
    Returns:
        Timer status information
    """
    session_id = session.room.name
    if session_id not in timer_sessions or not timer_sessions[session_id].get("active", False):
        return {
            "active": False,
            "message": "No active timer"
        }
    
    timer_data = timer_sessions[session_id]
    start_time = timer_data.get("start_time", 0)
    duration = timer_data.get("duration", 0)
    purpose = timer_data.get("purpose", "unknown")
    
    # Calculate elapsed time
    current_time = asyncio.get_event_loop().time()
    elapsed = current_time - start_time
    remaining = max(0, duration - elapsed)
    
    # Check if timer is complete
    if remaining <= 0:
        timer_sessions[session_id]["active"] = False
        return {
            "active": False,
            "completed": True,
            "purpose": purpose,
            "message": f"{purpose.capitalize()} timer has finished"
        }
    
    return {
        "active": True,
        "purpose": purpose,
        "elapsed": elapsed,
        "remaining": remaining,
        "message": f"{purpose.capitalize()} timer is active with {remaining:.1f} seconds remaining"
    }


async def stop_timer(session: AgentSession) -> Dict[str, Any]:
    """
    Stop an active timer for the session.
    
    Args:
        session: The current agent session
        
    Returns:
        Timer stop status
    """
    session_id = session.room.name
    if session_id not in timer_sessions or not timer_sessions[session_id].get("active", False):
        return {
            "success": False,
            "message": "No active timer to stop"
        }
    
    purpose = timer_sessions[session_id].get("purpose", "unknown")
    
    # Set timer as inactive
    timer_sessions[session_id]["active"] = False
    
    # Send timer stop command
    try:
        await session.room.local_participant.publish_data(
            json.dumps({
                "type": "timer_control",
                "data": {
                    "action": "stop",
                    "purpose": purpose
                }
            }).encode("utf-8"),
            topic="agent-tools"
        )
        
        return {
            "success": True,
            "message": f"Stopped {purpose} timer"
        }
    except Exception as e:
        logger.error(f"Error stopping timer: {str(e)}")
        return {
            "success": False,
            "message": f"Failed to stop timer: {str(e)}"
        }
