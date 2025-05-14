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
import socketio  # For Socket.IO client connection
import threading

# Import the highlight handler
from highlight_handler import HighlightHandler

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('speaking_report_agent')

# SocketIO Client for direct connection to report_gen_server
class HighlightSocketClient:
    """Socket.IO client that connects directly to the report_gen_server to receive real AI suggestions"""
    
    def __init__(self, socket_url="http://localhost:8001"):
        """Initialize the Socket.IO client"""
        self.socket_url = socket_url
        self.sio = socketio.Client()
        self.connected = False
        self.client_id = str(uuid.uuid4())
        self.highlights = []
        self.lock = threading.Lock()
        
        # Set up event handlers
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('ai_suggestion', self.on_ai_suggestion)
        self.sio.on('message', self.on_message)
        # Add handler for highlights_update message type that the frontend is sending
        self.sio.on('highlights_update', self.on_highlights_update)
        
        # Start connection in a separate thread to avoid blocking
        self.connect_thread = threading.Thread(target=self.connect_socket)
        self.connect_thread.daemon = True
        self.connect_thread.start()
    
    def connect_socket(self):
        """Connect to the Socket.IO server"""
        try:
            logger.info(f"Connecting to Socket.IO server at {self.socket_url}")
            self.sio.connect(self.socket_url)
            self.sio.wait()
        except Exception as e:
            logger.error(f"Error connecting to Socket.IO server: {e}")
    
    def on_connect(self):
        """Called when connected to the Socket.IO server"""
        logger.info(f"Connected to Socket.IO server at {self.socket_url}")
        self.connected = True
    
    def on_disconnect(self):
        """Called when disconnected from the Socket.IO server"""
        logger.info("Disconnected from Socket.IO server")
        self.connected = False
    
    def on_ai_suggestion(self, data):
        """Called when receiving AI suggestions from the server"""
        try:
            suggestions = data.get('suggestions', [])
            logger.info(f"Received {len(suggestions)} AI suggestions from Socket.IO server")
            
            # Convert suggestions to highlight format
            with self.lock:
                self.highlights = []
                for suggestion in suggestions:
                    highlight = {
                        'id': suggestion.get('id', str(uuid.uuid4())),
                        'text': suggestion.get('wrongVersion', ''),
                        'type': suggestion.get('type', 'suggestion'),
                        'message': suggestion.get('message', ''),
                        'start': suggestion.get('start', 0),
                        'end': suggestion.get('end', 0)
                    }
                    self.highlights.append(highlight)
                
                logger.info(f"Processed {len(self.highlights)} highlights from Socket.IO")
        except Exception as e:
            logger.error(f"Error processing AI suggestions: {e}")
    
    def on_message(self, data):
        """Called when receiving a message from the server"""
        try:
            # Log the full message data for debugging
            logger.info(f"Received message from Socket.IO server: {type(data)} - {data}")
            
            # If this is a dictionary, check for a 'type' field
            if isinstance(data, dict):
                msg_type = data.get('type')
                
                # Handle highlights_update messages
                if msg_type == 'highlights_update':
                    logger.info("Processing as highlights_update message")
                    self.process_highlights(data.get('highlights', []))
                
                # The frontend might be sending highlights directly in a field
                elif 'highlights' in data and isinstance(data['highlights'], list):
                    logger.info("Found highlights field in message")
                    self.process_highlights(data['highlights'])
            
            # If it's just a list, it might be just the highlights
            elif isinstance(data, list):
                logger.info("Message appears to be a direct list of highlights")
                self.process_highlights(data)
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    def on_highlights_update(self, data):
        """Called when receiving a highlights_update message from the server"""
        try:
            logger.info(f"Received highlights_update event from Socket.IO server: {type(data)}")
            # Extract highlights from the message - could be the data itself or in a field
            if isinstance(data, dict):
                highlights = data.get('highlights', [])
            elif isinstance(data, list):
                highlights = data
            else:
                logger.warning(f"Unexpected data type in highlights_update: {type(data)}")
                highlights = []
                
            logger.info(f"Received {len(highlights)} highlights from Socket.IO server")
            self.process_highlights(highlights)
        except Exception as e:
            logger.error(f"Error processing highlights_update: {e}")
            
    def process_highlights(self, highlights):
        """Process highlights data and update internal state"""
        if not highlights:
            logger.warning("Received empty highlights list")
            return
            
        try:
            # Log a sample highlight to see its structure
            if highlights and len(highlights) > 0:
                logger.info(f"Sample highlight: {highlights[0]}")
            
            # Update our highlights
            with self.lock:
                self.highlights = highlights
                
            logger.info(f"Updated highlights from Socket.IO: {len(self.highlights)} items")
        except Exception as e:
            logger.error(f"Error processing highlights: {e}")
    
    def send_text(self, text):
        """Send text to the Socket.IO server for analysis"""
        if not self.connected:
            logger.warning("Cannot send text: not connected to Socket.IO server")
            return False
        
        try:
            logger.info(f"Sending text to Socket.IO server for analysis: {text[:50]}...")
            self.sio.emit('message', {
                'type': 'text_content',
                'content': text
            })
            return True
        except Exception as e:
            logger.error(f"Error sending text to Socket.IO server: {e}")
            return False
    
    def get_highlights(self):
        """Get the current highlights"""
        with self.lock:
            return self.highlights.copy()
    
    def close(self):
        """Close the Socket.IO connection"""
        try:
            if self.connected:
                self.sio.disconnect()
        except Exception as e:
            logger.error(f"Error closing Socket.IO connection: {e}")


