"""
HTTP Client Module

This module provides a shared httpx AsyncClient instance for making HTTP requests to external services.
It manages connection pooling and timeouts for better performance and reliability.
"""

import os
import httpx
import logging
from typing import Optional
from contextlib import asynccontextmanager

# Configure logging
logger = logging.getLogger(__name__)

# Default timeout values (in seconds)
DEFAULT_TIMEOUT = 10.0
DEFAULT_CONNECT_TIMEOUT = 5.0

# Global client instance
_http_client: Optional[httpx.AsyncClient] = None


def get_client() -> httpx.AsyncClient:
    """
    Get the shared HTTP client instance.
    
    Returns:
        httpx.AsyncClient: The shared client instance
    
    Raises:
        RuntimeError: If the client hasn't been initialized
    """
    global _http_client
    if _http_client is None:
        raise RuntimeError("HTTP client not initialized. Call initialize() first.")
    return _http_client


async def initialize(
    timeout: float = None,
    connect_timeout: float = None,
    limits: httpx.Limits = None,
    verify_ssl: bool = True
) -> httpx.AsyncClient:
    """
    Initialize the shared HTTP client.
    
    Args:
        timeout (float, optional): Request timeout in seconds. Defaults to DEFAULT_TIMEOUT.
        connect_timeout (float, optional): Connection timeout in seconds. Defaults to DEFAULT_CONNECT_TIMEOUT.
        limits (httpx.Limits, optional): Connection pool limits. Defaults to httpx defaults.
        verify_ssl (bool, optional): Whether to verify SSL certificates. Defaults to True.
        
    Returns:
        httpx.AsyncClient: The initialized client
    """
    global _http_client
    
    # Read timeouts from environment or use defaults
    if timeout is None:
        timeout = float(os.environ.get("HTTP_CLIENT_TIMEOUT", DEFAULT_TIMEOUT))
    
    if connect_timeout is None:
        connect_timeout = float(os.environ.get("HTTP_CLIENT_CONNECT_TIMEOUT", DEFAULT_CONNECT_TIMEOUT))
    
    # Configure timeouts
    timeouts = httpx.Timeout(
        timeout=timeout,
        connect=connect_timeout
    )
    
    # Configure connection limits if not provided
    if limits is None:
        limits = httpx.Limits(
            max_keepalive_connections=5,
            max_connections=10
        )
    
    # Create the client if it doesn't exist
    if _http_client is None or _http_client.is_closed:
        logger.info(f"Initializing HTTP client with timeout={timeout}s, connect_timeout={connect_timeout}s")
        _http_client = httpx.AsyncClient(
            timeout=timeouts,
            limits=limits,
            verify=verify_ssl,
            follow_redirects=True
        )
    
    return _http_client


async def close():
    """
    Close the shared HTTP client.
    """
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        logger.info("Closing HTTP client")
        await _http_client.aclose()
        _http_client = None


@asynccontextmanager
async def http_client_context():
    """
    Context manager for the HTTP client.
    
    Usage:
        async with http_client_context() as client:
            response = await client.get("https://example.com")
            
    Yields:
        httpx.AsyncClient: The HTTP client
    """
    await initialize()
    try:
        yield get_client()
    finally:
        await close()
