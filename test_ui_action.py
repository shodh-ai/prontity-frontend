#!/usr/bin/env python3
"""
Test script for sending UI actions to the FastAPI backend.
This helps verify the integration between FastAPI and LiveKit agent.
"""

import requests
import json
import logging
import argparse
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_ui_action")

def send_test_ui_action(backend_url, action_type, target_element_id=None, parameters=None):
    """Send a test UI action to the backend."""
    if parameters is None:
        parameters = {}
        
    # Construct the action
    action = {
        "action_type": action_type,
        "target_element_id": target_element_id,
        "parameters": parameters
    }
    
    # Remove None values
    action = {k: v for k, v in action.items() if v is not None}
    
    logger.info(f"Sending UI action: {json.dumps(action, indent=2)}")
    
    try:
        # Send to the test endpoint
        response = requests.post(
            f"{backend_url}/test/ui_actions",
            json=[action],
            headers={"Content-Type": "application/json"}
        )
        
        # Check response
        if response.status_code == 200:
            logger.info(f"Success! Status code: {response.status_code}")
            logger.info(f"Response: {json.dumps(response.json(), indent=2)}")
            return True
        else:
            logger.error(f"Error! Status code: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"Failed to send request: {e}")
        return False

def main():
    """Parse command line arguments and send test UI action."""
    parser = argparse.ArgumentParser(description="Send a test UI action to the backend")
    
    parser.add_argument(
        "--backend_url", 
        default="http://localhost:5005",
        help="URL of the FastAPI backend (default: http://localhost:5005)"
    )
    
    parser.add_argument(
        "--action_type", 
        default="SHOW_ALERT",
        help="Type of UI action to perform (default: SHOW_ALERT)"
    )
    
    parser.add_argument(
        "--target_element_id", 
        default=None,
        help="ID of the target DOM element, if applicable"
    )
    
    parser.add_argument(
        "--message", 
        default="Test alert from command line!",
        help="Message for alerts or text updates (default: 'Test alert from command line!')"
    )
    
    args = parser.parse_args()
    
    # Prepare parameters based on action type
    parameters = {}
    if args.action_type == "SHOW_ALERT":
        parameters = {"message": args.message}
    elif args.action_type == "UPDATE_TEXT_CONTENT":
        if not args.target_element_id:
            logger.error("target_element_id is required for UPDATE_TEXT_CONTENT action")
            sys.exit(1)
        parameters = {"text": args.message}
    
    # Send the action
    success = send_test_ui_action(
        args.backend_url,
        args.action_type,
        args.target_element_id,
        parameters
    )
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
