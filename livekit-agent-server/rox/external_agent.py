# external_agent.py (Rox Assistant Backend with OpenAI Function Calling)

import os
import json
import logging
import httpx
from flask import Flask, request, jsonify
from openai import OpenAI  # Use the new OpenAI library structure
from dotenv import load_dotenv

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- Student Data API URL ---
STUDENT_API_URL = os.getenv("STUDENT_API_URL", "http://localhost:5050/api")

# --- OpenAI Client Initialization ---
# Make sure OPENAI_API_KEY is set in your environment or .env file
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.error("OPENAI_API_KEY environment variable not found.")
    # Handle the error appropriately in a real application
    # For this example, we'll proceed but API calls will fail.
    client = None
else:
    client = OpenAI(api_key=openai_api_key)

# --- Student Data Functions ---
async def get_student_data():
    """
    Fetches the current student's data from the API.
    Returns the student's name and learning progress.
    """
    try:
        async with httpx.AsyncClient() as client:
            logger.info(f"Fetching student data from: {STUDENT_API_URL}/student/current")
            response = await client.get(f"{STUDENT_API_URL}/student/current", timeout=5.0)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to fetch student data: {response.status_code}")
                return None
    except Exception as e:
        logger.error(f"Error fetching student data: {e}")
        return None

# Synchronous version for the OpenAI function calling
def get_student_status() -> str:
    """
    Gets the current student's learning status.
    In a production environment, this would fetch real-time data.
    """
    logger.info("Fetching student status for OpenAI function")
    # Mock data (in production, we'd use the async fetch)
    student_info = {
        "name": "John Smith",
        "progress": {
            "Listening": "75%",
            "Speaking": "60%",
            "Writing": "82%"
        }
    }
    # Return as a JSON string (as required by OpenAI function calling spec)
    return json.dumps(student_info)

def click_ui_button(button_id: str) -> str:
    """
    Simulates clicking a button on the UI.
    In the real implementation, this would send a message to the frontend
    to trigger a button click via DOM interaction.
    """
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
    
    # Return as a JSON string (as required by OpenAI function calling spec)
    return json.dumps(result)

# --- OpenAI Function Definition ---
# Describe the functions the model can call
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
                        "description": "ID of the button to click (statusViewButton or startLearningButton)",
                        "enum": ["statusViewButton", "startLearningButton"]
                    }
                },
                "required": ["button_id"]
            }
        }
    }
]

# --- Flask Route ---
@app.route('/process', methods=['POST'])
def process_transcript():
    """
    Receives transcript, uses OpenAI function calling for Rox agent actions, returns response.
    """
    if not client:
         logger.error("OpenAI client not initialized. Cannot process request.")
         return jsonify({"response": "Sorry, my connection to the AI service is not configured."}), 500

    data = request.get_json()
    if not data or 'transcript' not in data:
        logger.error("Received invalid request data.")
        return jsonify({"error": "Missing 'transcript' in request"}), 400

    transcript = data['transcript']
    logger.info(f"Received transcript: '{transcript}'")

    # --- Step 1: Call OpenAI to see if function call is needed ---
    system_message = {
        "role": "system", 
        "content": "You are Rox, an AI assistant for students using the learning platform. You help students understand their learning status and navigate through the site. You can check their status and click UI buttons to navigate the interface. Be helpful, friendly, and encouraging."
    }
    messages = [system_message, {"role": "user", "content": transcript}]
    
    try:
        logger.info("Calling OpenAI API...")
        response = client.chat.completions.create(
            model="gpt-4o-mini", # Or another model that supports function calling
            messages=messages,
            tools=tools,
            tool_choice="auto",  # Let the model decide whether to call a function
        )
        response_message = response.choices[0].message
        logger.debug(f"OpenAI raw response message: {response_message}")

        tool_calls = response_message.tool_calls
        
        # Initialize dom_actions for UI manipulation
        dom_actions = None

        # --- Step 2: Check if the model wants to call a function ---
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
                        function_response = function_to_call(
                            button_id=function_args.get("button_id")
                        )
                        
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
            # --- No function call requested by OpenAI ---
            logger.info("OpenAI did not request a function call. Generating generic response.")
            # Get the text response directly from the model if no function was called
            final_response = response_message.content
            if not final_response: # Fallback if content is empty
                 final_response = "I can help with weather information. How can I assist you?"


    except Exception as e:
        logger.error(f"Error calling OpenAI API: {e}")
        final_response = "Sorry, I encountered an error trying to understand your request."

    # --- Return the final response to the LiveKit agent ---
    logger.info(f"Sending final response to LiveKit: '{final_response}'")
    
    # If we have DOM actions, include them in the response
    if dom_actions:
        logger.info(f"Including DOM actions in response: {dom_actions}")
        return jsonify({
            "response": final_response,
            "dom_actions": dom_actions
        })
    else:
        return jsonify({"response": final_response})

if __name__ == '__main__':
    # Make sure to run on a host accessible by your LiveKit agent
    # Use port 5005 to match the URL expected by custom_llm.py
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False) # Use debug=False for stability

