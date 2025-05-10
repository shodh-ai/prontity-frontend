# vocab_teacher_agent.py (Vocabulary Teacher Agent with OpenAI Function Calling)

import json
import logging
import os
import requests
import time
import uuid
from openai import OpenAI
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# URL for the direct API endpoint
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
AGENT_TRIGGER_URL = f"{FRONTEND_URL}/api/agent-trigger"

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

# --- Vocabulary Data ---
vocab_examples = {
    "ubiquitous": {
        "definition": "Present, appearing, or found everywhere.",
        "example": "Mobile phones have become ubiquitous in modern society.",
        "visual_prompt_ideas": [
            "A city street where smartphones are visible in everyone's hands",
            "A collage showing mobile phones in different settings around the world",
            "An infographic showing the global distribution of mobile phones"
        ]
    },
    "ameliorate": {
        "definition": "To make something bad or unsatisfactory better.",
        "example": "The new policies were designed to ameliorate the living conditions in urban areas.",
        "visual_prompt_ideas": [
            "Before and after images of urban renewal projects",
            "Workers improving infrastructure in a city",
            "A visual metaphor showing hands repairing something broken"
        ]
    },
    "ephemeral": {
        "definition": "Lasting for a very short time.",
        "example": "The beauty of cherry blossoms is ephemeral, lasting only a few days each year.",
        "visual_prompt_ideas": [
            "Cherry blossoms at peak bloom and then falling",
            "A time-lapse of a sunset",
            "A melting ice sculpture"
        ]
    },
    "serendipity": {
        "definition": "The occurrence and development of events by chance in a happy or beneficial way.",
        "example": "Finding this rare book was pure serendipity - I wasn't even looking for it!",
        "visual_prompt_ideas": [
            "Someone finding a treasure while looking for something else",
            "Two people bumping into each other and discovering they're old friends",
            "A person discovering a hidden talent by accident"
        ]
    }
}

# --- Generate Image Prompt Function ---
def generate_image_prompt(word: str, concept: str = None) -> str:
    """
    Generate an image prompt for the given vocabulary word and concept.
    
    Parameters:
    - word: The vocabulary word to generate an image for
    - concept: Optional specific concept or aspect to visualize
    
    Returns:
    - A string containing the generated prompt that will be sent to the image generator
    """
    logger.info(f"Generating image prompt for: {word}, concept: {concept or 'not specified'}")
    
    word_lower = word.lower()
    
    # If the word is in our predefined vocab examples, use that
    if word_lower in vocab_examples:
        word_data = vocab_examples[word_lower]
        
        # Default prompt if no concept is specified
        if not concept:
            # Choose a random visual prompt idea from the list
            import random
            prompt = random.choice(word_data["visual_prompt_ideas"])
        else:
            # Try to match concept with a visual idea or create a custom one
            prompt = f"A visual representation of {word} showing {concept}: {word_data['definition']}"
    else:
        # For words not in our examples, create a generic but helpful prompt
        if concept:
            prompt = f"Create a visual representation of the word '{word}' focusing on the concept: {concept}"
        else:
            prompt = f"Create an educational image that helps explain the word '{word}'"
    
    # Add a standard ending to all prompts to ensure quality
    prompt += ". Make the image clear, educational, and visually appealing."
    
    logger.info(f"Generated prompt: {prompt}")
    
    # Call the direct API to trigger image generation
    # Generate a unique request ID for this prompt
    request_id = f"{word}_{uuid.uuid4().hex[:8]}_{int(time.time())}"
    success, _ = trigger_image_generation(word, prompt, request_id)
    
    return prompt


def trigger_image_generation(word: str, prompt: str, request_id: str = None):
    """
    Trigger image generation directly through the API endpoint instead of relying on LiveKit metadata.
    
    Parameters:
    - word: The vocabulary word to generate an image for
    - prompt: The prompt to use for image generation
    - request_id: Optional ID to track this specific request
    
    Returns:
    - Success status (bool)
    - Response data (dict) if successful, None otherwise
    """
    try:
        # Generate a request ID if not provided
        if request_id is None:
            import uuid
            request_id = f"req_{uuid.uuid4().hex[:12]}_{int(time.time())}"
            
        logger.info(f"Triggering direct image generation for word: {word} (request_id: {request_id})")
        logger.info(f"API endpoint URL: {AGENT_TRIGGER_URL}")
        
        payload = {
            "action": "generate_image",
            "word": word,
            "prompt": prompt,
            "requestId": request_id
        }
        
        logger.info(f"Sending payload for {word} with request_id {request_id}")
        
        # Make an asynchronous request to the agent-trigger endpoint
        response = requests.post(
            AGENT_TRIGGER_URL, 
            json=payload, 
            headers={
                "Content-Type": "application/json",
                "X-Request-Source": "vocab-teacher-agent",
                "X-Request-ID": request_id
            },
            timeout=8  # Longer timeout to allow for image generation processing
        )
        
        # Log the response status and headers
        logger.info(f"Response status: {response.status_code}")
        logger.info(f"Response headers: {dict(response.headers)}")
        
        # Parse the response
        try:
            response_json = response.json()
            logger.info(f"Response JSON for {word}: {response_json}")
            
            if response.status_code == 200:
                if response_json.get("reused"):
                    logger.info(f"Image already existed for '{word}', using existing image ID: {response_json.get('imageId')}")
                else:
                    logger.info(f"Successfully triggered image generation for '{word}'" + 
                              f" with image ID: {response_json.get('imageId')}")
                return True, response_json
            else:
                error_msg = response_json.get("error", "Unknown error")
                logger.warning(f"Failed to trigger image generation for '{word}'. Error: {error_msg}")
                return False, response_json
                
        except Exception as json_error:
            logger.info(f"Response text: {response.text}")
            logger.error(f"Failed to parse response as JSON: {json_error}")
            return False, None
            
    except requests.exceptions.ConnectionError as ce:
        logger.error(f"Connection error triggering image generation for '{word}': {ce}")
        logger.error("Check if the frontend server is running and accessible")
        return False, None
    except requests.exceptions.Timeout as te:
        logger.error(f"Timeout error triggering image generation for '{word}': {te}")
        return False, None
    except Exception as e:
        logger.error(f"Error triggering image generation for '{word}': {type(e).__name__}: {e}")
        # Don't raise the exception to avoid interrupting the agent's response
        return False, None

