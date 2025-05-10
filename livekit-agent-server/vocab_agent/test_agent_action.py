#!/usr/bin/env python3
"""
Simple test script to check if vocab_teacher_agent.py is correctly generating action data
"""

import requests
import json
import sys

def test_vocab_agent():
    """Make a request to the vocab_teacher_agent.py and check the response"""
    url = "http://localhost:5005/process"
    
    # Test request for image generation
    test_transcript = "Can you help me visualize the word ephemeral with an image?"
    
    try:
        print(f"\n--- Sending test request to {url} ---")
        print(f"Transcript: {test_transcript}")
        
        response = requests.post(
            url, 
            json={"transcript": test_transcript},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            print(f"ERROR: Received status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Get the JSON response
        response_data = response.json()
        print("\n--- Response from agent ---")
        print(f"Status code: {response.status_code}")
        print(json.dumps(response_data, indent=2))
        
        # Check for action data
        if "action" in response_data:
            print("\n✅ SUCCESS: Response contains action field")
            print(f"Action: {response_data['action']}")
            
            if "payload" in response_data:
                print("✅ SUCCESS: Response contains payload field")
                print(f"Payload: {json.dumps(response_data['payload'], indent=2)}")
                
                # Check for essential image prompt data
                if response_data.get("action") == "generate_image":
                    if "prompt" in response_data["payload"]:
                        print(f"✅ SUCCESS: Found prompt in payload: {response_data['payload']['prompt']}")
                    else:
                        print("❌ ERROR: No prompt in payload")
                        
                    if "word" in response_data["payload"]:
                        print(f"✅ SUCCESS: Found word in payload: {response_data['payload']['word']}")
                    else:
                        print("❌ ERROR: No word in payload")
            else:
                print("❌ ERROR: No payload field in response")
        else:
            print("\n❌ ERROR: No action field in response")
            
        return response_data
    
    except Exception as e:
        print(f"\n❌ ERROR: An error occurred: {e}")
        return False

if __name__ == "__main__":
    print("Testing vocab_teacher_agent.py for action data generation")
    print("Make sure the agent is running on port 5005")
    
    result = test_vocab_agent()
    
    if not result:
        sys.exit(1)
