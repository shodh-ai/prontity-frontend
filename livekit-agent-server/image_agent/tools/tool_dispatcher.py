"""
Tool Dispatcher

This module provides functions to dispatch incoming tool calls from the AI
to the appropriate tool handler implementations.
"""

import logging
import json
from typing import Dict, Any, Callable, Optional, Awaitable

from livekit.agents import AgentSession

# Import all tool handlers
from .timer_tools import handle_start_timer

logger = logging.getLogger(__name__)

# Map tool names to their handler functions
TOOL_HANDLERS = {
    "startTimer": handle_start_timer,
    # Add more tools as they are implemented
}

async def dispatch_tool_call(
    session: AgentSession, 
    tool_name: str, 
    tool_args: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Dispatches a tool call to the appropriate handler function.
    
    Args:
        session: The current agent session
        tool_name: The name of the tool being called
        tool_args: The arguments for the tool call
        
    Returns:
        The response from the tool handler
    """
    logger.info(f"Dispatching tool call: {tool_name} with args: {tool_args}")
    
    # Look up the handler for the tool
    handler = TOOL_HANDLERS.get(tool_name)
    
    if not handler:
        logger.warning(f"No handler found for tool: {tool_name}")
        return {
            "success": False,
            "message": f"Tool not implemented: {tool_name}"
        }
    
    try:
        # Call the handler with the session and arguments
        response = await handler(session, tool_args)
        logger.info(f"Tool {tool_name} executed successfully: {response}")
        return response
    except Exception as e:
        logger.error(f"Error executing tool {tool_name}: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": f"Error executing tool {tool_name}: {str(e)}"
        }


async def handle_tool_response(
    session: AgentSession,
    tool_name: str,
    response: Dict[str, Any]
) -> None:
    """
    Process and handle the response from a tool execution.
    
    Args:
        session: The current agent session
        tool_name: The name of the tool that was called
        response: The response data from the tool handler
    """
    logger.info(f"Handling tool response for {tool_name}: {response}")
    
    # For now, simply log the response
    # Later, this could update UI state, send notifications, etc.
    
    # Example: send command to UI based on tool response
    if tool_name == "startTimer" and response.get("success", False):
        logger.info(f"Timer started: {response.get('duration')}s for {response.get('purpose', 'speaking')}")
        
        # Could send additional UI updates or notifications here
        # For example, sending a notification to indicate timer started successfully
        try:
            notification_data = {
                "type": "notification",
                "data": {
                    "level": "info",
                    "message": f"Timer started: {response.get('duration')}s",
                    "source": "agent"
                }
            }
            
            # This is optional - only if we want to send UI notifications
            # await session.room.local_participant.publish_data(
            #     json.dumps(notification_data).encode("utf-8"),
            #     topic="agent-ui"
            # )
        except Exception as e:
            logger.error(f"Error sending notification: {str(e)}")


async def process_tool_call(
    session: AgentSession,
    function_call: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Process a function (tool) call from the AI and return the response.
    
    Args:
        session: The current agent session
        function_call: The function call data from the AI
        
    Returns:
        The function response to return to the AI
    """
    try:
        tool_name = function_call.get("name", "")
        tool_args = json.loads(function_call.get("args", "{}"))
        
        # Dispatch the tool call
        response = await dispatch_tool_call(session, tool_name, tool_args)
        
        # Handle the tool response (UI updates, etc.)
        await handle_tool_response(session, tool_name, response)
        
        # Return the response for the AI
        return {
            "name": tool_name,
            "response": response
        }
    except Exception as e:
        logger.error(f"Error processing tool call: {str(e)}", exc_info=True)
        return {
            "name": function_call.get("name", "unknown"),
            "response": {
                "success": False,
                "message": f"Error processing tool call: {str(e)}"
            }
        }
