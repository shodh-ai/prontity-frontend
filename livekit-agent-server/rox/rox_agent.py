#!/usr/bin/env python3
"""
Rox Assistant Agent Implementation

This agent helps students understand their learning progress and navigate through the platform.
It interacts with the UI by clicking buttons and displaying student information.
"""

import logging
import json
import os
import requests
import time
import uuid
import httpx
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('rox_agent')

# Create Flask app
app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Student Data API URL ---
STUDENT_API_URL = os.getenv("STUDENT_API_URL", "http://localhost:5080/api")

# --- OpenAI Client Initialization ---
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.error("OPENAI_API_KEY environment variable not found.")
    client = None
else:
    client = OpenAI(api_key=openai_api_key)

# --- Student Data Cache ---
student_data_cache = {
    "name": "John Smith",
    "progress": {
        "Listening": "75%",
        "Speaking": "60%",
        "Writing": "82%"
    }
}

# --- Helper Functions ---

def get_student_data():
    """Get the current student data from the cache or API"""
    try:
        # Use the mock API if available
        try:
            response = requests.get(f"{STUDENT_API_URL}/student/current", timeout=3.0)
            if response.status_code == 200:
                data = response.json()
                # Update cache
                student_data_cache.update(data)
                logger.info(f"Successfully fetched student data from API")
            else:
                logger.warning(f"Failed to fetch student data from API: {response.status_code}")
        except requests.RequestException as e:
            logger.warning(f"Error connecting to student data API: {e}")
    except Exception as e:
        logger.error(f"Error in get_student_data: {e}")
    
    # Return current cache
    return student_data_cache

def get_student_status():
    """Get formatted student status for OpenAI function"""
    data = get_student_data()
    return json.dumps(data)

def click_ui_button(button_id):
    """Simulate clicking a button on the UI"""
    logger.info(f"Simulating UI button click on: {button_id}")
    valid_buttons = ["statusViewButton", "startLearningButton"]
    
    if button_id not in valid_buttons:
        result = {"success": False, "message": f"Unknown button ID: {button_id}"}
    else:
        result = {
            "success": True, 
            "message": f"Button {button_id} clicked",
            "button_id": button_id
        }
    
    return json.dumps(result)

# --- OpenAI Function Definitions ---
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_student_status",
            "description": "Get the current student's learning status including scores in different skills",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "click_ui_button",
            "description": "Click a button on the user interface",
            "parameters": {
                "type": "object",
                "properties": {
                    "button_id": {
                        "type": "string",
                        "description": "ID of the button to click. Use 'statusViewButton' to show the student's status panel, 'startLearningButton' to begin a learning session.",
                        "enum": ["statusViewButton", "startLearningButton"]
                    }
                },
                "required": ["button_id"]
            }
        }
    }
]

# --- System Prompt for OpenAI ---
SYSTEM_PROMPT = """
You are Rox, an AI assistant for students using the learning platform. Your role is to:

1. Greet students by name and be friendly and encouraging
2. Help students understand their current learning status
3. Guide them through continuing their learning journey
4. Click UI buttons to help them navigate when needed

You can:
1. Check their status in Listening, Speaking, and Writing skills
2. Click the "View My Status" button to show detailed progress
3. Click the "Start Learning" button to begin their next learning session

Be concise, helpful, and focus on being a supportive learning assistant.
"""

