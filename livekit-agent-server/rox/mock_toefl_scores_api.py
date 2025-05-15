from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Mock TOEFL scores data
MOCK_SCORES = {
    "speaking": 7,
    "listening": 8,
    "writing": 6,
    "last_updated": "2024-05-15T10:30:00Z" # Example timestamp
}

@app.route('/api/mock-toefl-scores', methods=['GET'])
def get_mock_toefl_scores():
    """Endpoint to get mock TOEFL scores."""
    return jsonify(MOCK_SCORES)

if __name__ == '__main__':
    # Running on a different port than the main rox_agent.py to avoid conflicts
    app.run(host='0.0.0.0', port=5006, debug=True)
