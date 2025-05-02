"""
Canvas Service Client

This module provides functions to interact with the Canvas Storage Service API,
which handles saving and loading canvas drawing states for vocabulary practice.
"""

import os
import logging
import httpx
from typing import Dict, List, Any, Optional

from .http_client import get_client

# Configure logging
logger = logging.getLogger(__name__)

# Configure service URL from environment variable, with fallback to localhost:3005
CANVAS_SERVICE_URL = os.environ.get("CANVAS_SERVICE_URL", "http://localhost:3005")

class CanvasServiceError(Exception):
    """Exception raised for Canvas Service errors"""
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


async def load_canvas(user_id: str, word_id: str) -> Dict[str, Any]:
    """
    Load canvas state for a user and word
    
    Args:
        user_id (str): User identifier
        word_id (str): Vocabulary word identifier
        
    Returns:
        Dict[str, Any]: Canvas state data
        
    Raises:
        CanvasServiceError: If the request fails
    """
    try:
        logger.info(f"Loading canvas for user {user_id}, word {word_id}")
        client = get_client()
        response = await client.get(f"{CANVAS_SERVICE_URL}/api/user/{user_id}/word/{word_id}/canvas")
        
        if response.status_code == 404:
            # Canvas not found is a valid state - return empty object
            return {}
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.info(f"No canvas found for user {user_id}, word {word_id}")
            return {}
        
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise CanvasServiceError(
            f"Failed to load canvas: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise CanvasServiceError(f"Request to Canvas Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise CanvasServiceError(f"Unexpected error: {str(exc)}")


async def save_canvas(user_id: str, word_id: str, canvas_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save canvas state for a user and word
    
    Args:
        user_id (str): User identifier
        word_id (str): Vocabulary word identifier
        canvas_data (Dict[str, Any]): Canvas state data to save
        
    Returns:
        Dict[str, Any]: Response from the service
        
    Raises:
        CanvasServiceError: If the request fails
    """
    try:
        logger.info(f"Saving canvas for user {user_id}, word {word_id}")
        client = get_client()
        response = await client.post(
            f"{CANVAS_SERVICE_URL}/api/user/{user_id}/word/{word_id}/canvas",
            json=canvas_data
        )
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise CanvasServiceError(
            f"Failed to save canvas: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise CanvasServiceError(f"Request to Canvas Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise CanvasServiceError(f"Unexpected error: {str(exc)}")


async def delete_canvas(user_id: str, word_id: str) -> Dict[str, Any]:
    """
    Delete canvas state for a user and word
    
    Args:
        user_id (str): User identifier
        word_id (str): Vocabulary word identifier
        
    Returns:
        Dict[str, Any]: Response from the service
        
    Raises:
        CanvasServiceError: If the request fails
    """
    try:
        logger.info(f"Deleting canvas for user {user_id}, word {word_id}")
        client = get_client()
        response = await client.delete(f"{CANVAS_SERVICE_URL}/api/user/{user_id}/word/{word_id}/canvas")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise CanvasServiceError(
            f"Failed to delete canvas: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise CanvasServiceError(f"Request to Canvas Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise CanvasServiceError(f"Unexpected error: {str(exc)}")


async def get_all_canvases(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all canvases for a user
    
    Args:
        user_id (str): User identifier
        
    Returns:
        List[Dict[str, Any]]: List of canvas data indexed by word IDs
        
    Raises:
        CanvasServiceError: If the request fails
    """
    try:
        logger.info(f"Fetching all canvases for user {user_id}")
        client = get_client()
        response = await client.get(f"{CANVAS_SERVICE_URL}/api/user/{user_id}/canvas")
        
        if response.status_code == 404:
            # No canvases found is a valid state - return empty list
            return []
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.info(f"No canvases found for user {user_id}")
            return []
        
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise CanvasServiceError(
            f"Failed to fetch canvases: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise CanvasServiceError(f"Request to Canvas Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise CanvasServiceError(f"Unexpected error: {str(exc)}")