# URL for the frontend API endpoint
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000/')

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

# Initialize highlight handler
highlight_handler = HighlightHandler(FRONTEND_URL)

# Initialize Socket.IO client for direct connection to report_gen_server
socket_io_url = os.getenv('SOCKET_IO_URL', 'http://localhost:8001')
socket_client = HighlightSocketClient(socket_io_url)

# Function to update highlights from Socket.IO
def update_highlights_from_socket():
    """Update highlights from the Socket.IO connection if available"""
    socket_highlights = socket_client.get_highlights()
    
    if socket_highlights and len(socket_highlights) > 0:
        logger.info(f"Updating highlights from Socket.IO: {len(socket_highlights)} items")
        # Update the highlight handler with data from socket
        highlight_handler.highlights = socket_highlights
        
        # If there's no current highlight ID set but we have highlights, set the first one
        if not highlight_handler.current_highlight_id and len(socket_highlights) > 0:
            highlight_handler.current_highlight_id = socket_highlights[0].get('id')
            
        return True
    return False

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
    # First ensure we have highlights loaded
    if len(highlight_handler.highlights) == 0:
        logger.info("No highlights found when trying to explain. Loading test highlights.")
        use_test_highlights(force=True)
        if len(highlight_handler.highlights) == 0:
            return {
                "success": False,
                "response": "I don't see any highlights to explain. Please try adding some text with potential issues."
            }
    
    # If no highlight_id is provided, try to get the current active highlight
    if not highlight_id:
        # Check if we have a current active highlight
        if highlight_handler.current_highlight_id:
            highlight_id = highlight_handler.current_highlight_id
            highlight = highlight_handler.get_highlight_by_id(highlight_id)
            if highlight:
                logger.info(f"Using current active highlight: {highlight_id}")
        
        # If no current highlight or it wasn't found, try to get the next highlight
        if not highlight_id or not highlight:
            highlight = highlight_handler.get_next_highlight()
            if not highlight and len(highlight_handler.highlights) > 0:
                # If get_next_highlight failed but we have highlights, use the first one
                highlight = highlight_handler.highlights[0]
                logger.info(f"No next highlight found, using first available: {highlight.get('id')}")
            elif not highlight:
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
    
    # Try to get highlights from Socket.IO first
    logger.info("Trying to get highlights from Socket.IO first")
    socket_success = update_highlights_from_socket()
    
    if socket_success:
        logger.info(f"Successfully loaded {len(highlight_handler.highlights)} highlights from Socket.IO")
        return True
    
    # If Socket.IO failed, fall back to test highlights
    logger.info("Socket.IO didn't have highlights, loading test highlights instead")
    highlight_handler.highlights = TEST_HIGHLIGHTS.copy()
    
    # Set the first highlight as active if needed
    if not highlight_handler.current_highlight_id and TEST_HIGHLIGHTS:
        highlight_handler.current_highlight_id = TEST_HIGHLIGHTS[0].get('id')
        logger.info(f"Set current highlight ID to {highlight_handler.current_highlight_id}")
        
    # Reset explained highlights
    highlight_handler.explained_highlights = set()
    
    return len(highlight_handler.highlights) > 0   

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

