"""
Gemini Client Module

This module handles interactions with Google's Gemini API for the AI agent.
It provides functions to initialize, manage, and interact with the Gemini
chat session with proper tool handling.
"""

import logging
import os
import json
from typing import Dict, List, Any, Optional

from google.generativeai.types import Tool
from livekit.agents import AgentSession
from livekit.plugins.google.beta.realtime import RealtimeModel

logger = logging.getLogger(__name__)

# Store active agent sessions by room name
ACTIVE_SESSIONS = {}

class AgentSessionState:
    """Store state for an active agent session."""
    
    def __init__(self, session_id: str, agent_session: AgentSession):
        """
        Initialize session state.
        
        Args:
            session_id: Unique identifier for this session
            agent_session: Reference to the LiveKit AgentSession
        """
        self.session_id = session_id
        self.agent_session = agent_session
        
        # Initialize state variables
        self.current_persona_config = None
        self.current_page_type = None
        self.current_tools = []
        self.chat_history = []
        
        # Store active gemini model and session
        self.gemini_model = None
        
        # Debug info
        logger.info(f"Created new agent session state for {session_id}")
    
    def update_persona_config(self, persona_config):
        """Update the persona configuration."""
        self.current_persona_config = persona_config
        logger.info(f"Updated persona for {self.session_id} to {persona_config.identity}")
    
    def update_page_type(self, page_type: str):
        """Update the current page type."""
        self.current_page_type = page_type
        logger.info(f"Updated page type for {self.session_id} to {page_type}")
    
    def update_tools(self, tools: List[Any]):
        """Update the available tools for this session."""
        self.current_tools = tools
        tool_names = [getattr(tool, 'name', str(tool)) for tool in tools]
        logger.info(f"Updated tools for {self.session_id}: {tool_names}")


async def initialize_gemini_model(
    session_state: AgentSessionState,
    api_key: Optional[str] = None
) -> bool:
    """
    Initialize the Gemini model for a session with current configuration.
    
    Args:
        session_state: The agent session state
        api_key: Optional API key, defaults to environment variable
        
    Returns:
        True if initialization was successful, False otherwise
    """
    try:
        # Get persona configuration from session state
        config = session_state.current_persona_config
        if not config:
            logger.error("No persona configuration available for model initialization")
            return False
        
        # Get API key from environment if not provided
        if not api_key:
            api_key = os.environ.get("GOOGLE_API_KEY")
            if not api_key:
                logger.error("No API key available for model initialization")
                return False
        
        # Create the Gemini model
        logger.info(f"Initializing Gemini model with persona {config.identity}")
        model = RealtimeModel(
            model="gemini-2.0-flash-exp",  # Use the model that was working before
            voice=config.voice,
            temperature=config.temperature,
            instructions=config.instructions,
            api_key=api_key,
        )
        
        # Update the session state
        session_state.gemini_model = model
        
        # Update the agent session with the new model
        if session_state.agent_session and session_state.agent_session.llm:
            # If there's an existing session, we need to update it
            # This might require restarting the session
            logger.info("Existing agent session found, will need restart after model change")
            
        logger.info(f"Successfully initialized Gemini model for {session_state.session_id}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to initialize Gemini model: {e}")
        return False


async def register_tools_with_model(
    session_state: AgentSessionState,
    tools: List[Any]
) -> bool:
    """
    Register tools with the Gemini model.
    
    Args:
        session_state: The agent session state
        tools: List of Tool objects to register
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Store tools in session state
        session_state.update_tools(tools)
        
        # If we have a model, register the tools
        if session_state.gemini_model:
            # With the current LiveKit API, tools are registered when the model is created
            # or when the session is started/restarted
            logger.info(f"Tools will be registered when session is (re)started")
            return True
        else:
            logger.warning("No Gemini model available to register tools with")
            return False
    
    except Exception as e:
        logger.error(f"Failed to register tools: {e}")
        return False


async def reinitialize_chat(
    session_state: AgentSessionState,
    restart_session: bool = True
) -> bool:
    """
    Reinitialize the chat session with current configuration.
    
    Args:
        session_state: The agent session state
        restart_session: Whether to restart the agent session
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # First, initialize/update the Gemini model
        success = await initialize_gemini_model(session_state)
        if not success:
            logger.error("Failed to initialize Gemini model for chat reinitialization")
            return False
        
        # If restart is requested, we need to restart the agent session
        # This is the only way to apply new model settings in the current LiveKit API
        if restart_session and session_state.agent_session:
            logger.info(f"Restarting agent session for {session_state.session_id}")
            
            # Implementation depends on LiveKit API
            # For now, we just return True and assume the caller will handle restart
            
        return True
    
    except Exception as e:
        logger.error(f"Failed to reinitialize chat: {e}")
        return False


def get_or_create_session_state(session_id: str, agent_session: AgentSession) -> AgentSessionState:
    """
    Get an existing session state or create a new one.
    
    Args:
        session_id: Unique identifier for this session
        agent_session: The LiveKit AgentSession
        
    Returns:
        AgentSessionState object
    """
    if session_id not in ACTIVE_SESSIONS:
        ACTIVE_SESSIONS[session_id] = AgentSessionState(session_id, agent_session)
    
    return ACTIVE_SESSIONS[session_id]


def remove_session_state(session_id: str) -> None:
    """
    Remove a session state when the session ends.
    
    Args:
        session_id: Unique identifier for this session
    """
    if session_id in ACTIVE_SESSIONS:
        logger.info(f"Removing session state for {session_id}")
        del ACTIVE_SESSIONS[session_id]