# --- Flask Route for Processing Transcripts ---
@app.route('/process', methods=['POST'])
def process_transcript():
    """Process incoming transcripts and generate agent responses"""
    if not client:
        logger.error("OpenAI client not initialized. Cannot process request.")
        return jsonify({"response": "Sorry, my connection to the AI service is not configured."}), 500

    data = request.get_json()
    if not data or 'transcript' not in data:
        logger.error("Received invalid request data.")
        return jsonify({"error": "Missing 'transcript' in request"}), 400

    transcript = data['transcript']
    logger.info(f"Received transcript: '{transcript}'")

    # Initialize dom_actions for UI manipulation - will be populated by 'hello' or LLM tool call
    dom_actions = None

    # Rule: If transcript starts with "hello" (case-insensitive), prepare to click statusViewButton
    if transcript.lower().strip().startswith("hello"):
        logger.info("Transcript starts with 'hello', preparing to click statusViewButton as a direct rule.")
        dom_actions = [{
            "action": "click",
            "payload": {"selector": "#statusViewButton"}
        }]
    
    # --- Step 1: Get student data to personalize the experience ---
    student_data = get_student_data()
    student_name = student_data.get("name", "student")
    
    # --- Step 2: Call OpenAI with the student context ---
    system_message = {
        "role": "system", 
        "content": SYSTEM_PROMPT + f"\n\nThe student's name is {student_name}. Their current scores are: " + 
                   ", ".join([f"{subject}: {score}" for subject, score in student_data.get("progress", {}).items()])
    }
    
    messages = [system_message, {"role": "user", "content": transcript}]
    
    try:
        logger.info("Calling OpenAI API...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        
        response_message = response.choices[0].message
        logger.debug(f"OpenAI raw response message: {response_message}")

        tool_calls = response_message.tool_calls
        
        # dom_actions may have been set by the 'hello' rule. 
        # If the LLM makes a tool_call to click_ui_button, it will overwrite dom_actions here.

        # --- Step 3: Process any function calls ---
        if tool_calls:
            # Use a more advanced approach with a second API call to process the function results
            messages.append(response_message)  # Add assistant's message with tool_calls
            
            # --- Process each tool call ---
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                
                # Match the function name to the actual function
                function_to_call = None
                if function_name == "get_student_status":
                    function_to_call = get_student_status
                elif function_name == "click_ui_button":
                    function_to_call = click_ui_button
                else:
                    logger.error(f"Unknown function call: {function_name}")
                    continue
                
                # Parse arguments and call the function
                try:
                    function_args = json.loads(tool_call.function.arguments)
                    logger.info(f"Calling function '{function_name}' with args: {function_args}")
                    
                    # Call the appropriate function based on the name
                    if function_name == "get_student_status":
                        function_response = function_to_call()
                    elif function_name == "click_ui_button":
                        button_id = function_args.get("button_id")
                        function_response = function_to_call(button_id)
                        
                        # If this is a button click, prepare DOM actions
                        try:
                            button_result = json.loads(function_response)
                            if button_result.get("success"):
                                # Create DOM action for the button click
                                dom_actions = [{
                                    "action": "click",
                                    "payload": {
                                        "selector": f"#{button_result['button_id']}"
                                    }
                                }]
                                logger.info(f"Created DOM action for button click: {dom_actions}")
                        except Exception as e:
                            logger.error(f"Error processing button click result: {e}")
                    
                    logger.info(f"Function '{function_name}' returned: {function_response}")
                    
                    # Add the function result to messages for the second API call
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name, 
                        "content": function_response
                    })
                    
                except Exception as e:
                    logger.error(f"Error calling function {function_name}: {e}")
                    # Add an error message
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": json.dumps({"error": str(e)})
                    })
            
            # Make a second API call to process the function results
            try:
                logger.info("Making second API call to process function results...")
                second_response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages
                )
                final_response = second_response.choices[0].message.content
                logger.info(f"Generated final response: {final_response}")
            except Exception as e:
                logger.error(f"Error in second API call: {e}")
                final_response = "Sorry, I encountered an error trying to process the results."
        else:
            # No function calls, just use the response text
            final_response = response_message.content
        
        # --- Step 4: Return the response with any DOM actions ---
        result = {"response": final_response}
        if dom_actions:
            result["dom_actions"] = dom_actions
        
        logger.info(f"Final result being returned: {result}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return jsonify({"response": "I'm sorry, I encountered a problem. Please try again."})

# --- Main Entry Point ---
if __name__ == '__main__':
    # Use port 5005 to match the URL expected by custom_llm.py
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Rox Agent Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
