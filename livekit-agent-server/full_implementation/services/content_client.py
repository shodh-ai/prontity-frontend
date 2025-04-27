"""
Content Service Client

This module provides functions to interact with the Content Service API,
which provides learning content such as vocabulary words, speaking topics, and writing prompts.
"""

import os
import logging
import httpx
from typing import Dict, List, Any, Optional

from .http_client import get_client

# Configure logging
logger = logging.getLogger(__name__)

# Configure service URL from environment variable, with fallback to localhost
CONTENT_SERVICE_URL = os.environ.get("CONTENT_SERVICE_URL", "http://localhost:3001")

class ContentServiceError(Exception):
    """Exception raised for Content Service errors"""
    
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


async def get_vocab_word(word_id: str) -> Dict[str, Any]:
    """
    Fetch details of a vocabulary word by ID
    
    Args:
        word_id (str): The ID of the vocabulary word
        
    Returns:
        Dict[str, Any]: The vocabulary word details
        
    Raises:
        ContentServiceError: If the request fails
    """
    try:
        logger.info(f"Fetching vocabulary word with ID: {word_id}")
        client = get_client()
        response = await client.get(f"{CONTENT_SERVICE_URL}/content/vocab/{word_id}")
        
        if response.status_code == 404:
            raise ContentServiceError(f"Vocabulary word with ID '{word_id}' not found", 404)
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise ContentServiceError(
            f"Failed to fetch vocabulary word: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise ContentServiceError(f"Request to Content Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise ContentServiceError(f"Unexpected error: {str(exc)}")


async def get_vocab_list() -> List[Dict[str, Any]]:
    """
    Fetch list of available vocabulary words
    
    Returns:
        List[Dict[str, Any]]: A list of vocabulary word items
        
    Raises:
        ContentServiceError: If the request fails
    """
    try:
        logger.info("Fetching vocabulary word list")
        client = get_client()
        response = await client.get(f"{CONTENT_SERVICE_URL}/content/vocab")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise ContentServiceError(
            f"Failed to fetch vocabulary word list: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise ContentServiceError(f"Request to Content Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise ContentServiceError(f"Unexpected error: {str(exc)}")


async def get_speaking_topic(topic_id: str) -> Dict[str, Any]:
    """
    Fetch details of a speaking topic by ID
    
    Args:
        topic_id (str): The ID of the speaking topic
        
    Returns:
        Dict[str, Any]: The speaking topic details
        
    Raises:
        ContentServiceError: If the request fails
    """
    try:
        logger.info(f"Fetching speaking topic with ID: {topic_id}")
        client = get_client()
        response = await client.get(f"{CONTENT_SERVICE_URL}/content/speaking/topic/{topic_id}")
        
        if response.status_code == 404:
            raise ContentServiceError(f"Speaking topic with ID '{topic_id}' not found", 404)
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise ContentServiceError(
            f"Failed to fetch speaking topic: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise ContentServiceError(f"Request to Content Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise ContentServiceError(f"Unexpected error: {str(exc)}")


async def get_speaking_topics() -> List[Dict[str, Any]]:
    """
    Fetch list of available speaking topics
    
    Returns:
        List[Dict[str, Any]]: A list of speaking topic items
        
    Raises:
        ContentServiceError: If the request fails
    """
    try:
        logger.info("Fetching speaking topics list")
        client = get_client()
        response = await client.get(f"{CONTENT_SERVICE_URL}/content/speaking/topics")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise ContentServiceError(
            f"Failed to fetch speaking topics list: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise ContentServiceError(f"Request to Content Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise ContentServiceError(f"Unexpected error: {str(exc)}")


async def get_writing_prompt(prompt_id: str) -> Dict[str, Any]:
    """
    Fetch details of a writing prompt by ID
    
    Args:
        prompt_id (str): The ID of the writing prompt
        
    Returns:
        Dict[str, Any]: The writing prompt details
        
    Raises:
        ContentServiceError: If the request fails
    """
    try:
        logger.info(f"Fetching writing prompt with ID: {prompt_id}")
        client = get_client()
        response = await client.get(f"{CONTENT_SERVICE_URL}/content/writing/prompt/{prompt_id}")
        
        if response.status_code == 404:
            raise ContentServiceError(f"Writing prompt with ID '{prompt_id}' not found", 404)
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise ContentServiceError(
            f"Failed to fetch writing prompt: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise ContentServiceError(f"Request to Content Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise ContentServiceError(f"Unexpected error: {str(exc)}")


async def get_writing_prompts() -> List[Dict[str, Any]]:
    """
    Fetch list of available writing prompts
    
    Returns:
        List[Dict[str, Any]]: A list of writing prompt items
        
    Raises:
        ContentServiceError: If the request fails
    """
    try:
        logger.info("Fetching writing prompts list")
        client = get_client()
        response = await client.get(f"{CONTENT_SERVICE_URL}/content/writing/prompts")
        
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
        raise ContentServiceError(
            f"Failed to fetch writing prompts list: {exc.response.text}",
            exc.response.status_code
        )
    except httpx.RequestError as exc:
        logger.error(f"Request error occurred: {str(exc)}")
        raise ContentServiceError(f"Request to Content Service failed: {str(exc)}")
    except Exception as exc:
        logger.error(f"Unexpected error: {str(exc)}")
        raise ContentServiceError(f"Unexpected error: {str(exc)}")
