"""
Test script for the Canvas Service client

This standalone script tests the canvas client's ability to connect to
the real vocabulary canvas service.
"""

import os
import sys
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import the services
from services.http_client import initialize, close
from services import canvas_client

async def test_canvas_service():
    """
    Test the canvas service API client against the real Vocabulary Canvas service.
    """
    print("--- Running Canvas Client Test ---")
    try:
        # Initialize the HTTP client
        await initialize()
        
        # Test user and word IDs
        test_user_id = "test-user-123"
        test_word_id = "test-word-abc"
        
        # Test canvas data - using the format expected by the real canvas service (an array of drawing elements)
        test_payload = [
            {
                "id": "path1", 
                "type": "path", 
                "x": 10, 
                "y": 10, 
                "points": [0, 0, 5, 5, 10, 10]
            },
            {
                "id": "rect1",
                "type": "rectangle",
                "x": 50,
                "y": 50,
                "width": 100,
                "height": 75,
                "fill": "#3366FF"
            }
        ]
        
        print(f"Attempting to save canvas for {test_user_id}/{test_word_id}...")
        save_response = await canvas_client.save_canvas(test_user_id, test_word_id, test_payload)
        print(f"Save response: {save_response}")
        
        print(f"Attempting to load canvas for {test_user_id}/{test_word_id}...")
        loaded_data = await canvas_client.load_canvas(test_user_id, test_word_id)
        print(f"Load response: {loaded_data}")
        
        # Test get all canvases
        print(f"Attempting to get all canvases for {test_user_id}...")
        all_canvases = await canvas_client.get_all_canvases(test_user_id)
        print(f"Get All response: {all_canvases}")
        
        # Test delete - uncommenting this would remove the test data
        # print(f"Attempting to delete canvas for {test_user_id}/{test_word_id}...")
        # delete_response = await canvas_client.delete_canvas(test_user_id, test_word_id)
        # print(f"Delete response: {delete_response}")
        
        print("Canvas Client Test SUCCESSFUL!")
    except Exception as e:
        print(f"Canvas Client Test FAILED: {e}")
    finally:
        # Clean up the HTTP client
        await close()
        print("--- Canvas Client Test Finished ---")

# Run the test function
if __name__ == "__main__":
    asyncio.run(test_canvas_service())
