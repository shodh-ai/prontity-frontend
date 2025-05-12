# speaking_report_flask.py - Speaking Report Agent with OpenAI Function Calling

import json
import logging
import os
import time
import requests
from typing import List, Dict, Any, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
# Remove import to avoid circular dependency
# We'll use requests directly instead of the CustomBridge

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# URL for the frontend API endpoints
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Initialize components ---
# No need to initialize CustomBridge here

# Current highlights global state
current_highlights = []
current_highlight_id = None
explained_highlights = set()
last_highlights_update = 0

# --- Highlight Management Functions ---
def get_current_highlights_from_api():
    """Fetch current highlights from the frontend API"""
    try:
        global current_highlights, last_highlights_update
        
        api_url = f"{FRONTEND_URL}/api/get-next-highlight"
        response = requests.get(api_url)
        
        if response.status_code == 200:
            data = response.json()
            if 'highlights' in data:
                current_highlights = data['highlights']
                last_highlights_update = time.time()
                logger.info(f"Retrieved {len(current_highlights)} highlights from API")
                return current_highlights
            else:
                logger.warning("API response didn't contain highlights")
        else:
            logger.error(f"Failed to get highlights: Status {response.status_code}")
            
        return []
    except Exception as e:
        logger.error(f"Error fetching highlights: {str(e)}")
        return []

def get_highlight_by_id(highlight_id):
    """Get a specific highlight by ID"""
    for highlight in current_highlights:
        if highlight.get('id') == highlight_id:
            return highlight
    return None

def get_next_highlight():
    """Get the next unexplained highlight"""
    for highlight in current_highlights:
        highlight_id = highlight.get('id')
        if highlight_id and highlight_id not in explained_highlights:
            return highlight
    return None

def set_active_highlight(highlight_id):
    """Set the active highlight in the frontend"""
    try:
        global current_highlight_id
        
        api_url = f"{FRONTEND_URL}/api/highlight-control"
        response = requests.post(
            api_url,
            json={"highlightId": highlight_id}
        )
        
        if response.status_code == 200:
            current_highlight_id = highlight_id
            logger.info(f"Set active highlight: {highlight_id}")
            return True
        else:
            logger.error(f"Failed to set active highlight: Status {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Error setting active highlight: {str(e)}")
        return False

def get_progress():
    """Get current progress through highlights"""
    total = len(current_highlights) if current_highlights else 0
    explained = len(explained_highlights) if explained_highlights else 0
    
    if total == 0:
        percent_complete = 0
    else:
        percent_complete = int((explained / total) * 100)
        
    return {
        "total": total,
        "explained": explained,
        "percent_complete": percent_complete
    }

