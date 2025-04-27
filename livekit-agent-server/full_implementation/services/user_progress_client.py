"""
User Progress Service Client

This module provides functions to interact with the User Progress Service API,
which handles user progress tracking, SRS schedules, and curriculum/ToC functionality.
"""

import os
import logging
import httpx
from typing import Dict, List, Any, Optional

from .http_client import get_client

# Configure logging
logger = logging.getLogger(__name__)

# Configure service URL from environment variable, with fallback to localhost
USER_PROGRESS_SERVICE_URL = os.environ.get("USER_PROGRESS_SERVICE_URL", "http://localhost:8001")

class UserProgressServiceError(Exception):
    """Exception raised for User Progress Service errors"""
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


async def save_progress(user_id: str, task_id: str, content_ref_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save user progress for a task
    
    Args:
        user_id (str): User identifier
        task_id (str): Task identifier
        content_ref_id (str): Content reference identifier (e.g., word_id, topic_id)
        data (Dict[str, Any]): Progress data to save
        
    Returns:
        Dict[str, Any]: Response from the service
        
    Raises:
        UserProgressServiceError: If the request fails
    """
    try:
        logger.info(f"Saving progress for user {user_id}, task {task_id}, content {content_ref_id}")
        client = get_client()
        
        # Prepare the request payload
        payload = {
            "taskId": task_id,
            "contentRefId": content_ref_id,
            "data": data
        }
        
        # For now, we're using a simple endpoint that doesn't require the user_id in the URL
        # The mock service authenticates the user from the JWT and knows who "me" is
        response = await client.post(f"{USER_PROGRESS_SERVICE_URL}/users/me/progress", json=payload)
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise UserProgressServiceError(
            f"Failed to save progress: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise UserProgressServiceError(f"Request to User Progress Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise UserProgressServiceError(f"Unexpected error: {str(exc)}")


async def get_user_progress(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all progress records for a user
    
    Args:
        user_id (str): User identifier
        
    Returns:
        List[Dict[str, Any]]: List of progress records
        
    Raises:
        UserProgressServiceError: If the request fails
    """
    try:
        logger.info(f"Fetching progress for user {user_id}")
        client = get_client()
        
        # For now, we're using a simple endpoint that doesn't require the user_id in the URL
        # The mock service authenticates the user from the JWT and knows who "me" is
        response = await client.get(f"{USER_PROGRESS_SERVICE_URL}/users/me/progress")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise UserProgressServiceError(
            f"Failed to fetch user progress: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise UserProgressServiceError(f"Request to User Progress Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise UserProgressServiceError(f"Unexpected error: {str(exc)}")


async def get_next_task(user_id: str) -> Dict[str, Any]:
    """
    Get the recommended next task for a user from the ToC (Table of Contents)
    
    Args:
        user_id (str): User identifier
        
    Returns:
        Dict[str, Any]: Next task recommendation
        
    Raises:
        UserProgressServiceError: If the request fails
    """
    try:
        logger.info(f"Fetching next task recommendation for user {user_id}")
        client = get_client()
        
        # For now, we're using a simple endpoint that doesn't require the user_id in the URL
        # The mock service authenticates the user from the JWT and knows who "me" is
        response = await client.get(f"{USER_PROGRESS_SERVICE_URL}/users/me/toc/next")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise UserProgressServiceError(
            f"Failed to fetch next task: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise UserProgressServiceError(f"Request to User Progress Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise UserProgressServiceError(f"Unexpected error: {str(exc)}")


async def get_review_items(user_id: str) -> List[Dict[str, Any]]:
    """
    Get SRS review items that are due for the user
    
    Args:
        user_id (str): User identifier
        
    Returns:
        List[Dict[str, Any]]: List of review items
        
    Raises:
        UserProgressServiceError: If the request fails
    """
    try:
        logger.info(f"Fetching SRS review items for user {user_id}")
        client = get_client()
        
        # For now, we're using a simple endpoint that doesn't require the user_id in the URL
        # The mock service authenticates the user from the JWT and knows who "me" is
        response = await client.get(f"{USER_PROGRESS_SERVICE_URL}/users/me/srs/review-items")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise UserProgressServiceError(
            f"Failed to fetch review items: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise UserProgressServiceError(f"Request to User Progress Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise UserProgressServiceError(f"Unexpected error: {str(exc)}")
