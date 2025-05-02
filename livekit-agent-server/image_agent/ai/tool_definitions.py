# File: ai/tool_definitions.py

# Import the necessary type from the Google GenAI SDK
from google.generativeai.types import FunctionDeclaration, Tool # Tool might be needed by loader/manager later
from typing import Dict, List # For the TOOL_DEFINITIONS_MAP

# --- Tool Definition for startTimer ---

start_timer_func = FunctionDeclaration(
    # The exact name the AI will use to call the tool.
    # Must match the name used in the YAML allowed_tools list and the dispatcher mapping.
    name="startTimer",

    # A clear description for the AI model to understand what this tool does.
    # This helps the AI decide when it's appropriate to use this tool.
    description="Starts a countdown timer visible to the user, typically for preparation or speaking tasks. The timer runs on the user's interface.",

    # Defines the input parameters the AI needs to provide when calling this tool.
    # Uses OpenAPI Schema specification.
    parameters={
        "type": "OBJECT", # The parameters are described as a JSON object
        "properties": {
            # Define the 'duration' parameter
            "duration": {
                "type": "INTEGER", # The value must be an integer
                "description": "The duration of the timer in seconds. Must be a positive integer."
            },
            # Add optional purpose parameter
            "purpose": {
                "type": "STRING", # The value must be a string
                "description": "The purpose of the timer (e.g., 'preparation' or 'speaking'). Helps users understand the context.",
                "enum": ["preparation", "speaking"]  # Restrict to these values
            }
        },
        # Specify which parameters are mandatory
        "required": ["duration"]
    }
)

# --- Vocab Page Tool Definitions ---

draw_concept_func = FunctionDeclaration(
    name="drawConcept",
    description="Creates a simple drawing or diagram to illustrate a word or concept. Helps with visual learning and word associations.",
    parameters={
        "type": "OBJECT",
        "properties": {
            "concept": {
                "type": "STRING",
                "description": "The word or concept to visualize (e.g., 'migration', 'democracy', 'ecosystem')."
            },
            "instructions": {
                "type": "STRING",
                "description": "Optional specific instructions about what to draw or highlight in the visualization."
            }
        },
        "required": ["concept"]
    }
)

show_word_info_func = FunctionDeclaration(
    name="showWordInfo",
    description="Displays detailed information about a vocabulary word, including definition, examples, pronunciation, and usage notes.",
    parameters={
        "type": "OBJECT",
        "properties": {
            "word": {
                "type": "STRING",
                "description": "The vocabulary word to display information for."
            },
            "highlightKey": {
                "type": "STRING",
                "description": "Optional key aspect to highlight (e.g., 'pronunciation', 'usage', 'examples')."
            }
        },
        "required": ["word"]
    }
)

start_quiz_func = FunctionDeclaration(
    name="startQuiz",
    description="Starts a vocabulary quiz session for the student based on recently studied words or a specific category.",
    parameters={
        "type": "OBJECT",
        "properties": {
            "wordList": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "Optional list of specific words to include in the quiz. If not provided, recent words will be used."
            },
            "quizType": {
                "type": "STRING",
                "description": "The type of quiz to start (e.g., 'multiple-choice', 'fill-in-blank', 'matching').",
                "enum": ["multiple-choice", "fill-in-blank", "matching", "flash-cards"]
            },
            "difficulty": {
                "type": "STRING",
                "description": "The difficulty level of the quiz.",
                "enum": ["easy", "medium", "hard"]
            }
        },
        "required": ["quizType"]
    }
)

# --- Tool Definition Map (for easy lookup) ---
# Create a dictionary mapping the tool NAME (string) to its FunctionDeclaration object.
# The agent_config_loader will use this map.

TOOL_DEFINITIONS_MAP: Dict[str, FunctionDeclaration] = {
    # Speaking tools
    "startTimer": start_timer_func,
    "getSpeechFeedback": start_timer_func,  # Temporary mapping until implemented
    "recordTaskCompletion": start_timer_func,  # Temporary mapping until implemented
    
    # Vocab tools
    "drawConcept": draw_concept_func,
    "showWordInfo": show_word_info_func,
    "startQuiz": start_quiz_func,
}

# --- Examples of other tools to define later ---

# def create_navigate_to_tool():
#     return FunctionDeclaration(
#         name="navigateTo",
#         description="Navigate the user to a different page or task section within the application.",
#         parameters={
#             "type": "OBJECT",
#             "properties": {
#                 "page": {"type": "STRING", "description": "The target page type (e.g., 'vocab', 'speaking', 'rox')."},
#                 "params": {"type": "OBJECT", "description": "Optional parameters like wordId or topicId."}
#             },
#             "required": ["page"]
#         }
#     )

# def create_get_speech_feedback_tool():
#     return FunctionDeclaration(
#         name="getSpeechFeedback",
#         description="Retrieves feedback about the student's speech, including fluency, pronunciation, and content analysis.",
#         parameters={
#             "type": "OBJECT",
#             "properties": {},  # No parameters needed, analyzes most recent speech
#             "required": []
#         }
#     )

# def create_record_task_completion_tool():
#     return FunctionDeclaration(
#         name="recordTaskCompletion",
#         description="Records that the student has completed this task and updates their progress.",
#         parameters={
#             "type": "OBJECT",
#             "properties": {
#                 "score": {
#                     "type": "INTEGER",
#                     "description": "Estimated score for the student's performance on a scale of 1-5."
#                 },
#                 "notes": {
#                     "type": "STRING",
#                     "description": "Brief notes about the student's performance for progress tracking."
#                 }
#             },
#             "required": ["score"]
#         }
#     )

# When you're ready to implement these tools, uncomment and add them to TOOL_DEFINITIONS_MAP