# --- Flask Route ---
@app.route('/process', methods=['POST'])
def process_transcript():
    """Process transcript from LiveKit agent"""
    # Check if the request has the expected format
    if not request.is_json:
        logger.error("Request is not JSON")
        return jsonify({"error": "Request must be JSON"}), 400
    
    # Log everything received
    logger.info(f"Received request: {request.json}")
    
    data = request.json
    transcript = data.get('transcript', '')
    
    # Log incoming data
    logger.info(f"Processing transcript: '{transcript}'")
    
    # Check if we need to refresh highlights
    if not current_highlights or time.time() - last_highlights_update > 30:
        get_current_highlights_from_api()
        
    try:
        # Check if this is a greeting
        if "hello" in transcript.lower() or "hi" in transcript.lower() or "coach" in transcript.lower() or len(transcript) < 10:
            return jsonify({
                "response": "Hello! I'm your Speaking Coach. I can help analyze your speaking highlights and provide feedback. Say 'show me' when you want to see your highlights."
            })

        # Process commands within the transcript
        if any(cmd in transcript.lower() for cmd in ["next", "show", "continue"]):
            # Get next highlight
            next_highlight = get_next_highlight()
            if not next_highlight:
                # No highlights or all explained
                if len(current_highlights) == 0:
                    return jsonify({
                        "response": "I don't see any speaking highlights to discuss at the moment. Please check back when you have some feedback to review."
                    })
                else:
                    # All have been explained
                    return jsonify({
                        "response": "We've reviewed all your speaking highlights. Would you like a summary?"
                    })
                
            # Set the active highlight in the frontend
            highlight_id = next_highlight.get('id')
            success = set_active_highlight(highlight_id)
            
            # Generate explanation for this highlight
            explanation = f"Let's look at this speaking point. The issue is: {next_highlight.get('message', 'Not specified')}. {next_highlight.get('explanation', 'Try to improve this aspect of your speaking.')}"
            
            # Mark this highlight as explained
            explained_highlights.add(highlight_id)
            
            # Return result with metadata
            return jsonify({
                "response": explanation,
                "highlight_id": highlight_id
            })
        
        # Check for summary request
        if "summary" in transcript.lower() or "summarize" in transcript.lower():
            if len(explained_highlights) > 0:
                explained_list = [get_highlight_by_id(h_id) for h_id in explained_highlights]
                explained_list = [h for h in explained_list if h is not None]
                issues = [h.get('message', 'Unknown issue') for h in explained_list]
                
                summary = f"We've discussed {len(explained_list)} speaking points today. "
                if issues:
                    summary += f"The main issues were: {', '.join(issues[:3])}. "
                summary += "Keep practicing these aspects of your speaking to improve your skills!"
                
                return jsonify({"response": summary})
            else:
                return jsonify({
                    "response": "We haven't reviewed any speaking highlights yet. Say 'show me' to start reviewing them."
                })
        
        # Default behavior if no clear command is detected
        return jsonify({
            "response": "I'm your Speaking Coach. I can review your speaking highlights with you. Say 'show me' to see your highlights, or 'summary' for a summary of what we've discussed."
        })
                
    except Exception as e:
        logger.error(f"Error in process_transcript: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            "response": "I'm having trouble analyzing your speaking highlights right now. Let's try again in a moment."
        })

# Command handling route
@app.route('/command', methods=['POST'])
def process_command():
    """Process commands from LiveKit agent"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.json
    command = data.get('command', '')
    
    logger.info(f"Received command: '{command}'")
    
    # This endpoint isn't used in the current CustomBridge implementation
    # But keep it for direct API calls if needed
    
    # Process different commands
    if command == 'next':
        # Move to next highlight
        next_highlight = get_next_highlight()
        if next_highlight:
            highlight_id = next_highlight.get('id')
            set_active_highlight(highlight_id)
            explanation = f"Let's look at this speaking point. The issue is: {next_highlight.get('message', 'Not specified')}. {next_highlight.get('explanation', 'Try to improve this aspect of your speaking.')}"
            explained_highlights.add(highlight_id)
            return jsonify({
                "response": explanation,
                "highlight_id": highlight_id
            })
        else:
            return jsonify({
                "response": "No more highlights to review. Good job!"
            })
            
    elif command == 'refresh':
        # Refresh highlights
        get_current_highlights_from_api()
        count = len(current_highlights)
        return jsonify({
            "response": f"I've refreshed the highlights. Found {count} highlights to discuss."
        })
            
    elif command == 'summary':
        # Generate a summary of explained highlights
        if explained_highlights:
            explained_list = [get_highlight_by_id(h_id) for h_id in explained_highlights]
            explained_list = [h for h in explained_list if h is not None]
            issues = [h.get('message', 'Unknown issue') for h in explained_list]
            
            summary = f"We've discussed {len(explained_list)} speaking points today. "
            if issues:
                summary += f"The main issues were: {', '.join(issues[:3])}. "
            summary += "Keep practicing these aspects of your speaking to improve your skills!"
            
            return jsonify({
                "response": summary
            })
        else:
            return jsonify({
                "response": "I haven't explained any highlights yet, so I can't provide a summary."
            })
    
    else:
        return jsonify({
            "response": "I didn't understand that command. Try 'next', 'refresh', or 'summary'."
        })

if __name__ == '__main__':
    # Use port 5005 to match the URL expected by custom_llm.py
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Speaking Report Agent Flask server on port {port}")
    
    # Import asyncio here to avoid circular imports
    import asyncio
    
    app.run(host='0.0.0.0', port=port, debug=False)
