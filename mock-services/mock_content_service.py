from flask import Flask, jsonify
from flask_cors import CORS
import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Mock Data
MOCK_VOCAB_WORDS = [
    {
        "wordId": "mock-ubiquitous",
        "wordText": "Ubiquitous",
        "definition": "Present, appearing, or found everywhere.",
        "exampleSentence": "Mobile phones have become ubiquitous in modern society.",
        "difficultyLevel": 4,
        "createdAt": "2023-01-01T10:00:00Z",
        "updatedAt": "2023-01-01T10:00:00Z"
    },
    {
        "wordId": "mock-ephemeral",
        "wordText": "Ephemeral",
        "definition": "Lasting for a very short time.",
        "exampleSentence": "The ephemeral nature of fashion trends makes it hard to keep up.",
        "difficultyLevel": 3,
        "createdAt": "2023-01-01T10:00:00Z",
        "updatedAt": "2023-01-01T10:00:00Z"
    },
    {
        "wordId": "mock-serendipity",
        "wordText": "Serendipity",
        "definition": "The occurrence of events by chance in a happy or beneficial way.",
        "exampleSentence": "The serendipity of meeting an old friend in a foreign country made the trip memorable.",
        "difficultyLevel": 2,
        "createdAt": "2023-01-01T10:00:00Z",
        "updatedAt": "2023-01-01T10:00:00Z"
    }
]

MOCK_SPEAKING_TOPICS = [
    {
        "topicId": "mock-climate-change",
        "title": "Climate Change",
        "promptText": "What do you think are the most important actions individuals and governments should take to address climate change?",
        "difficultyLevel": 4,
        "createdAt": "2023-01-01T10:00:00Z",
        "updatedAt": "2023-01-01T10:00:00Z"
    },
    {
        "topicId": "mock-technology",
        "title": "Technology and Society",
        "promptText": "How has technology changed the way we communicate and interact with each other?",
        "difficultyLevel": 3,
        "createdAt": "2023-01-01T10:00:00Z",
        "updatedAt": "2023-01-01T10:00:00Z"
    }
]

MOCK_WRITING_PROMPTS = [
    {
        "promptId": "mock-argumentative",
        "title": "Remote Work Debate",
        "promptText": "Do you think remote work should continue to be the norm after the pandemic?",
        "difficultyLevel": 4,
        "createdAt": "2023-01-01T10:00:00Z",
        "updatedAt": "2023-01-01T10:00:00Z"
    },
    {
        "promptId": "mock-descriptive",
        "title": "Place Description",
        "promptText": "Describe a place that has special meaning to you.",
        "difficultyLevel": 2,
        "createdAt": "2023-01-01T10:00:00Z",
        "updatedAt": "2023-01-01T10:00:00Z"
    }
]

# Routes for individual items
@app.route('/content/vocab/<word_id>', methods=['GET'])
def get_vocab_word(word_id):
    print(f"Fetching vocab word with ID: {word_id}")
    # Always return the first mock word regardless of the requested ID
    return jsonify(MOCK_VOCAB_WORDS[0])

@app.route('/content/speaking/topic/<topic_id>', methods=['GET'])
def get_speaking_topic(topic_id):
    print(f"Fetching speaking topic with ID: {topic_id}")
    # Always return the first mock topic regardless of the requested ID
    return jsonify(MOCK_SPEAKING_TOPICS[0])

@app.route('/content/writing/prompt/<prompt_id>', methods=['GET'])
def get_writing_prompt(prompt_id):
    print(f"Fetching writing prompt with ID: {prompt_id}")
    # Always return the first mock prompt regardless of the requested ID
    return jsonify(MOCK_WRITING_PROMPTS[0])

# Routes for lists
@app.route('/content/vocab', methods=['GET'])
def get_vocab_list():
    print("Fetching vocabulary word list")
    # Return simplified list items for dropdown/selection UI
    simplified_list = [
        {"wordId": word["wordId"], "wordText": word["wordText"], "difficultyLevel": word["difficultyLevel"]}
        for word in MOCK_VOCAB_WORDS
    ]
    return jsonify(simplified_list)

@app.route('/content/speaking/topics', methods=['GET'])
def get_speaking_topics():
    print("Fetching speaking topic list")
    simplified_list = [
        {"topicId": topic["topicId"], "title": topic["title"], "difficultyLevel": topic["difficultyLevel"]}
        for topic in MOCK_SPEAKING_TOPICS
    ]
    return jsonify(simplified_list)

@app.route('/content/writing/prompts', methods=['GET'])
def get_writing_prompts():
    print("Fetching writing prompt list")
    simplified_list = [
        {"promptId": prompt["promptId"], "title": prompt["title"], "difficultyLevel": prompt["difficultyLevel"]}
        for prompt in MOCK_WRITING_PROMPTS
    ]
    return jsonify(simplified_list)

if __name__ == '__main__':
    print("Starting Mock Content Service on http://localhost:3001")
    app.run(host='0.0.0.0', port=3001, debug=True)
