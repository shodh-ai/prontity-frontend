#!/usr/bin/env python3
"""
Doubt Service - Integration between RPC and LangGraph

This module connects the push-to-talk RPC functionality with the LangGraph
doubt handling workflow. It processes audio transcripts and manages the routing
to appropriate teaching pages.
"""

import logging
import asyncio
import json
import uuid
from typing import Dict, Any, Optional

# Import our LangGraph handler
from langraph_handler import process_student_doubt

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('doubt_service')

class DoubtService:
    """Service for handling student doubts through push-to-talk"""
    
    def __init__(self, agent_instance=None):
        """Initialize with optional agent instance for UI interactions"""
        self.agent_instance = agent_instance
        logger.info("DoubtService initialized")
        
    async def handle_push_to_talk(self, 
                                 student_id: str, 
                                 transcript: str, 
                                 session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Process a push-to-talk transcript from a student
        
        Args:
            student_id: The ID of the student
            transcript: The transcribed audio from push-to-talk
            session_id: Optional session ID for tracking conversations
            
        Returns:
            Dict with response and any UI action data
        """
        logger.info(f"Processing push-to-talk for student {student_id}, session {session_id}")
        logger.info(f"Transcript: {transcript[:50]}..." if transcript else "No transcript")
        
        # Generate a session ID if not provided
        if not session_id:
            session_id = f"session_{uuid.uuid4().hex}"
            logger.info(f"Generated new session ID: {session_id}")
        
        # Empty transcript handling
        if not transcript or transcript.strip() == "":
            logger.warning("Empty transcript received, returning error message")
            return {
                "status": "error",
                "message": "I couldn't hear anything. Please try speaking again.",
                "ui_action": None
            }
        
        try:
            # Process the transcript through our LangGraph workflow
            doubt_response = await process_student_doubt(student_id, transcript)
            
            # Extract the results
            is_doubt = doubt_response.get("is_doubt", False)
            response_message = doubt_response.get("message", "")
            teaching_page = doubt_response.get("teaching_page_url")
            
            # Prepare the response
            response = {
                "status": "success",
                "message": response_message,
                "is_doubt": is_doubt,
                "ui_action": None
            }
            
            # If this is a doubt and we have a teaching page, prepare UI action
            if is_doubt and teaching_page:
                # Prepare UI action for redirecting to teaching page
                response["ui_action"] = {
                    "action_type_str": "REDIRECT_TO_PAGE",
                    "parameters": {
                        "url": teaching_page,
                        "message": "Opening teaching resource...",
                        "buttons": [
                            {
                                "label": "Continue Learning",
                                "action": {"action_type": "NAVIGATE", "url": teaching_page}
                            }
                        ]
                    }
                }
                logger.info(f"Prepared redirect to teaching page: {teaching_page}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing doubt: {e}", exc_info=True)
            return {
                "status": "error",
                "message": "I encountered an error processing your question. Please try again.",
                "ui_action": None
            }
    
    async def send_ui_action(self, action_data: Dict[str, Any]) -> bool:
        """
        Send a UI action to the frontend using the agent's RPC capabilities
        
        Args:
            action_data: The UI action data to send
            
        Returns:
            Boolean indicating success/failure
        """
        if not self.agent_instance or not hasattr(self.agent_instance, 'send_ui_action_to_frontend'):
            logger.warning("Cannot send UI action: agent_instance or send_ui_action_to_frontend not available")
            return False
            
        try:
            await self.agent_instance.send_ui_action_to_frontend(action_data)
            logger.info(f"Successfully sent UI action: {action_data.get('action_type_str', 'unknown')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send UI action to frontend: {e}", exc_info=True)
            return False

# Singleton instance
_doubt_service_instance = None

def get_doubt_service(agent_instance=None):
    """Get or create a singleton DoubtService instance"""
    global _doubt_service_instance
    if _doubt_service_instance is None:
        _doubt_service_instance = DoubtService(agent_instance)
    return _doubt_service_instance
