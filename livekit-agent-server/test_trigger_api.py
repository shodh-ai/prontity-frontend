import requests
import json
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_agent_trigger_api():
    """
    Test function to manually trigger the agent-trigger API endpoint
    """
    try:
        # API endpoint URL
        url = "http://localhost:3000/api/agent-trigger"
        logger.info(f"Testing API endpoint: {url}")
        
        # Test payload
        payload = {
            "action": "generate_image",
            "word": "serendipity_test",
            "prompt": "A beautiful visualization of a happy coincidence or lucky discovery, with vibrant colors"
        }
        
        logger.info(f"Sending payload: {json.dumps(payload, indent=2)}")
        
        # Make the request
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10  # Longer timeout for testing
        )
        
        # Log the response details
        logger.info(f"Response status code: {response.status_code}")
        
        try:
            response_json = response.json()
            logger.info(f"Response JSON: {json.dumps(response_json, indent=2)}")
        except Exception:
            logger.info(f"Response text: {response.text}")
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Error in test: {type(e).__name__}: {e}")
        return False

if __name__ == "__main__":
    logger.info("=== Starting API Test ===")
    success = test_agent_trigger_api()
    logger.info(f"Test {'succeeded' if success else 'failed'}")
    logger.info("=== Test Complete ===")
