#!/usr/bin/env python3
# Simple vocabulary agent that always explains "serendipity" and generates an image

import json
import logging
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Route to process transcripts ---
@app.route('/process', methods=['POST'])
def process_transcript():
    data = request.json
    transcript = data.get('transcript', '')
    
    # Log incoming data
    logger.info(f"Received transcript: '{transcript}'")
    
    # No matter what the user says, respond with serendipity explanation
    # First part of the explanation
    explanation = "Let me teach you about the word 'serendipity'! Serendipity refers to finding something valuable or delightful when you're not looking for it. It's like a happy accident or a pleasant surprise that happens by chance."
    
    # Create image generation prompt
    serendipity_prompt = "A person stumbling upon a hidden treasure chest while walking in a forest. Make this beautiful, detailed, high resolution."
    
    # Create a response with the image generation metadata
    response = {
        "response": explanation,
        "metadata": {
            "dom_actions": [
                {
                    "action": "generate_image",
                    "payload": {
                        "word": "serendipity",
                        "prompt": serendipity_prompt,
                        "action_type": "direct_api_call",
                        "api_endpoint": "/api/ai/gemini-generate",
                        "api_method": "POST",
                        "api_data": {
                            "prompt": serendipity_prompt,
                            "context": "serendipity"
                        }
                    }
                }
            ]
        }
    }
    
    logger.info(f"Sending response with image generation metadata")
    return jsonify(response)

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Simple Vocabulary Agent Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
