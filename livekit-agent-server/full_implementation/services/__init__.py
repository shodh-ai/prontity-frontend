"""
Services Package

This package contains client modules for external services used by the agent.
"""

# Import shared HTTP client functionality
from .http_client import (
    initialize, 
    close, 
    get_client, 
    http_client_context
)

# Import service-specific clients
from .content_client import (
    get_vocab_word,
    get_vocab_list,
    get_speaking_topic,
    get_speaking_topics,
    get_writing_prompt,
    get_writing_prompts,
    ContentServiceError
)

from .user_progress_client import (
    save_progress,
    get_user_progress,
    get_next_task,
    get_review_items,
    UserProgressServiceError
)

from .canvas_client import (
    load_canvas,
    save_canvas,
    delete_canvas,
    get_all_canvases,
    CanvasServiceError
)

# Expose these symbols for easier importing
__all__ = [
    # HTTP client
    'initialize', 
    'close', 
    'get_client', 
    'http_client_context',
    
    # Content client
    'get_vocab_word',
    'get_vocab_list',
    'get_speaking_topic',
    'get_speaking_topics',
    'get_writing_prompt',
    'get_writing_prompts',
    'ContentServiceError',
    
    # User progress client
    'save_progress',
    'get_user_progress',
    'get_next_task',
    'get_review_items',
    'UserProgressServiceError',
    
    # Canvas client
    'load_canvas',
    'save_canvas',
    'delete_canvas',
    'get_all_canvases',
    'CanvasServiceError'
]
