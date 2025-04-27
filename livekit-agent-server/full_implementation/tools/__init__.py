"""
Tool Handlers Package

This package contains implementations of all the tool handlers that 
respond to the AI's tool invocations.
"""

from .tool_dispatcher import dispatch_tool_call
from .timer_tools import handle_start_timer

__all__ = [
    'dispatch_tool_call',
    'handle_start_timer',
]
