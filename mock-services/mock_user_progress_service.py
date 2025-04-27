from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Mock Data
MOCK_NEXT_TASK = {
    "taskId": "mock-vocab-task-1",
    "taskType": "vocab",
    "contentRefId": "mock-ubiquitous"
}

MOCK_PROGRESS_ITEMS = []  # Empty initially

# Routes
@app.route('/users/me/progress', methods=['POST'])
def save_progress():
    print("Received progress update:")
    print(request.json)
    # Just log and return success
    return jsonify({"status": "success", "message": "Progress saved (mock)"}), 201

@app.route('/users/me/progress', methods=['GET'])
def get_progress():
    print("Fetching user progress")
    # Return empty array or mock items
    return jsonify(MOCK_PROGRESS_ITEMS)

@app.route('/users/me/toc/next', methods=['GET'])
def get_next_task():
    print("Fetching next task recommendation")
    # Return hardcoded next task
    return jsonify(MOCK_NEXT_TASK)

@app.route('/users/me/srs/review-items', methods=['GET'])
def get_review_items():
    print("Fetching SRS review items")
    # Return empty array for now
    return jsonify([])

if __name__ == '__main__':
    print("Starting Mock User/Progress Service on http://localhost:8001")
    app.run(host='0.0.0.0', port=8001, debug=True)
