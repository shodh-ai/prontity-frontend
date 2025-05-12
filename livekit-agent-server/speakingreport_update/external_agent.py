# external_agent.py (Weather Agent Backend with OpenAI Function Calling)

import os
import json
import logging
from flask import Flask, request, jsonify
from openai import OpenAI  # Use the new OpenAI library structure
from dotenv import load_dotenv

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

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

# --- Mock Weather Function ---
def get_current_weather(location: str, unit: str = "celsius") -> str:
    """
    Simulates getting the current weather for a given location.
    In a real application, this would call a weather API.
    """
    logger.info(f"Simulating weather fetch for: {location} (unit: {unit})")
    # Simple mock data based on location
    if "tokyo" in location.lower():
        weather_info = {"location": location, "temperature": "15", "unit": unit, "forecast": "rainy"}
    elif "san francisco" in location.lower():
        weather_info = {"location": location, "temperature": "18", "unit": unit, "forecast": "sunny"}
    elif "jaipur" in location.lower():
         weather_info = {"location": location, "temperature": "35", "unit": unit, "forecast": "sunny and hot"}
    else:
        weather_info = {"location": location, "temperature": "22", "unit": unit, "forecast": "cloudy"}

    # Return as a JSON string (as required by OpenAI function calling spec)
    return json.dumps(weather_info)

# --- OpenAI Function Definition ---
# Describe the function(s) the model can call
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g., San Francisco, CA",
                    },
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        },
    }
]

# --- Flask Route ---
@app.route('/process', methods=['POST'])
def process_transcript():
    """
    Receives transcript, uses OpenAI function calling for weather, returns response.
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
    messages = [{"role": "user", "content": transcript}]
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

        # --- Step 2: Check if the model wants to call a function ---
        if tool_calls:
            logger.info("OpenAI requested a function call.")
            # For this example, we only handle the first tool call if multiple exist
            available_functions = {
                "get_current_weather": get_current_weather,
            }
            tool_call = tool_calls[0] # Get the first tool call
            function_name = tool_call.function.name
            function_to_call = available_functions.get(function_name)

            if not function_to_call:
                 logger.warning(f"Model requested unknown function: {function_name}")
                 final_response = "Sorry, I can't perform that action."
            else:
                try:
                    function_args = json.loads(tool_call.function.arguments)
                    logger.info(f"Calling function '{function_name}' with args: {function_args}")
                    # --- Step 3: Call the actual function ---
                    function_response = function_to_call(
                        location=function_args.get("location"),
                        unit=function_args.get("unit", "celsius"), # Default to celsius if not provided
                    )
                    logger.info(f"Function '{function_name}' returned: {function_response}")

                    # --- Step 4: Send function result back to OpenAI for final response ---
                    # (Optional but recommended for more natural language)
                    # For simplicity here, we'll format the response directly.
                    # If you wanted OpenAI to summarize, you'd make another API call:
                    # messages.append(response_message) # Add assistant's msg with tool_calls
                    # messages.append(
                    #     {
                    #         "tool_call_id": tool_call.id,
                    #         "role": "tool",
                    #         "name": function_name,
                    #         "content": function_response,
                    #     }
                    # )
                    # second_response = client.chat.completions.create(model="gpt-4o-mini", messages=messages)
                    # final_response = second_response.choices[0].message.content

                    # --- Direct Formatting (Simpler for this example) ---
                    try:
                        weather_data = json.loads(function_response)
                        final_response = (
                            f"The current weather in {weather_data['location']} "
                            f"is {weather_data['temperature']} degrees {weather_data['unit']} "
                            f"with {weather_data['forecast']} conditions."
                        )
                    except json.JSONDecodeError:
                        logger.error("Failed to parse function response JSON.")
                        final_response = "Sorry, I couldn't get the weather details correctly."

                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON arguments from OpenAI: {tool_call.function.arguments}")
                    final_response = "Sorry, I couldn't understand the location properly."
                except Exception as e:
                    logger.error(f"Error calling function {function_name}: {e}")
                    final_response = f"Sorry, there was an error getting the weather for {function_args.get('location')}."

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
    return jsonify({"response": final_response})

if __name__ == '__main__':
    # Make sure to run on a host accessible by your LiveKit agent
    # Use port 5005 to match the URL expected by custom_llm.py
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False) # Use debug=False for stability

