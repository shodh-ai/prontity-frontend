#!/usr/bin/env python3
# speaking_report_agent.py (Speaking Report Agent with OpenAI Function Calling)

import json
import logging
import os
import requests
import time
import uuid
import asyncio
from openai import OpenAI
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Import the highlight handler
from highlight_handler import HighlightHandler

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# URL for the frontend API endpoint
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# --- OpenAI Client Initialization ---
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.error("OPENAI_API_KEY environment variable not found.")
    client = None
else:
    client = OpenAI(api_key=openai_api_key)

# --- Initialize Highlight Handler ---
highlight_handler = HighlightHandler(FRONTEND_URL)

# --- Common Commands to Recognize ---
NEXT_COMMANDS = ["next", "next highlight", "move to next", "go to next", "next suggestion", "continue"]
EXPLAIN_COMMANDS = ["explain", "explain this", "tell me more", "what's this", "what's wrong here", "explain issue"]
SUMMARY_COMMANDS = ["summarize", "give me a summary", "overview", "progress", "how many highlights", "status"]

# --- OpenAI Function Definition ---
tools = [
    {
        "type": "function",
        "function": {
            "name": "explain_highlight",
            "description": "Generate an explanation for the current highlight in the text",
            "parameters": {
                "type": "object",
                "properties": {
                    "highlight_id": {
                        "type": "string",
                        "description": "The ID of the highlight to explain"
                    }
                },
                "required": ["highlight_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "next_highlight",
            "description": "Move to the next highlight in the text",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_progress",
            "description": "Get the current progress through the highlights",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]

# --- Function Implementations ---
def explain_highlight(highlight_id=None):
    """
    Generate an explanation for the specified highlight or the current active highlight.
    
    Args:
        highlight_id: ID of the highlight to explain, if None uses the current active highlight
        
    Returns:
        A dictionary with explanation and highlight metadata
    """
    # If no highlight_id is provided, try to get the current active highlight
    if not highlight_id:
        # Try to get the next highlight if there's no specified ID
        highlight = highlight_handler.get_next_highlight()
        if not highlight:
            return {
                "success": False,
                "response": "There are no highlights to explain. The document looks good!"
            }
        highlight_id = highlight.get('id')
    else:
        # Try to find the highlight with the provided ID
        highlight = highlight_handler.get_highlight_by_id(highlight_id)
        
    # If we couldn't get a highlight (either by ID or next), return an error
    if not highlight:
        return {
            "success": False,
            "response": "I couldn't find that specific highlight. Let's try another one."
        }
    
    # Select the highlight in the UI
    select_response = highlight_handler.select_highlight(highlight_id)
    if not select_response.get('success', False):
        logger.warning(f"Failed to select highlight: {highlight_id}")
    
    # Get highlight details
    highlight_text = highlight.get('text', 'Unknown text')
    highlight_type = highlight.get('type', 'suggestion')
    highlight_message = highlight.get('message', '')
    
    # Generate an explanation based on the highlight type
    if highlight_type == 'grammar':
        explanation = f"I noticed a grammar issue with '{highlight_text}'. {highlight_message} Let me explain how to fix this."
    elif highlight_type == 'coherence':
        explanation = f"There's a coherence issue with '{highlight_text}'. {highlight_message} This affects how well your ideas flow together."
    elif highlight_type == 'suggestion':
        explanation = f"I have a suggestion for '{highlight_text}'. {highlight_message} This would make your point stronger."
    elif highlight_type == 'rewrite':
        explanation = f"I recommend rewriting '{highlight_text}'. {highlight_message} This would make your message clearer."
    else:
        explanation = f"Let's look at '{highlight_text}'. {highlight_message}"
    
    # Use OpenAI to generate a more detailed explanation if available
    if client:
        try:
            prompt = f"""
            I need to explain this highlighted text to the user:
            
            Highlighted text: "{highlight_text}"
            Issue type: {highlight_type}
            Basic message: {highlight_message}
            
            Please provide a helpful, educational explanation about why this part of the text was highlighted,
            what specific issue it addresses, and how the user could improve it.
            Be encouraging, specific, and educational in your explanation. 
            
            If relevant, provide a clear example of before and after to illustrate the improvement.
            """
            
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "system", "content": SYSTEM_PROMPT}, 
                          {"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=300
            )
            
            ai_explanation = response.choices[0].message.content
            explanation = ai_explanation
        except Exception as e:
            logger.error(f"Error generating AI explanation: {e}")
            # If there's an error with the AI explanation, use our basic one
    
    # Mark this highlight as explained
    highlight_handler.mark_highlight_explained(highlight_id)
    
    return {
        "success": True,
        "response": explanation,
        "highlight_id": highlight_id,
        "highlight_text": highlight_text,
        "highlight_type": highlight_type
    }

def next_highlight():
    """
    Move to the next highlight in the text.
    
    Returns:
        A dictionary with status and next highlight info
    """
    # Log the current state for debugging
    logger.info(f"Next highlight called. Current state: {len(highlight_handler.highlights)} highlights, current ID: {highlight_handler.current_highlight_id}")
    
    # If no highlights are loaded, try to load test highlights
    if len(highlight_handler.highlights) == 0:
        logger.info("No highlights found. Trying to load test highlights.")
        if use_test_highlights():
            logger.info(f"Successfully loaded {len(highlight_handler.highlights)} test highlights")
        else:
            return {
                "success": False,
                "response": "I don't see any highlights to explain. Please try adding some text with potential issues."
            }
    
    # Check if all highlights have been explained
    if highlight_handler.all_highlights_explained():
        return {
            "success": True,
            "response": "Great! We've gone through all the highlights. Your text looks much better now!",
            "all_completed": True
        }
    
    # Get the next highlight
    next_highlight = highlight_handler.get_next_highlight()
    
    if not next_highlight:
        return {
            "success": False, 
            "response": "I couldn't find any more highlights to explain. You've addressed all the issues in your text!"
        }
    
    # Select the highlight in the UI
    highlight_id = next_highlight.get('id')
    logger.info(f"Selected highlight ID: {highlight_id}")
    select_response = highlight_handler.select_highlight(highlight_id)
    
    if not select_response.get('success', False):
        logger.warning(f"Failed to select highlight: {highlight_id}")
        return {
            "success": False,
            "response": "I had trouble selecting the next highlight. Let's try again."
        }
    
    highlight_text = next_highlight.get('text', 'Unknown text')
    highlight_type = next_highlight.get('type', 'suggestion')
    highlight_message = next_highlight.get('message', 'No specific suggestion available')
    
    # Generate a response message
    response = f"Let's look at the next highlight. This is about {highlight_type} in the phrase: '{highlight_text}'. {highlight_message}"
    
    return {
        "success": True,
        "response": response,
        "highlight_id": highlight_id,
        "highlight_text": highlight_text,
        "highlight_type": highlight_type,
        "highlight_message": highlight_message
    }

def get_progress():
    """
    Get the current progress through the highlights.
    
    Returns:
        A dictionary with progress information
    """
    progress = highlight_handler.get_progress()
    
    response = f"We've covered {progress['explained']} out of {progress['total']} highlights, which is {progress['percent_complete']}% complete. " + \
               f"There are {progress['remaining']} highlights left to review."
               
    return {
        "success": True,
        "response": response,
        "progress": progress
    }

# --- System Prompt for OpenAI ---

# --- Test highlights for debugging ---
TEST_HIGHLIGHTS = [
    {
        "id": "highlight-1",
        "text": "This sentence has a grammar error.",
        "start": 0,
        "end": 35,
        "type": "grammar",
        "message": "Consider revising the subject-verb agreement."
    },
    {
        "id": "highlight-2",
        "text": "This part could be more concise and direct.",
        "start": 40,
        "end": 80,
        "type": "suggestion",
        "message": "Try to simplify this for better clarity."
    },
    {
        "id": "highlight-3",
        "text": "This statement lacks supporting evidence.",
        "start": 85,
        "end": 125,
        "type": "coherence",
        "message": "Adding an example would strengthen this point."
    }
]

SYSTEM_PROMPT = """
You are a helpful, encouraging speaking coach named Coach Alex. Your role is to help people improve their speaking and presentation skills by providing constructive feedback on their text.

When interacting with users:
1. Be warm, encouraging, and supportive
2. Explain speaking issues in clear, simple language
3. Provide specific suggestions for improvement
4. Focus on the highlighted issues one at a time
5. Use examples to illustrate your points
6. Be patient and positive

For each highlight, explain:
1. What the specific issue is
2. Why it matters for effective speaking
3. How to improve it with a clear example
4. A positive reinforcement about their progress

Always maintain a conversational, supportive tone. Your goal is to help users become better speakers without overwhelming them with too many changes at once.
"""

# --- Helper function for testing highlights ---
def use_test_highlights(force=False):
    """Load test highlights into the highlight handler for debugging
    
    Args:
        force (bool): If True, load test highlights even if there are already highlights loaded
    
    Returns:
        bool: True if highlights were loaded successfully, False otherwise
    """
    # If we already have highlights and force is False, don't overwrite them
    if len(highlight_handler.highlights) > 0 and not force:
        logger.info(f"Already have {len(highlight_handler.highlights)} highlights, not loading test highlights")
        return True
        
    # Since update_highlights is async, we need to run it synchronously
    try:
        # Create a new event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        # Run the async function and get the result
        result = loop.run_until_complete(highlight_handler.update_highlights(TEST_HIGHLIGHTS))
        loop.close()
        logger.info(f"Updated test highlights successfully: {result}")
        
        # Manually set the highlights since the async call might not have updated them properly
        highlight_handler.highlights = TEST_HIGHLIGHTS.copy()
        
        # Set the first highlight as active
        if TEST_HIGHLIGHTS:
            highlight_handler.current_highlight_id = TEST_HIGHLIGHTS[0]['id']
            logger.info(f"Set current highlight ID to: {highlight_handler.current_highlight_id}")
    except Exception as e:
        logger.error(f"Error updating test highlights: {e}")
        return False
    
    logger.info(f"Loaded {len(TEST_HIGHLIGHTS)} test highlights")
    logger.info(f"Current highlight count: {len(highlight_handler.highlights)}")
    return True

# --- Flask Routes ---
@app.route('/check-api', methods=['GET'])
def check_api_route():
    """Check if the frontend API is available and working"""
    try:
        # Try to get highlights from the API
        response = requests.get(
            f"{FRONTEND_URL}/api/get-next-highlight",
            timeout=5
        )
        
        # Return the raw response for debugging
        return jsonify({
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "content": response.json() if response.status_code == 200 else None,
            "url": f"{FRONTEND_URL}/api/get-next-highlight"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "url": f"{FRONTEND_URL}/api/get-next-highlight"
        })

@app.route('/debug-highlights', methods=['GET'])
def debug_highlights_route():
    """Debug endpoint to show current highlight state"""
    # Ensure all data is serializable
    try:
        # Make a safe copy of highlights for serialization
        highlights_safe = []
        for h in highlight_handler.highlights:
            # Convert to a simple dict if it's not already
            if isinstance(h, dict):
                highlights_safe.append(dict(h))  # Create a copy
            else:
                # If it's some other object, convert what we can
                highlights_safe.append({
                    "id": getattr(h, "id", None),
                    "text": getattr(h, "text", None),
                    "start": getattr(h, "start", None),
                    "end": getattr(h, "end", None),
                    "type": getattr(h, "type", None),
                    "message": getattr(h, "message", None)
                })
                
        # Same for explained highlights
        explained_safe = []
        for id in highlight_handler.explained_highlights:
            explained_safe.append(str(id))
            
        return jsonify({
            "success": True,
            "highlights": highlights_safe,
            "current_highlight_id": highlight_handler.current_highlight_id,
            "explained_highlights": explained_safe,
            "test_highlights_available": len(TEST_HIGHLIGHTS),
            "highlight_handler_has": len(highlight_handler.highlights),
            "source": "From API" if len(highlight_handler.highlights) > 0 and not use_test_highlights() else "Test highlights"
        })
    except Exception as e:
        logger.error(f"Error in debug-highlights endpoint: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "highlights_count": len(highlight_handler.highlights) if hasattr(highlight_handler, "highlights") else "unknown",
            "test_highlights_available": len(TEST_HIGHLIGHTS)
        })

@app.route('/test-highlights', methods=['GET'])
def test_highlights_route():
    """Test endpoint to generate and use fake highlights"""
    success = use_test_highlights(force=True)
    return jsonify({
        "success": success,
        "message": f"Generated {len(TEST_HIGHLIGHTS)} test highlights",
        "highlights": TEST_HIGHLIGHTS,
        "current_highlight_id": highlight_handler.current_highlight_id,
        "highlight_count": len(highlight_handler.highlights)
    })

@app.route('/check-frontend', methods=['GET'])
def check_frontend_route():
    """Check connection to frontend and try to pull all available highlights"""
    # Alternative URLs to try
    urls_to_try = [
        f"{FRONTEND_URL}/api/get-next-highlight",
        "http://localhost:3000/api/get-next-highlight",
        "http://127.0.0.1:3000/api/get-next-highlight"
    ]
    
    results = []
    success = False
    
    for url in urls_to_try:
        try:
            logger.info(f"Trying to connect to: {url}")
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                highlights = data.get('highlights', [])
                
                # Try to load these highlights
                if highlights and len(highlights) > 0:
                    # Since update_highlights is async, run it synchronously
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    update_result = loop.run_until_complete(highlight_handler.update_highlights(highlights))
                    loop.close()
                    
                    if update_result:
                        # Set the first highlight as active
                        highlight_handler.current_highlight_id = highlights[0].get('id')
                        success = True
                        logger.info(f"Successfully loaded {len(highlights)} highlights from {url}")
                    
                results.append({
                    "url": url,
                    "status": response.status_code,
                    "highlights_count": len(highlights),
                    "data": data if len(data) < 1000 else "[Response too large to display]"
                })
            else:
                results.append({
                    "url": url,
                    "status": response.status_code,
                    "error": "Non-200 status code"
                })
        except Exception as e:
            results.append({
                "url": url,
                "error": str(e)
            })
    
    # If we couldn't load any real highlights, use test ones
    if not success:
        use_test_highlights(force=True)
        
    return jsonify({
        "success": success,
        "results": results,
        "current_highlight_id": highlight_handler.current_highlight_id,
        "highlight_count": len(highlight_handler.highlights),
        "using_test_highlights": not success
    })

@app.route('/process', methods=['POST'])
def process_transcript():
    """Process incoming transcripts and commands from the LiveKit agent"""
    # Check if the request has the expected format
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.json
    transcript = data.get('transcript', '')
    language = data.get('language', 'en')  # Default to English
    
    # Log incoming data
    logger.info(f"Received transcript: '{transcript}'")
    
    # First try to get highlights from the API
    logger.info("Refreshing highlights from the API")
    
    # Since we're in a synchronous Flask app, we need to call our async function in a synchronous way
    # First, let's make a synchronous wrapper for the async function
    def sync_get_highlights():
        try:
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            # Run the async function and get the result
            result = loop.run_until_complete(highlight_handler.get_current_highlights_from_api())
            loop.close()
            return result
        except Exception as e:
            logger.error(f"Error in sync_get_highlights: {e}")
            return False
    
    # Call our synchronous wrapper
    success = sync_get_highlights()
    logger.info(f"Highlight refresh from API {'succeeded' if success else 'failed'}")
    
    # If no highlights from API, use test highlights for debugging
    highlight_count = len(highlight_handler.highlights)
    if highlight_count == 0:
        logger.info("No highlights from API, using test highlights instead")
        use_test_highlights()
        highlight_count = len(highlight_handler.highlights)
    
    # Log current highlight state
    logger.info(f"Current highlight count: {highlight_count}")
    if highlight_count > 0:
        logger.info(f"Highlight IDs: {[h.get('id') for h in highlight_handler.highlights]}")
    else:
        logger.info("No highlights found, even after trying test highlights")
    
    # Process the transcript as a command if it matches known patterns
    transcript_lower = transcript.lower()
    
    try:
        # Handle "next" commands
        if any(cmd in transcript_lower for cmd in NEXT_COMMANDS):
            result = next_highlight()
            return jsonify(result)
            
        # Handle "explain" commands for the current highlight
        elif any(cmd in transcript_lower for cmd in EXPLAIN_COMMANDS):
            # Get the current highlight ID if one is active
            current_id = highlight_handler.current_highlight_id
            result = explain_highlight(current_id)
            return jsonify(result)
            
        # Handle "summary" commands
        elif any(cmd in transcript_lower for cmd in SUMMARY_COMMANDS):
            result = get_progress()
            return jsonify(result)
            
        # If no direct command is recognized, use function calling with OpenAI
        elif client:
            prompt = f"The user said: '{transcript}'. Determine if they want to explain the current highlight, " + \
                    f"move to the next highlight, or get a progress summary. If none of these apply, provide a helpful response."
            
            try:
                response = client.chat.completions.create(
                    model="gpt-4",
                    messages=[{"role": "system", "content": SYSTEM_PROMPT}, 
                             {"role": "user", "content": prompt}],
                    tools=tools,
                    temperature=0.7
                )
                
                message = response.choices[0].message
                
                # Check if the model wants to call a function
                if message.tool_calls:
                    tool_call = message.tool_calls[0]
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)
                    
                    logger.info(f"Function call: {function_name} with args {function_args}")
                    
                    if function_name == "explain_highlight":
                        highlight_id = function_args.get("highlight_id")
                        result = explain_highlight(highlight_id)
                    elif function_name == "next_highlight":
                        result = next_highlight()
                    elif function_name == "get_progress":
                        result = get_progress()
                    else:
                        result = {"response": "I'm not sure how to help with that. Try asking about the current highlight, moving to the next one, or getting a progress summary."}
                else:
                    # If no function call, use the model's text response
                    result = {"response": message.content}
                
                return jsonify(result)
                
            except Exception as e:
                logger.error(f"Error with OpenAI function calling: {e}")
                # Fall back to basic response on error
        
        # If all else fails or if no OpenAI client, provide a basic response
        result = {
            "response": "I'm your speaking coach. You can ask me to explain the current highlight, move to the next one, or give you a progress summary."
        }
        
        # Also try to provide the next highlight if we haven't yet
        if not highlight_handler.current_highlight_id:
            next_result = next_highlight()
            if next_result["success"]:
                result["response"] += " " + next_result["response"]
        
        return jsonify(result)
                
    except Exception as e:
        logger.error(f"Error processing transcript: {e}")
        return jsonify({
            "response": "I'm sorry, I encountered an error processing your request. Please try again or ask for the next highlight."
        })

# --- Main Entry Point ---
if __name__ == '__main__':
    # Use port 5005 to match the URL expected by custom_llm.py
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Speaking Coach Agent Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
