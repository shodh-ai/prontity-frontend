# vocab_teacher_agent.py (Vocabulary Teacher Agent with OpenAI Function Calling)

import os
import json
import logging
from flask import Flask, request, jsonify
from openai import OpenAI
from dotenv import load_dotenv

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

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
    return prompt

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
    """
    Receives student's transcript, processes it as the vocabulary teacher,
    and returns an appropriate response, potentially with an image prompt.
    """
    if not client:
        logger.error("OpenAI client not initialized. Cannot process request.")
        return jsonify({"response": "Sorry, my AI service isn't available right now. Please try again later."}), 500

    data = request.get_json()
    if not data or 'transcript' not in data:
        logger.error("Received invalid request data.")
        return jsonify({"error": "Missing 'transcript' in request"}), 400

    transcript = data['transcript']
    logger.info(f"Received transcript: '{transcript}'")

    # Extract context if available (which word the student is working on)
    context = data.get('context', {})
    current_word = context.get('current_word', '')
    
    # --- Step 1: Call OpenAI with the system prompt, context and user input ---
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    
    # Add context about the current word if available
    if current_word:
        word_info = vocab_examples.get(current_word.lower(), {})
        if word_info:
            context_message = (
                f"The student is currently learning the word '{current_word}'. "
                f"Definition: {word_info.get('definition', 'Not available')}. "
                f"Example: {word_info.get('example', 'Not available')}."
            )
            messages.append({"role": "system", "content": context_message})
    
    # Add the user's message
    messages.append({"role": "user", "content": transcript})
    
    try:
        logger.info("Calling OpenAI API...")
        logger.info(f"Using API key: {openai_api_key[:8]}...{openai_api_key[-4:]} (length: {len(openai_api_key)})")
        logger.info(f"Using model: gpt-4o-mini")
        logger.info(f"With messages: {json.dumps(messages)}")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using gpt-4o-mini as specified
            messages=messages,
            tools=tools,
            tool_choice="auto",  # Let the model decide whether to call the function
        )
        response_message = response.choices[0].message
        logger.debug(f"OpenAI raw response message: {response_message}")

        # --- Step 2: Check if the model wants to call the function ---
        tool_calls = response_message.tool_calls
        final_response = ""

        if tool_calls:
            # Process all function calls
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                
                if function_name == "generate_image_prompt":
                    try:
                        function_args = json.loads(tool_call.function.arguments)
                        word = function_args.get("word", "")
                        concept = function_args.get("concept", None)
                        
                        # Call the function to generate an image prompt
                        prompt = generate_image_prompt(word, concept)
                        
                        # In a real integration, we would now use this prompt
                        # to submit to the image generator on the frontend
                        
                        # For now, we'll include this in the response to the user
                        # The LiveKit agent will speak this, and the frontend would
                        # need to extract the prompt and submit it to the image generator
                        
                        # Get the assistant's text response
                        text_response = response_message.content or ""
                        
                        # Format the response with special markers that can be easily extracted by a frontend script
                        # Use special marker format: [VOCAB_IMAGE_PROMPT: prompt]  
                        final_response = (
                            f"{text_response}\n\n"
                            f"[VOCAB_IMAGE_PROMPT:{prompt}]"
                        )
                        
                        # Also include the prompt in a special field for the frontend to use
                        return jsonify({
                            "response": final_response,
                            "image_prompt": {
                                "word": word,
                                "prompt": prompt
                            }
                        })
                    
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON arguments from OpenAI: {tool_call.function.arguments}")
                        final_response = "I'd like to show you an image, but I'm having trouble generating a prompt."
                    
                    except Exception as e:
                        logger.error(f"Error calling function {function_name}: {e}")
                        final_response = f"I wanted to create a visual for you, but encountered a problem."
                else:
                    logger.warning(f"Unknown function called by OpenAI: {function_name}")
                    final_response = "I'm not sure how to perform that action."
        else:
            # No function call requested by OpenAI, use the text response
            final_response = response_message.content or "I'm here to help you with vocabulary. What word would you like to learn about?"

    except Exception as e:
        logger.error(f"Error calling OpenAI API: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        final_response = f"I'm sorry, I encountered an error while processing your question: {str(e)}. Please check the server logs for details."

    # Return the final response to the LiveKit agent
    logger.info(f"Sending final response to LiveKit: '{final_response}'")
    return jsonify({"response": final_response})

if __name__ == '__main__':
    # Use port 5005 to match the URL expected by custom_llm.py
    port = int(os.getenv("PORT", 5005))
    logger.info(f"Starting Vocabulary Teacher Agent Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
