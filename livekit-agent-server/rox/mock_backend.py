#!/usr/bin/env python3
"""
Mock Backend for Rox Agent

This Flask server simulates a backend API that provides student data
for the Rox agent to fetch and display.
"""

import os
import json
import logging
import random
from flask import Flask, jsonify, request
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)

# Sample student data
STUDENT_DATA = {
    "current": {
        "name": "John Smith",
        "id": "js12345",
        "progress": {
            "Listening": "75%",
            "Speaking": "60%",
            "Writing": "82%"
        },
        "recent_activity": [
            {"activity": "Vocabulary Practice", "timestamp": "2025-05-12T14:30:00"},
            {"activity": "Grammar Exercise", "timestamp": "2025-05-11T09:15:00"},
            {"activity": "Speaking Practice", "timestamp": "2025-05-10T16:45:00"}
        ]
    },
    "students": [
        {
            "name": "Jane Doe",
            "id": "jd67890",
            "progress": {
                "Listening": "88%",
                "Speaking": "72%",
                "Writing": "65%"
            },
            "recent_activity": [
                {"activity": "Reading Comprehension", "timestamp": "2025-05-13T10:15:00"},
                {"activity": "Vocabulary Practice", "timestamp": "2025-05-12T15:45:00"}
            ]
        },
        {
            "name": "Michael Johnson",
            "id": "mj54321",
            "progress": {
                "Listening": "65%",
                "Speaking": "80%",
                "Writing": "70%"
            },
            "recent_activity": [
                {"activity": "Grammar Exercise", "timestamp": "2025-05-13T09:30:00"},
                {"activity": "Speaking Practice", "timestamp": "2025-05-11T14:00:00"}
            ]
        }
    ]
}

@app.route('/api/student/current', methods=['GET'])
def get_current_student():
    """Return data for the current student"""
    logger.info("Fetching current student data")
    return jsonify(STUDENT_DATA["current"])

@app.route('/api/student/<student_id>', methods=['GET'])
def get_student(student_id):
    """Return data for a specific student by ID"""
    logger.info(f"Fetching student data for ID: {student_id}")
    
    # Check if it's the current student
    if student_id == STUDENT_DATA["current"]["id"]:
        return jsonify(STUDENT_DATA["current"])
    
    # Check other students
    for student in STUDENT_DATA["students"]:
        if student["id"] == student_id:
            return jsonify(student)
    
    # Student not found
    return jsonify({"error": "Student not found"}), 404

@app.route('/api/students', methods=['GET'])
def get_all_students():
    """Return a list of all students"""
    logger.info("Fetching list of all students")
    
    # Return basic info for all students including current student
    all_students = [
        {
            "name": STUDENT_DATA["current"]["name"],
            "id": STUDENT_DATA["current"]["id"]
        }
    ]
    
    for student in STUDENT_DATA["students"]:
        all_students.append({
            "name": student["name"],
            "id": student["id"]
        })
    
    return jsonify(all_students)

@app.route('/api/student/current/update-score', methods=['POST'])
def update_current_student_score():
    """Update a score for the current student"""
    data = request.json
    if not data or not data.get("subject") or not data.get("score"):
        return jsonify({"error": "Missing required fields"}), 400
    
    subject = data["subject"]
    score = data["score"]
    
    logger.info(f"Updating score for subject '{subject}' to '{score}'")
    
    STUDENT_DATA["current"]["progress"][subject] = score
    
    return jsonify({"success": True})

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "Rox Mock Backend"
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5080))
    logger.info(f"Starting mock backend on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
