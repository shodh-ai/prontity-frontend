"""
Tool Definitions

This module defines all tools that can be used by the agent personas.
Each tool is defined as a FunctionDeclaration with parameter specifications.
"""

import logging
from typing import Dict, Any, List, Callable, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

@dataclass
class ParameterSpec:
    """Specification for a parameter to a tool function."""
    name: str
    type: str
    description: str
    enum: Optional[List[str]] = None
    required: bool = True


@dataclass
class FunctionDeclaration:
    """Declaration of a tool function that can be used by the agent."""
    name: str
    description: str
    parameters: List[ParameterSpec]
    handler: Optional[Callable] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the FunctionDeclaration to a format suitable for Gemini API."""
        params_dict = {}
        required_params = []
        
        for param in self.parameters:
            param_spec = {
                "type": param.type,
                "description": param.description
            }
            
            if param.enum:
                param_spec["enum"] = param.enum
                
            params_dict[param.name] = param_spec
            
            if param.required:
                required_params.append(param.name)
        
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": params_dict,
                "required": required_params
            }
        }


# Define the startTimer tool
START_TIMER_TOOL = FunctionDeclaration(
    name="startTimer",
    description="Starts a countdown timer for the student. Use this for preparation time (15 seconds) or speaking time (45 seconds).",
    parameters=[
        ParameterSpec(
            name="duration",
            type="integer",
            description="Duration of the timer in seconds. Typically 15 seconds for preparation time or 45 seconds for speaking time.",
            required=True
        ),
        ParameterSpec(
            name="purpose",
            type="string",
            description="Purpose of the timer - preparation or speaking.",
            enum=["preparation", "speaking"],
            required=True
        )
    ]
)

# Define the getSpeechFeedback tool (placeholder)
GET_SPEECH_FEEDBACK_TOOL = FunctionDeclaration(
    name="getSpeechFeedback",
    description="Retrieves automated feedback about the student's speech, including fluency, accuracy, and content analysis.",
    parameters=[]
)

# Define the recordTaskCompletion tool (placeholder)
RECORD_TASK_COMPLETION_TOOL = FunctionDeclaration(
    name="recordTaskCompletion",
    description="Records that the student has completed this speaking task and updates their progress.",
    parameters=[
        ParameterSpec(
            name="score",
            type="integer",
            description="Estimated score for the student's performance on a scale of 1-5.",
            required=True
        ),
        ParameterSpec(
            name="completionNotes",
            type="string",
            description="Brief notes about the student's performance for progress tracking.",
            required=False
        )
    ]
)

# Define the navigateTo tool (placeholder)
NAVIGATE_TO_TOOL = FunctionDeclaration(
    name="navigateTo",
    description="Navigate the student to a different practice section or page.",
    parameters=[
        ParameterSpec(
            name="destination",
            type="string",
            description="The destination page to navigate to.",
            enum=["speaking", "writing", "reading", "listening", "vocabulary", "home"],
            required=True
        )
    ]
)

# Dictionary mapping tool names to their FunctionDeclaration objects
TOOL_DEFINITIONS = {
    "startTimer": START_TIMER_TOOL,
    "getSpeechFeedback": GET_SPEECH_FEEDBACK_TOOL,
    "recordTaskCompletion": RECORD_TASK_COMPLETION_TOOL,
    "navigateTo": NAVIGATE_TO_TOOL
}

# Tool implementation handlers will be added separately, but stub implementations here:

async def handle_start_timer(tool_call_args: Dict[str, Any], session_context: Any) -> Dict[str, Any]:
    """
    Handle a startTimer tool call.
    
    Args:
        tool_call_args: Arguments from the tool call
        session_context: Context for the current session
        
    Returns:
        Response for the tool call
    """
    duration = tool_call_args.get("duration", 0)
    purpose = tool_call_args.get("purpose", "")
    
    logger.info(f"Starting {purpose} timer for {duration} seconds")
    
    # This is just a placeholder - actual implementation will interact with the UI
    return {
        "success": True,
        "message": f"Started {purpose} timer for {duration} seconds",
        "timerStarted": True,
        "duration": duration,
        "purpose": purpose
    }


# Assign handler functions to tools
START_TIMER_TOOL.handler = handle_start_timer
