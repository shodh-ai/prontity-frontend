#!/usr/bin/env python3
"""
Debug Testing Script for Rox Agent

This script tests the Rox Agent API directly without going through LiveKit.
It sends test transcripts to the agent and verifies the responses.
"""

import requests
import json
import time
import logging
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
ROX_AGENT_URL = "http://localhost:5005/process"
MOCK_API_URL = "http://localhost:5050/api/student/current"

def test_student_data_backend():
    """Test that we can get student data from the mock backend"""
    logger.info(f"Testing connection to mock backend at {MOCK_API_URL}...")
    
    try:
        response = requests.get(MOCK_API_URL, timeout=5)
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Successfully connected to mock backend!")
            logger.info(f"Received student data: {json.dumps(data, indent=2)}")
            return True
        else:
            logger.error(f"Failed to connect to mock backend. Status code: {response.status_code}")
            return False
    except requests.RequestException as e:
        logger.error(f"Error connecting to mock backend: {e}")
        logger.warning("Is the mock_backend.py script running?")
        return False

def test_rox_agent(transcript):
    """Test sending a transcript to the Rox agent and get response"""
    logger.info(f"Testing Rox agent with transcript: '{transcript}'")
    
    try:
        payload = {"transcript": transcript}
        response = requests.post(ROX_AGENT_URL, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Successfully received response from Rox agent!")
            logger.info(f"Response text: '{data.get('response')}'")
            
            # Check if there are DOM actions in the response
            if "dom_actions" in data:
                logger.info(f"DOM actions received: {json.dumps(data['dom_actions'], indent=2)}")
            
            return data
        else:
            logger.error(f"Failed to get response from Rox agent. Status code: {response.status_code}")
            return None
    except requests.RequestException as e:
        logger.error(f"Error connecting to Rox agent: {e}")
        logger.warning("Is the rox_agent.py script running?")
        return None

def run_test_scenarios():
    """Run a series of test scenarios to validate Rox agent functionality"""
    scenarios = [
        {
            "name": "Greeting",
            "transcript": "Hello, I'm a student using the platform. Can you help me?",
            "expect_dom_actions": False
        },
        {
            "name": "Ask for status",
            "transcript": "What's my current learning status?",
            "expect_dom_actions": False
        },
        {
            "name": "Request to view status",
            "transcript": "Can you show me my status by clicking the status button?",
            "expect_dom_actions": True,
            "expected_button": "statusViewButton"
        },
        {
            "name": "Request to start learning",
            "transcript": "I want to start learning now, can you click the start button?",
            "expect_dom_actions": True,
            "expected_button": "startLearningButton"
        }
    ]
    
    results = []
    
    for scenario in scenarios:
        logger.info(f"\n--- TESTING SCENARIO: {scenario['name']} ---")
        response = test_rox_agent(scenario["transcript"])
        
        if response:
            success = True
            has_dom_actions = "dom_actions" in response
            
            # Check if DOM actions match expectations
            if scenario["expect_dom_actions"] != has_dom_actions:
                logger.warning(f"DOM action expectation mismatch: Expected {scenario['expect_dom_actions']}, got {has_dom_actions}")
                success = False
            
            # If DOM actions expected, check the button ID
            if scenario["expect_dom_actions"] and has_dom_actions:
                dom_actions = response["dom_actions"]
                if isinstance(dom_actions, list) and len(dom_actions) > 0:
                    action = dom_actions[0]
                    # Extract button ID from the selector
                    if "payload" in action and "selector" in action["payload"]:
                        selector = action["payload"]["selector"]
                        button_id = selector.replace("#", "") if selector.startswith("#") else selector
                        
                        if button_id != scenario["expected_button"]:
                            logger.warning(f"Button ID mismatch: Expected {scenario['expected_button']}, got {button_id}")
                            success = False
                        else:
                            logger.info(f"Button ID matched expectation: {button_id}")
                    else:
                        logger.warning(f"DOM action missing selector payload")
                        success = False
                else:
                    logger.warning(f"DOM actions not in expected format")
                    success = False
            
            results.append({
                "scenario": scenario["name"],
                "success": success,
                "response": response
            })
            
            # Short delay between requests
            time.sleep(1)
        else:
            results.append({
                "scenario": scenario["name"],
                "success": False,
                "response": None
            })
    
    # Print summary
    logger.info("\n--- TEST RESULTS SUMMARY ---")
    for result in results:
        status = "✅ PASSED" if result["success"] else "❌ FAILED"
        logger.info(f"{status} - {result['scenario']}")
    
    # Calculate success rate
    success_count = sum(1 for r in results if r["success"])
    logger.info(f"\nSuccess Rate: {success_count}/{len(results)} scenarios passed ({success_count/len(results)*100:.1f}%)")
    
    return results

if __name__ == "__main__":
    logger.info("Starting Rox Agent test script...")
    
    # First, test the mock backend connection
    mock_backend_available = test_student_data_backend()
    
    if not mock_backend_available:
        logger.warning("Mock backend test failed. You may need to start mock_backend.py")
        choice = input("Continue with Rox agent tests anyway? (y/n): ")
        if choice.lower() != 'y':
            logger.info("Exiting test script.")
            sys.exit(1)
    
    # Run test scenarios
    try:
        results = run_test_scenarios()
        
        # Exit with error code if any tests failed
        if not all(r["success"] for r in results):
            logger.warning("Some tests failed. See logs for details.")
            sys.exit(1)
        else:
            logger.info("All tests passed successfully!")
            sys.exit(0)
    except KeyboardInterrupt:
        logger.info("Test interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error during testing: {e}")
        sys.exit(1)