@app.route('/load-test-highlights', methods=['GET'])
def load_test_highlights():
    success = use_test_highlights(force=True)
    return jsonify({
        "success": success,
        "message": f"Loaded {len(highlight_handler.highlights)} test highlights",
        "highlights": highlight_handler.highlights
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

# Check frontend connectivity and try multiple URLs
@app.route('/check-frontend', methods=['GET'])
def check_frontend():
    """Check connectivity to the frontend API with multiple possible URLs"""
    try:
        # Create a new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Run the async function
        custom_url = request.args.get('url')
        results = loop.run_until_complete(check_frontend_connectivity(custom_url))
        loop.close()
        
        # Get the working URL if any
        working_urls = [r for r in results if r['success'] and r['highlight_count'] > 0]
        
        return jsonify({
            "success": True,
            "current_url": highlight_handler.frontend_url,
            "tested_urls": results,
            "working_urls": working_urls,
            "current_highlights": len(highlight_handler.highlights)
        })
        
    except Exception as e:
        logger.error(f"Error checking frontend connectivity: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/process', methods=['POST'])
def process_transcript():
    """Process incoming transcripts and commands from the LiveKit agent"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    transcript = data.get('transcript', '')
    
    if not transcript:
        return jsonify({"error": "No transcript provided"}), 400
    
    logger.info(f"Received transcript: '{transcript}'")
    
    # Try to get highlights in this order:
    # 1. Socket.IO (direct from report_gen_server) - most reliable source
    # 2. Frontend API (from Next.js globalThis) - if available
    # 3. Test highlights (fallback)
    
    # First try to get highlights directly from Socket.IO server
    logger.info("Checking Socket.IO for highlights")
    socket_success = update_highlights_from_socket()
    
    if socket_success:
        logger.info(f"Successfully loaded {len(highlight_handler.highlights)} highlights from Socket.IO")
    else:
        # If Socket.IO failed, try the frontend API
        logger.info("No highlights from Socket.IO, trying frontend API")
        
        # Since we're in a synchronous Flask app, we need to call our async function in a synchronous way
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
        api_success = sync_get_highlights()
        logger.info(f"Highlight refresh from API {'succeeded' if api_success else 'failed'}")
        
        # Check the highlight count after API refresh
        highlight_count = len(highlight_handler.highlights)
        logger.info(f"Current highlight count after API refresh: {highlight_count}")
        
        # If no highlights from API or Socket.IO, use test highlights
        if highlight_count == 0:
            logger.info("No highlights available from any source, using test highlights as last resort")
            use_test_highlights(force=True)
            # Check again after loading test highlights
            highlight_count = len(highlight_handler.highlights)
            logger.info(f"Current highlight count after loading test highlights: {highlight_count}")
    
    # Process the transcript as a command
    try:
        # First check for basic command patterns
        text = transcript.lower()
        
        # Navigation commands
        if any(cmd in text for cmd in NEXT_COMMANDS):
            logger.info("Processing as 'next highlight' command")
            result = next_highlight()
            return jsonify(result)
            
        # Explanation commands
        elif any(cmd in text for cmd in EXPLAIN_COMMANDS):
            logger.info("Processing as 'explain highlight' command")
            result = explain_highlight()
            return jsonify(result)
            
        # Progress/summary commands
        elif any(cmd in text for cmd in SUMMARY_COMMANDS):
            logger.info("Processing as 'progress' command")
            result = get_progress()
            return jsonify(result)
            
        # Special command to load test highlights
        elif re.search(r'\b(load|use|test) highlights\b', text):
            logger.info("Processing as 'load test highlights' command")
            success = use_test_highlights(force=True)
            return jsonify({
                "success": success,
                "response": f"I've loaded {len(highlight_handler.highlights)} test highlights for demonstration purposes."
            })
        
        # Use function calling with OpenAI for more complex commands
        elif client and openai_api_key:
            logger.info("Using OpenAI to interpret command")
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
                return jsonify({
                    "response": "I'm having trouble understanding that request. Try asking about highlights specifically."
                })
        else:
            # Default response if OpenAI not available
            return jsonify({
                "response": "I didn't recognize that as a highlight-related command. Try saying 'next highlight' or 'explain this highlight'."
            })
            
    except Exception as e:
        logger.error(f"Error processing command: {e}")
        return jsonify({
            "response": "Sorry, I encountered an error processing your request. Please try again."
        })


# Check frontend connectivity and attempt to fetch highlights
async def check_frontend_connectivity(url=None):
    """Try to connect to the frontend API and fetch highlights"""
    results = []
    urls_to_try = []
    
    # If URL is provided, try that first
    if url:
        urls_to_try.append(url)
    
    # Add the current frontend URL
    if highlight_handler.frontend_url not in urls_to_try:
        urls_to_try.append(highlight_handler.frontend_url)
    
    # Try some fallback URLs
    fallback_urls = [
        "http://localhost:3000/",
        "http://127.0.0.1:3000/",
        "http://host.docker.internal:3000/"
    ]
    
    for fallback in fallback_urls:
        if fallback not in urls_to_try:
            urls_to_try.append(fallback)
    
    # Try each URL
    for test_url in urls_to_try:
        try:
            # Create a temporary highlight handler to test the URL
            temp_handler = HighlightHandler(test_url)
            
            # Try to fetch highlights
            success = await temp_handler.get_current_highlights_from_api()
            highlight_count = len(temp_handler.highlights)
            
            results.append({
                "url": test_url,
                "success": success,
                "highlight_count": highlight_count,
                "active_id": temp_handler.current_highlight_id,
                "error": None if success else "Failed to fetch highlights"
            })
            
            # If successful and has highlights, update our main handler
            if success and highlight_count > 0:
                highlight_handler.frontend_url = test_url
                highlight_handler.highlights = temp_handler.highlights
                highlight_handler.current_highlight_id = temp_handler.current_highlight_id
                highlight_handler.explained_highlights = set()
                logger.info(f"Updated highlight handler with {highlight_count} highlights from {test_url}")
                
        except Exception as e:
            results.append({
                "url": test_url,
                "success": False,
                "highlight_count": 0,
                "active_id": None,
                "error": str(e)
            })
    
    return results

# Endpoint to send text to Socket.IO for analysis
@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    """Send text to the Socket.IO server for analysis and get fresh highlights"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    text = data.get('text', '')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    # Send the text to the Socket.IO server
    success = socket_client.send_text(text)
    
    if not success:
        return jsonify({
            "success": False,
            "message": "Failed to send text to Socket.IO server"
        }), 500
    
    # Wait a bit for the server to process and send back suggestions
    time.sleep(1)
    
    # Update highlights from Socket.IO
    socket_success = update_highlights_from_socket()
    
    return jsonify({
        "success": True,
        "message": "Text sent to Socket.IO server for analysis",
        "socket_connected": socket_client.connected,
        "highlights_updated": socket_success,
        "highlight_count": len(highlight_handler.highlights)
    })

# Simple socket test endpoint
@app.route('/socket-test', methods=['GET'])
def socket_test():
    """Simple endpoint to test the Socket.IO connection"""
    # Get the raw highlights from the socket client
    socket_highlights = socket_client.get_highlights()
    
    # Create a safe version of the highlights for display
    safe_highlights = []
    for h in socket_highlights:
        # Just include a subset of fields to keep it manageable
        safe_h = {
            'id': h.get('id', 'unknown'),
            'type': h.get('type', 'unknown'),
            'message': h.get('message', '')[:50] + '...' if h.get('message') and len(h.get('message')) > 50 else h.get('message', '')
        }
        safe_highlights.append(safe_h)
    
    return jsonify({
        "socket_url": socket_client.socket_url,
        "socket_connected": socket_client.connected,
        "socket_highlights_count": len(socket_highlights),
        "socket_client_id": socket_client.client_id,
        "timestamp": time.time(),
        "highlight_handler_count": len(highlight_handler.highlights),
        "sample_highlights": safe_highlights[:3] if safe_highlights else []
    })

# Better debug-highlights endpoint with serializable response
@app.route('/debug-highlights', methods=['GET'])
def debug_highlights():
    """Debug endpoint to show the current highlights state"""
    # First, check Socket.IO for fresh highlights
    socket_success = update_highlights_from_socket()
    
    # Make a copy of the highlights that is JSON serializable
    safe_highlights = []
    for h in highlight_handler.highlights:
        # Convert any non-serializable values to strings
        safe_highlight = {}
        for key, value in h.items():
            try:
                # Test if the value is JSON serializable
                json.dumps({key: value})
                safe_highlight[key] = value
            except (TypeError, OverflowError):
                # If not serializable, convert to string
                safe_highlight[key] = str(value)
        safe_highlights.append(safe_highlight)
    
    # Create a response with useful debugging information
    response = {
        "frontend_url": highlight_handler.frontend_url,
        "current_highlight_id": highlight_handler.current_highlight_id,
        "highlight_count": len(highlight_handler.highlights),
        "explained_highlights": list(highlight_handler.explained_highlights),
        "highlights": safe_highlights,
        "socket_io": {
            "url": socket_client.socket_url,
            "connected": socket_client.connected,
            "highlight_count": len(socket_client.get_highlights()),
            "last_update_success": socket_success
        }
    }
    
    # Try to connect to the frontend to check if it's alive
    try:
        frontend_check = requests.get(f"{highlight_handler.frontend_url}/api/healthcheck", timeout=2)
        response["frontend_connection"] = {
            "status_code": frontend_check.status_code,
            "status": "OK" if frontend_check.status_code == 200 else "Error"
        }
    except Exception as e:
        response["frontend_connection"] = {
            "status": "Error",
            "error": str(e)
        }
    
    # Add test highlights availability
    response["test_highlights_available"] = len(TEST_HIGHLIGHTS) > 0
    response["highlight_source"] = "Socket.IO" if socket_success else "Frontend API" if len(highlight_handler.highlights) > len(TEST_HIGHLIGHTS) else "Test Highlights"
    
    return jsonify(response)

# Update the frontend URL (useful for debugging)
@app.route('/update-frontend-url', methods=['POST'])
def update_frontend_url():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    new_url = data.get('frontend_url')
    
    if not new_url:
        return jsonify({"error": "No frontend_url provided"}), 400
    
    # Update the frontend URL in the highlight handler
    highlight_handler.frontend_url = new_url
    
    return jsonify({
        "success": True,
        "message": f"Frontend URL updated to {new_url}"
    })
    
    # Call our synchronous wrapper
    success = sync_get_highlights()
    logger.info(f"Highlight refresh from API {'succeeded' if success else 'failed'}")
    
    # Check the highlight count after API refresh
    highlight_count = len(highlight_handler.highlights)
    logger.info(f"Current highlight count after API refresh: {highlight_count}")
    
    # If no highlights from API, use test highlights for debugging
    # IMPORTANT: Even if API call succeeded but returned no highlights, 
    # we still use test highlights
    if highlight_count == 0:
        logger.info("No highlights available, using test highlights instead")
        use_test_highlights(force=True)
        # Check again after loading test highlights
        highlight_count = len(highlight_handler.highlights)
        logger.info(f"Current highlight count after loading test highlights: {highlight_count}")
    
    # Process the transcript as a command
    try:
        # First check for basic command patterns
        text = transcript.lower()
        
        # Navigation commands
        if any(cmd in text for cmd in NEXT_COMMANDS):
            logger.info("Processing as 'next highlight' command")
            result = next_highlight()
            return jsonify(result)
            
        # Explanation commands
        elif any(cmd in text for cmd in EXPLAIN_COMMANDS):
            logger.info("Processing as 'explain highlight' command")
            result = explain_highlight()
            return jsonify(result)
            
        # Progress/summary commands
        elif any(cmd in text for cmd in SUMMARY_COMMANDS):
            logger.info("Processing as 'progress' command")
            result = get_progress()
            return jsonify(result)
            
        # Special command to load test highlights
        elif re.search(r'\b(load|use|test) highlights\b', text):
            logger.info("Processing as 'load test highlights' command")
            success = use_test_highlights(force=True)
            return jsonify({
                "success": success,
                "response": f"I've loaded {len(highlight_handler.highlights)} test highlights for demonstration purposes."
            })
        
        # Use function calling with OpenAI for more complex commands
        elif client and openai_api_key:
            logger.info("Using OpenAI to interpret command")
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
                return jsonify({
                    "response": "I'm having trouble understanding that request. Try asking about highlights specifically."
                })
        else:
            # Default response if OpenAI not available
            return jsonify({
                "response": "I didn't recognize that as a highlight-related command. Try saying 'next highlight' or 'explain this highlight'."
            })
            
    except Exception as e:
        logger.error(f"Error processing command: {e}")
        return jsonify({
            "response": "Sorry, I encountered an error processing your request. Please try again."
        })
        
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
