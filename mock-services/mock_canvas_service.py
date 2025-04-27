"""
Mock Canvas Service

This Flask application simulates the Vocabulary Canvas microservice API,
providing endpoints to save, load, and manage canvas drawing states.
"""

import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# In-memory storage for canvas data (in a real service, this would be in a database)
# Structure: {user_id: {word_id: canvas_data}}
canvas_storage = {}


@app.route('/api/user/<user_id>/word/<word_id>/canvas', methods=['GET'])
def get_canvas(user_id, word_id):
    """
    Get canvas data for a specific user and word
    """
    logger.info(f"GET request for canvas: user={user_id}, word={word_id}")
    
    # Check if the user exists in storage
    if user_id not in canvas_storage or word_id not in canvas_storage.get(user_id, {}):
        logger.info(f"Canvas not found for user={user_id}, word={word_id}")
        return jsonify({"error": "Canvas not found"}), 404
    
    logger.info(f"Returning canvas for user={user_id}, word={word_id}")
    return jsonify(canvas_storage[user_id][word_id])


@app.route('/api/user/<user_id>/word/<word_id>/canvas', methods=['POST'])
def save_canvas(user_id, word_id):
    """
    Save canvas data for a specific user and word
    """
    canvas_data = request.json
    logger.info(f"POST request to save canvas: user={user_id}, word={word_id}")
    
    # Initialize user dictionary if it doesn't exist
    if user_id not in canvas_storage:
        canvas_storage[user_id] = {}
    
    # Save the canvas data
    canvas_storage[user_id][word_id] = canvas_data
    logger.info(f"Canvas saved for user={user_id}, word={word_id}")
    
    return jsonify({"status": "success", "message": "Canvas saved successfully"})


@app.route('/api/user/<user_id>/word/<word_id>/canvas', methods=['DELETE'])
def delete_canvas(user_id, word_id):
    """
    Delete canvas data for a specific user and word
    """
    logger.info(f"DELETE request for canvas: user={user_id}, word={word_id}")
    
    # Check if the user exists in storage
    if user_id not in canvas_storage or word_id not in canvas_storage.get(user_id, {}):
        logger.info(f"Canvas not found for user={user_id}, word={word_id}")
        return jsonify({"error": "Canvas not found"}), 404
    
    # Delete the canvas data
    del canvas_storage[user_id][word_id]
    logger.info(f"Canvas deleted for user={user_id}, word={word_id}")
    
    return jsonify({"status": "success", "message": "Canvas deleted successfully"})


@app.route('/api/user/<user_id>/canvas', methods=['GET'])
def get_all_canvases(user_id):
    """
    Get all canvases for a specific user
    """
    logger.info(f"GET request for all canvases: user={user_id}")
    
    # Check if the user exists in storage
    if user_id not in canvas_storage:
        logger.info(f"No canvases found for user={user_id}")
        return jsonify([])
    
    # Convert the dictionary to a list of dictionaries with word_id as a key
    canvases = [
        {"word_id": word_id, "canvas": canvas_data}
        for word_id, canvas_data in canvas_storage[user_id].items()
    ]
    
    logger.info(f"Returning {len(canvases)} canvases for user={user_id}")
    return jsonify(canvases)


if __name__ == '__main__':
    # Use port 3002 to avoid conflicts with other services
    port = int(os.environ.get('MOCK_CANVAS_SERVICE_PORT', 3002))
    logger.info(f"Starting mock Canvas Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