# --- OpenAI Function Definition ---
tools = [
    {
        "type": "function",
        "function": {
            "name": "generate_image_prompt",
            "description": "Generate a prompt to create an image that helps visualize a vocabulary word",
            "parameters": {
                "type": "object",
                "properties": {
                    "word": {
                        "type": "string",
                        "description": "The vocabulary word to generate an image for",
                    },
                    "concept": {
                        "type": "string",
                        "description": "Optional specific concept or aspect of the word to visualize",
                    },
                },
                "required": ["word"],
            },
        },
    }
]

# --- Vocabulary Teacher Persona ---
SYSTEM_PROMPT = """
You are an engaging, enthusiastic vocabulary teacher named Professor Lexicon. Your goal is to help students understand vocabulary words deeply by explaining them in clear, relatable ways and creating visual learning aids.

When interacting with students:
1. Be warm, encouraging, and passionate about words
2. Explain vocabulary using simple language and relatable examples
3. Use analogies to explain complex terms
4. Connect words to real-life situations
5. Suggest visual representations that would help learn the word
6. Ask students questions to gauge their understanding

When a student mentions a vocabulary word, help them understand it by:
1. Explaining the definition in simple terms
2. Providing an example sentence
3. Creating a visual prompt that will help them remember the word
4. Encouraging them to use the word in their own sentence

If students are struggling, be patient and try different approaches to help them understand.
"""

# --- Flask Route ---
@app.route('/process', methods=['POST'])
def process_transcript():
    # Check if the request has the expected format
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.json
    transcript = data.get('transcript', '')
    language = data.get('language', 'en')  # Default to English
    
    # Log incoming data
    logger.info(f"Received transcript: '{transcript}'")
    
    # Generate a response - always respond with serendipity information
    try:
        # Always respond with serendipity explanation
        explanation = "Let me teach you about the word 'serendipity'! Serendipity refers to finding something valuable or delightful when you're not looking for it. It's like a happy accident or a pleasant surprise that happens by chance. For example, stumbling upon a beautiful hidden beach while taking a wrong turn."
        
        # Generate an image for serendipity
        serendipity_prompt = "A person stumbling upon a hidden treasure chest while walking in a forest. Make this beautiful, detailed, high resolution."
        
        # Generate a unique request ID for this specific request 
        request_id = f"serendipity_{uuid.uuid4().hex[:8]}_{int(time.time())}"
        
        # Trigger direct image generation through the API endpoint
        success, response_data = trigger_image_generation("serendipity", serendipity_prompt, request_id)
        
        # Return the explanation and metadata about the image generation request
        result = {
            "response": explanation
        }
        
        # Include metadata about the image generation if available
        if success and response_data:
            result["meta"] = {
                "image_generated": True,
                "image_id": response_data.get("imageId"),
                "request_id": request_id,
                "word": "serendipity"
            }
        
        return jsonify(result)
                
    except Exception as e:
        logger.error(f"Error: {e}")
        # Even in case of error, return serendipity info
        return jsonify({
            "response": "Let me teach you about the word 'serendipity'! It refers to finding something good by chance when you weren't looking for it.",
            "action": "generate_image",
            "payload": {
                "word": "serendipity",
                "prompt": "A lucky discovery, beautiful, photorealistic",
                "action_type": "direct_api_call",
                "api_endpoint": "/api/ai/gemini-generate",
                "api_method": "POST",
                "api_data": {
                    "prompt": "A lucky discovery, beautiful, photorealistic",
                    "context": "serendipity"
                }
            }
        })



if __name__ == '__main__':
    # Use port 5005 to match the URL expected by custom_llm.py
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Vocabulary Teacher Agent Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
