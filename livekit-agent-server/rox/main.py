#!/usr/bin/env python3
"""
Rox Assistant LiveKit Agent

This script connects the Rox assistant AI agent to LiveKit sessions.
The agent processes audio via the LiveKit SDK and generates responses using
the external agent service defined in custom_llm.py.
It also exposes an RPC service for frontend interactions.
"""

import base64 # For B2F RPC payload
import uuid   # For unique request IDs in B2F RPC and existing uses
import time   # For timestamps in session IDs
import json   # For handling JSON data in UI actions
from livekit import rtc # For B2F RPC type hints
from generated.protos import interaction_pb2 # For B2F and F2B RPC messages

import os
import sys
import logging
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, # Changed default to INFO, DEBUG can be very verbose
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__) # Use __name__ for module-specific logger

# Import LiveKit components
from livekit import agents # Main import for agents module
from livekit.agents import Agent, JobContext, RoomInputOptions, WorkerOptions # Import rpc for service registration

# Import VPA pipeline components
tavus_module = None  # Initialize to None
try:
    from livekit.plugins import noise_cancellation
    from livekit.plugins import deepgram, silero
    from livekit.plugins.turn_detector.multilingual import MultilingualModel

    # Try importing tavus separately to handle potential Python version issues
    try:
        from livekit.plugins import tavus as tv_module
        tavus_module = tv_module  # Assign if successful
        logger.info("Tavus plugin imported successfully.")
    except TypeError as te:
        if "unsupported operand type(s) for |" in str(te):
            logger.warning("Tavus plugin could not be imported. This is likely due to Python version incompatibility (Tavus plugin may require Python 3.10+). Tavus features will be disabled.")
        else:
            logger.error(f"TypeError while importing Tavus plugin: {te}") # Log other TypeErrors
    except ImportError as ie:
        logger.warning(f"Tavus plugin not found (ImportError: {ie}). Tavus features will be disabled.")

except ImportError as e: # For other plugins like deepgram, silero, etc.
    logger.error(f"Failed to import core LiveKit plugins (deepgram, silero, noise_cancellation, turn_detector): {e}")
    logger.error("Please install/check: 'livekit-agents[deepgram,silero,turn-detector]' and 'livekit-plugins-noise-cancellation'")
    sys.exit(1)

# Import the Custom LLM Bridge
try:
    from custom_llm import CustomLLMBridge # Use relative import if custom_llm.py is in the same directory
except ImportError:
    logger.error("Failed to import CustomLLMBridge. Make sure custom_llm.py exists in the 'rox' directory and aiohttp is installed.")
    sys.exit(1)

# Import your new RPC service implementation
try:
    from rpc_services import AgentInteractionService
except ImportError as e:
    logger.error(f"Failed to import AgentInteractionService from rpc_services.py. Error: {e}", exc_info=True)
    sys.exit(1)


# Find and load .env file
script_dir = Path(__file__).resolve().parent
env_path = script_dir / '.env'
if env_path.exists():
    logger.info(f"Loading environment from: {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    logger.warning(f"No .env file found at {env_path}, using environment variables directly if set.")
    # load_dotenv() # Optionally load from a default location if .env in script_dir isn't found

# Verify critical environment variables
required_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DEEPGRAM_API_KEY", "MY_CUSTOM_AGENT_URL"]
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
    sys.exit(1)

logger.info(f"LIVEKIT_URL: {os.getenv('LIVEKIT_URL')}")
dg_key = os.getenv('DEEPGRAM_API_KEY', '')
logger.info(f"DEEPGRAM_API_KEY: {dg_key[:8]}...{dg_key[-4:]} (length: {len(dg_key)})" if dg_key else "DEEPGRAM_API_KEY: Not Set")
logger.info(f"MY_CUSTOM_AGENT_URL: {os.getenv('MY_CUSTOM_AGENT_URL')}")


# Check for Tavus credentials (optional)
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY", "")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID", "")

TAVUS_ENABLED = bool(TAVUS_API_KEY and TAVUS_REPLICA_ID)
if TAVUS_ENABLED:
    logger.info("Tavus avatar configuration found and seems complete.")
    masked_key = TAVUS_API_KEY[:4] + "*" * (len(TAVUS_API_KEY) - 8) + TAVUS_API_KEY[-4:] if len(TAVUS_API_KEY) > 8 else "****"
    logger.info(f"Tavus API Key: {masked_key}")
    logger.info(f"Tavus Replica ID: {TAVUS_REPLICA_ID}")
    logger.info(f"Tavus Persona ID: {TAVUS_PERSONA_ID if TAVUS_PERSONA_ID else 'Not set (optional)'}")
else:
    logger.warning("Tavus avatar not fully configured (missing API Key or Replica ID). Avatar functionality will be disabled.")

# Global configuration (can be overridden by CLI args)
GLOBAL_PAGE_PATH = "roxpage"
GLOBAL_MODEL = "aura-asteria-en"
GLOBAL_TEMPERATURE = 0.7
GLOBAL_AVATAR_ENABLED = tavus_module is not None and TAVUS_ENABLED # Default to .env config and plugin availability

# Agent Class Definition
class RoxAgent(Agent):
    """Simple Rox AI assistant"""
    def __init__(self, page_path="roxpage") -> None:
        super().__init__(instructions="You are Rox, an AI assistant for students using the learning platform. You help students understand their learning status and guide them through their learning journey.")
        self.page_path = page_path
        
        # Initialize context and session variables needed by CustomLLMBridge
        self._latest_student_context = {"user_id": "default_init_user"}
        self._latest_session_id = f"init_session_{uuid.uuid4().hex[:8]}_{int(time.time())}"
        
        logger.info(f"RoxAgent instance created for page: {self.page_path}")
        logger.info(f"RoxAgent initialized with default context: {self._latest_student_context}")
        logger.info(f"RoxAgent initialized with session ID: {self._latest_session_id}")
        
    async def on_transcript(self, transcript: str, language: str) -> None:
        """Called when a user transcript is received"""
        logger.info(f"USER SAID (lang: {language}): '{transcript}'")
        
    async def on_reply(self, message: str, audio_url: str = None) -> None:
        """Override to log when assistant replies"""
        logger.info(f"ROX ASSISTANT REPLIED: '{message}'")
        if audio_url:
            logger.debug(f"Audio URL for reply: {audio_url}") # Log URL at DEBUG
        else:
            logger.warning("No audio URL provided for reply - Speech not generated by TTS!")

    # You can add methods here that your RPC service can call
    # For example:
    # async def process_frontend_action(self, action_data: str):
    #     logger.info(f"RoxAgent: Processing frontend action with data: {action_data}")
    #     # ... do something ...
    #     return "Action processed by RoxAgent"


async def trigger_client_ui_action(
    room: rtc.Room,
    client_identity: str,
    action_type: interaction_pb2.ClientUIActionType, # Use the enum from your protos
    target_element_id: str = None,
    parameters: dict = None
) -> interaction_pb2.ClientUIActionResponse | None:
    """
    Sends an RPC to a specific client to perform a UI action.
    
    Parameters:
        room: The LiveKit room
        client_identity: The identity of the client to send the action to
        action_type: The type of UI action to perform (from ClientUIActionType enum)
        target_element_id: The ID of the target element on the client
        parameters: Additional parameters specific to the action type:
            - For SHOW_ALERT: {"message": "message text"}
            - For UPDATE_TEXT_CONTENT: {"text": "new text"}
            - For TOGGLE_ELEMENT_VISIBILITY: {"visible": "true"/"false"}
            - For START_TIMER: {"duration_seconds": "60", "timer_type": "prep"}
            - For STOP_TIMER: {} (no parameters needed)
            - For PAUSE_TIMER: {"pause": "true"/"false"}
            - For RESET_TIMER: {} (no parameters needed)
            - For UPDATE_PROGRESS_INDICATOR: {"current_step": "1", "total_steps": "10", "message": "Step 1 of 10"}
            - For UPDATE_SCORE_OR_PROGRESS: {"score_text": "Score: 7/10", "progress_percentage": "70"}
    
    Returns:
        The response from the client, or None if there was an error
    """
    target_participant = None
    # Correctly iterate over remote_participants
    for participant in room.remote_participants.values():
        if participant.identity == client_identity:
            target_participant = participant
            break

    if not target_participant:
        logger.error(f"B2F RPC: Client '{client_identity}' not found in room '{room.name}'. Cannot trigger UI action.")
        # Create a copy of parameters to avoid modifying the original dict
    proto_params = parameters.copy() if parameters else {}
    
    # Convert all parameter values to strings
    for key in list(proto_params.keys()):
        if proto_params[key] is not None and not isinstance(proto_params[key], str):
            # Convert booleans, numbers, and other types to strings
            proto_params[key] = str(proto_params[key]).lower() if isinstance(proto_params[key], bool) else str(proto_params[key])
    
    # Special handling for certain action types that have specific parameter formats
    if action_type == interaction_pb2.ClientUIActionType.START_TIMER:
        # Ensure timer_type is set
        if "timer_type" not in proto_params:
            proto_params["timer_type"] = "task"
    # The numeric conversions below are redundant now but kept for clarity
    elif action_type == interaction_pb2.ClientUIActionType.UPDATE_PROGRESS_INDICATOR:
        pass  # All conversions handled above
    elif action_type == interaction_pb2.ClientUIActionType.UPDATE_SCORE_OR_PROGRESS:
        pass  # All conversions handled above

    request_pb = interaction_pb2.AgentToClientUIActionRequest(
        request_id=str(uuid.uuid4()),
        action_type=action_type,
        target_element_id=target_element_id if target_element_id else "",
        parameters=proto_params
    )

    serialized_request = request_pb.SerializeToString()
    # Base64 encode the binary data so the client can decode it with atob()
    base64_encoded_request = base64.b64encode(serialized_request).decode('utf-8')

    rpc_method_name = "rox.interaction.ClientSideUI/PerformUIAction" # Must match client registration

    try:
        # Send the RPC using room.send_request (room is passed as an argument)
        logger.info(f"B2F RPC: Sending '{rpc_method_name}' to '{client_identity}' (SID: {target_participant.sid}). Action: {action_type}, Target: '{target_element_id}', Params: {parameters}")
        # perform_rpc returns the response as a string already (a base64-encoded string from client)
        response_payload_str = await room.local_participant.perform_rpc(
            destination_identity=client_identity,
            method=rpc_method_name,
            payload=base64_encoded_request  # Send the base64-encoded payload instead of raw bytes
            # timeout parameter removed as it's not supported in this SDK version
        )
        # No need to decode to utf-8 as it's already a string
        decoded_response_bytes = base64.b64decode(response_payload_str)
        response_pb = interaction_pb2.ClientUIActionResponse()
        response_pb.ParseFromString(decoded_response_bytes)

        # Use request_pb.request_id for the log message, as request_id is part of the request_pb proto
        logger.info(f"B2F RPC: Response from client '{client_identity}' for UI action '{request_pb.request_id}': Success={response_pb.success}, Msg='{response_pb.message}'")
        return response_pb
    except Exception as e:
        logger.error(f"B2F RPC: Error sending '{rpc_method_name}' to '{client_identity}' or processing response: {e}", exc_info=True)
        return None


async def agent_main_logic(ctx: JobContext):
    """
    Contains agent logic to proactively send UI commands to the client.
    `ctx.room` will be used to find participants and send RPCs.
    """
    logger.info("B2F Agent Logic: Started.")
    await asyncio.sleep(4) # Wait for client to likely connect and register its RPC handler
    logger.info("B2F Agent Logic: Initial 4-second sleep completed.")

    if not ctx.room:
        logger.error("B2F Agent Logic: ctx.room is not available. Cannot proceed.")
        return
    logger.info("B2F Agent Logic: ctx.room is available.")

    target_client_identity = None
    # Find a client (assuming client is 'TestUser' based on rox/page.tsx)
    # A more robust way might involve the client announcing itself or a specific naming convention.
    logger.info("B2F Agent Logic: Attempting to list participants...")
    
    # Get all remote participants in the room
    remote_participants = ctx.room.remote_participants.values()
    logger.info(f"B2F Agent Logic: Found participants: {[p.identity for p in remote_participants]}")
    
    for participant in remote_participants:
        if participant.identity == "TestUser":
            target_client_identity = participant.identity
            logger.info(f"B2F Agent Logic: Found target client 'TestUser'.")
            break
        elif participant.identity != ctx.identity: # Fallback to first non-agent participant
            target_client_identity = participant.identity
            logger.info(f"B2F Agent Logic: Found potential target client (fallback): '{participant.identity}'.")
            break
    
    if not target_client_identity:
        logger.warning("B2F Agent Logic: No suitable client 'TestUser' (or fallback) found to send UI actions to.")
        return
    
    logger.info(f"B2F Agent Logic: Proceeding to send UI actions to client: '{target_client_identity}'")

    try:
        # ==========================================
        # ROX_COPY PAGE ACTIONS
        # ==========================================
        
        # Try a very simple action first to see if it works
        logger.info(f"B2F Agent Logic: Attempting Action 1: SHOW_ALERT to '{target_client_identity}'.")
        # Action 1: Show Alert
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_ALERT,
            parameters={"message": "Agent says hello via B2F RPC!"}
        )
        logger.info(f"B2F Agent Logic: Successfully sent Action 1: SHOW_ALERT to '{target_client_identity}'.")
        await asyncio.sleep(2)

        logger.info(f"B2F Agent Logic: Attempting Action 2: UPDATE_TEXT_CONTENT to '{target_client_identity}'.")
        # Action 2: Update Text
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_TEXT_CONTENT,
            target_element_id="agentUpdatableTextRoxPage", # Must match ID in rox/page.tsx JSX
            parameters={"text": f"Agent updated this text at {asyncio.get_event_loop().time():.0f}"}
        )
        logger.info(f"B2F Agent Logic: Successfully sent Action 2: UPDATE_TEXT_CONTENT to '{target_client_identity}'.")
        await asyncio.sleep(2)

        # Timer Control Demo
        # Start a timer
        logger.info(f"B2F Agent Logic: Attempting START_TIMER to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.START_TIMER,
            target_element_id="speakingTaskTimer",
            parameters={
                "duration_seconds": 30,  # 30 second timer
                "timer_type": "prep"   # Type of timer (prep, response, task)
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent START_TIMER to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Pause the timer
        logger.info(f"B2F Agent Logic: Attempting PAUSE_TIMER to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.PAUSE_TIMER,
            target_element_id="speakingTaskTimer",
            parameters={"pause": "true"}
        )
        logger.info(f"B2F Agent Logic: Successfully sent PAUSE_TIMER to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Resume the timer
        logger.info(f"B2F Agent Logic: Attempting PAUSE_TIMER with false to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.PAUSE_TIMER,
            target_element_id="speakingTaskTimer",
            parameters={"pause": "false"}
        )
        logger.info(f"B2F Agent Logic: Successfully resumed timer for '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Progress Indicator Demo
        logger.info(f"B2F Agent Logic: Attempting UPDATE_PROGRESS_INDICATOR to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_PROGRESS_INDICATOR,
            target_element_id="drillProgressIndicator",
            parameters={
                "current_step": 3,
                "total_steps": 10,
                "message": "Processing speaking task..."
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent UPDATE_PROGRESS_INDICATOR to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Show Element Demo - rox_copy page
        logger.info(f"B2F Agent Logic: Attempting SHOW_ELEMENT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_ELEMENT,
            target_element_id="roxLoadingIndicator",
            parameters={"show": "true"}
        )
        logger.info(f"B2F Agent Logic: Successfully sent SHOW_ELEMENT to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Hide Element Demo - rox_copy page
        logger.info(f"B2F Agent Logic: Attempting HIDE_ELEMENT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.HIDE_ELEMENT,
            target_element_id="roxLoadingIndicator",
            parameters={"show": "false"}
        )
        logger.info(f"B2F Agent Logic: Successfully sent HIDE_ELEMENT to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Additional rox_copy specific action - UPDATE_TEXT_CONTENT
        logger.info(f"B2F Agent Logic: Sending information text to rox_copy page.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_TEXT_CONTENT,
            target_element_id="agentResponseDisplay",
            parameters={
                "text": "Now I'll navigate to the writing practice page to show you feedback on your essay.",
                "append": "false"
            }
        )
        await asyncio.sleep(2)
        
        # ==========================================
        # NAVIGATE TO WRITINGPRACTICE PAGE
        # ==========================================
        
        # Inform the user we're about to navigate to writingpractice
        logger.info(f"B2F Agent Logic: Preparing to perform writingpractice page actions.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_TEXT_CONTENT,
            target_element_id="agentResponseDisplay",
            parameters={
                "text": "Now I'll navigate to the writing practice page to show you feedback on your essay.",
                "append": "false"
            }
        )
        await asyncio.sleep(2)
        
        # Navigate To WritingPractice Page
        logger.info(f"B2F Agent Logic: Attempting NAVIGATE_TO_PAGE to '{target_client_identity}'.") 
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.NAVIGATE_TO_PAGE,
            parameters={
                "page_name": "writingpractice",
                "data_for_page": json.dumps({
                    "user_id": "test123", 
                    "essay_id": "writing_sample_01",
                    "mode": "feedback",
                    "show_tutorial": False
                })
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent NAVIGATE_TO_PAGE to '{target_client_identity}'.") 
        
        # Wait briefly to ensure the page has loaded
        await asyncio.sleep(3)
        
        # ==========================================
        # WRITINGPRACTICE PAGE ACTIONS
        # ==========================================
        
        # First, test a simple SET_BUTTON_PROPERTIES action to see if it works
        logger.info(f"B2F Agent Logic: Testing basic SET_BUTTON_PROPERTIES to '{target_client_identity}'.")
        try:
            await trigger_client_ui_action(
                room=ctx.room,
                client_identity=target_client_identity,
                action_type=interaction_pb2.ClientUIActionType.SET_BUTTON_PROPERTIES,
                target_element_id="submitAnswerButton",
                parameters={
                    "label": "Testing New Button Label",
                    "disabled": "false"
                }
            )
            logger.info(f"B2F Agent Logic: Successfully sent test SET_BUTTON_PROPERTIES action.")
            await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"Error sending SET_BUTTON_PROPERTIES action: {str(e)}", exc_info=True)
        
        # UPDATE_LIVE_TRANSCRIPT Demo - First chunk (not final)
        logger.info(f"B2F Agent Logic: Attempting UPDATE_LIVE_TRANSCRIPT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_LIVE_TRANSCRIPT,
            target_element_id="liveTranscriptArea",
            parameters={
                "new_chunk": "This is the first part of a",
                "is_final_for_sentence": "false"
            }
        )
        await asyncio.sleep(1)
        
        # Second chunk (not final)
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_LIVE_TRANSCRIPT,
            target_element_id="liveTranscriptArea",
            parameters={
                "new_chunk": " live transcript being updated in chunks",
                "is_final_for_sentence": "false"
            }
        )
        await asyncio.sleep(1)
        
        # Final chunk (final for this sentence)
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_LIVE_TRANSCRIPT,
            target_element_id="liveTranscriptArea",
            parameters={
                "new_chunk": ".",
                "is_final_for_sentence": "true"
            }
        )
        
        # Complete sentence transcript
        await asyncio.sleep(1)
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_LIVE_TRANSCRIPT,
            target_element_id="liveTranscriptArea",
            parameters={
                "full_sentence_transcript": "This is a complete sentence transcript that replaces the previous chunks."
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent UPDATE_LIVE_TRANSCRIPT to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # DISPLAY_TRANSCRIPT_OR_TEXT Demo
        logger.info(f"B2F Agent Logic: Attempting DISPLAY_TRANSCRIPT_OR_TEXT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.DISPLAY_TRANSCRIPT_OR_TEXT,
            target_element_id="feedbackContent",
            parameters={
                "text_content": "In this essay, the student has demonstrated a good understanding of the topic but needs to improve in several areas including grammar and vocabulary usage."
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent DISPLAY_TRANSCRIPT_OR_TEXT to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # DISPLAY_REMARKS_LIST Demo
        logger.info(f"B2F Agent Logic: Attempting DISPLAY_REMARKS_LIST to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.DISPLAY_REMARKS_LIST,
            target_element_id="feedbackRemarks",
            parameters={
                "remarks": json.dumps([
                    {
                        "id": "R1",
                        "title": "Grammar Issue",
                        "details": "Subject-verb agreement errors in paragraphs 1 and 3.",
                        "correction_suggestion": "Ensure verbs match their subjects in number (singular/plural)."
                    },
                    {
                        "id": "R2",
                        "title": "Vocabulary Use",
                        "details": "Limited range of academic vocabulary.",
                        "correction_suggestion": "Incorporate more precise academic terms related to the topic."
                    },
                    {
                        "id": "R3",
                        "title": "Organization",
                        "details": "Strong introduction but weak conclusion.",
                        "correction_suggestion": "Make your conclusion more impactful by restating your main points and providing a final thought."
                    }
                ])
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent DISPLAY_REMARKS_LIST to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Score Display Demo
        logger.info(f"B2F Agent Logic: Attempting UPDATE_SCORE_OR_PROGRESS to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_SCORE_OR_PROGRESS,
            target_element_id="drillScoreDisplay",
            parameters={
                "score_text": "Score: 7/10",
                "progress_percentage": 70
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent UPDATE_SCORE_OR_PROGRESS to '{target_client_identity}'.")
        await asyncio.sleep(2)
        
        # Wait a bit to give the user time to view the writingpractice content
        logger.info(f"B2F Agent Logic: Waiting 4 seconds before navigating back to rox_copy.")
        await asyncio.sleep(4)
        
        # SET_BUTTON_PROPERTIES Demo
        logger.info(f"B2F Agent Logic: Attempting SET_BUTTON_PROPERTIES to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SET_BUTTON_PROPERTIES,
            target_element_id="submitAnswerButton",
            parameters={
                "label": "Submit Essay",
                "disabled": "false",
                "style_class": "primary-button highlighted",
                "task_data": json.dumps({
                    "task_id": "writing_task_123",
                    "completion_action": "submit_and_proceed"
                })
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent SET_BUTTON_PROPERTIES to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # ENABLE_BUTTON Demo
        logger.info(f"B2F Agent Logic: Attempting ENABLE_BUTTON to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.ENABLE_BUTTON,
            target_element_id="startRecordingButton"
        )
        logger.info(f"B2F Agent Logic: Successfully sent ENABLE_BUTTON to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # DISABLE_BUTTON Demo
        logger.info(f"B2F Agent Logic: Attempting DISABLE_BUTTON to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.DISABLE_BUTTON,
            target_element_id="submitSpeakingTaskButton"
        )
        logger.info(f"B2F Agent Logic: Successfully sent DISABLE_BUTTON to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # SHOW_BUTTON_OPTIONS Demo
        logger.info(f"B2F Agent Logic: Attempting SHOW_BUTTON_OPTIONS to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_BUTTON_OPTIONS,
            target_element_id="feedbackOptionsPanel",
            parameters={
                "buttons": json.dumps([
                    {
                        "label": "Next Point",
                        "action_context_update": {"ui_event": "next_feedback_item"}
                    },
                    {
                        "label": "Previous Point",
                        "action_context_update": {"ui_event": "prev_feedback_item"}
                    },
                    {
                        "label": "Skip to Summary",
                        "action_context_update": {"ui_event": "show_summary"}
                    }
                ])
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent SHOW_BUTTON_OPTIONS to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # CLEAR_INPUT_FIELD Demo
        logger.info(f"B2F Agent Logic: Attempting CLEAR_INPUT_FIELD to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.CLEAR_INPUT_FIELD,
            target_element_id="drillAnswerInputText"
        )
        logger.info(f"B2F Agent Logic: Successfully sent CLEAR_INPUT_FIELD to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # SET_EDITOR_READONLY_SECTIONS Demo
        logger.info(f"B2F Agent Logic: Attempting SET_EDITOR_READONLY_SECTIONS to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SET_EDITOR_READONLY_SECTIONS,
            target_element_id="scaffoldingFullEssayEditor",
            parameters={
                "ranges": json.dumps([
                    {"start": {"index": 0}, "end": {"index": 120}, "readOnly": True},
                    {"start": {"index": 250}, "end": {"index": 300}, "readOnly": True},
                ])
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent SET_EDITOR_READONLY_SECTIONS to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # PLAY_AUDIO_CUE has been removed
        
        # SHOW_LOADING_INDICATOR Demo
        logger.info(f"B2F Agent Logic: Attempting SHOW_LOADING_INDICATOR to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_LOADING_INDICATOR,
            target_element_id="globalLoadingIndicator",
            parameters={
                "is_loading": "true",  # Use string for consistency
                "message": "Processing your essay feedback..."
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent SHOW_LOADING_INDICATOR to '{target_client_identity}'.")
        await asyncio.sleep(3)  # Give more time to see the loading indicator
        
        # Hide loading indicator
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_LOADING_INDICATOR,
            target_element_id="globalLoadingIndicator",
            parameters={
                "is_loading": "false"  # Use string for consistency
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent HIDE_LOADING_INDICATOR to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # All UI actions completed - end of demo
        logger.info(f"B2F Agent Logic: All UI actions completed. Staying on writingpractice page for testing.")
        
        # Final rox_copy page actions after returning
        
        # Reset the timer - rox_copy page
        logger.info(f"B2F Agent Logic: Attempting RESET_TIMER to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.RESET_TIMER,
            target_element_id="speakingTaskTimer"
        )
        logger.info(f"B2F Agent Logic: Successfully sent RESET_TIMER to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        # Final confirmation message
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_TEXT_CONTENT,
            target_element_id="agentResponseDisplay",
            parameters={
                "text": "We've now returned to the main page. All test UI actions have been demonstrated.",
                "append": "false"
            }
        )
        logger.info(f"B2F Agent Logic: Successfully sent final UPDATE_TEXT_CONTENT to '{target_client_identity}'.")
        await asyncio.sleep(1)
        
        logger.info("B2F Agent Logic: All test UI actions sent.")

    except Exception as e:
        logger.error(f"B2F Agent Logic: Error during sending UI actions: {e}", exc_info=True)

async def entrypoint(ctx: JobContext):
    """Main entrypoint for the agent job."""
    global GLOBAL_PAGE_PATH, GLOBAL_MODEL, GLOBAL_TEMPERATURE, GLOBAL_AVATAR_ENABLED # Allow modification by CLI

    # Set identity BEFORE connecting to room
    if GLOBAL_AVATAR_ENABLED:
        ctx.identity = "rox-tavus-avatar-agent"
    else:
        # Use a fixed identity when avatar is not enabled for predictable RPC
        ctx.identity = "rox-custom-llm-agent"
    logger.info(f"Agent identity set to: {ctx.identity}")

    try:
        await ctx.connect()
        logger.info(f"Successfully connected to LiveKit room '{ctx.room.name}' as '{ctx.identity}'")
    except Exception as e:
        logger.error(f"Failed to connect to LiveKit room: {e}", exc_info=True)
        return
    
    logger.info(f"Runtime Configuration -- Page Path: {GLOBAL_PAGE_PATH}, TTS Model: {GLOBAL_MODEL}, Temperature: {GLOBAL_TEMPERATURE}, Avatar Enabled: {GLOBAL_AVATAR_ENABLED}")
    
    # Create a Rox agent instance
    rox_agent_instance = RoxAgent(page_path=GLOBAL_PAGE_PATH)

    avatar_session = None
    if GLOBAL_AVATAR_ENABLED:
        logger.info("Setting up Tavus avatar session...")
        os.environ["TAVUS_API_KEY"] = TAVUS_API_KEY # Ensure plugin can access it
        try:
            avatar_session = tavus.AvatarSession(
                replica_id=TAVUS_REPLICA_ID,
                persona_id=TAVUS_PERSONA_ID if TAVUS_PERSONA_ID else None
            )
            logger.info("Tavus avatar session object created.")
        except Exception as e:
            logger.error(f"Failed to create Tavus AvatarSession: {e}", exc_info=True)
            GLOBAL_AVATAR_ENABLED = False # Disable avatar if session creation fails
            avatar_session = None


    try:
        logger.info("Creating main agent session with VPA pipeline...")
        main_agent_session = agents.AgentSession( # Renamed for clarity
            stt=deepgram.STT(model="nova-2", language="multi"), # nova-2 or nova-3
            llm=CustomLLMBridge(rox_agent_ref=rox_agent_instance), # Pass agent instance
            tts=deepgram.TTS(model=GLOBAL_MODEL),
            vad=silero.VAD.load(),
            turn_detection=MultilingualModel(),
        )
        logger.info("Main agent session created successfully.")

        if avatar_session: # Implies GLOBAL_AVATAR_ENABLED was true and session created
            logger.info("Starting Tavus avatar session with main_agent_session and room...")
            await avatar_session.start(agent_session=main_agent_session, room=ctx.room)
            logger.info("Tavus avatar session started.")
        
        logger.info("Starting main agent session...")
        await main_agent_session.start(
            room=ctx.room,
            agent=rox_agent_instance,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
            room_output_options=agents.RoomOutputOptions(
                audio_enabled=not bool(avatar_session), # Disable agent's direct audio if avatar is active
            ),
        )
        logger.info("Main agent session started successfully.")

        # Instantiate the RPC service, passing the agent instance
        agent_rpc_service = AgentInteractionService(agent_instance=rox_agent_instance)

        # Register RPC handlers with the local participant
        # The name "HandleFrontendButton" must match what the client calls.
        try:
            if ctx.room and ctx.room.local_participant:
                ctx.room.local_participant.register_rpc_method(
                    "rox.interaction.AgentInteraction/HandleFrontendButton",  # Use package.Service/Method name
                    agent_rpc_service.HandleFrontendButton
                )
                logger.info("Successfully registered RPC handler for rox.interaction.AgentInteraction/HandleFrontendButton.")
            else:
                logger.error("Cannot register RPC handler: room or local_participant not available.")
        except Exception as e_rpc_reg:
            logger.error(f"Failed to register RPC handler for rox.interaction.AgentInteraction/HandleFrontendButton: {e_rpc_reg}", exc_info=True)

        
        logger.info(f"Rox agent is now fully operational in room '{ctx.room.name}' for page '{GLOBAL_PAGE_PATH}'. Waiting for events or RPC calls...")

        # Start the B2F agent logic concurrently
        asyncio.create_task(agent_main_logic(ctx)) # Pass the JobContext
        logger.info("B2F Agent Logic Task Created.")
        
        # The agent is now running and will stay connected due to the initial ctx.connect()
        # and the running asyncio loop managed by agents.cli.run_app.
        # We need to keep the entrypoint alive until the job is done.
        await asyncio.Event().wait() # Keep the agent alive until the job is cancelled
    except Exception as e:
        logger.error(f"Critical error during agent session setup or execution: {e}", exc_info=True)
    finally:
        logger.info(f"Agent job for room '{ctx.room.name if ctx.room else 'Unknown'}' is ending.")
        # Ensure avatar_session and main_agent_session are accessible for cleanup
        # They are defined within the outer scope of this try-except-finally block
        if avatar_session: 
            try:
                await avatar_session.aclose() 
                logger.info("Tavus avatar session closed.")
            except Exception as e_avatar_close:
                logger.error(f"Error closing Tavus avatar session: {e_avatar_close}", exc_info=True)
        
        if 'main_agent_session' in locals() and main_agent_session and hasattr(main_agent_session, 'aclose'):
             try:
                await main_agent_session.aclose()
                logger.info("Main agent session closed.")
             except Exception as e_main_session_close:
                logger.error(f"Error closing main agent session: {e_main_session_close}", exc_info=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rox LiveKit AI Agent", add_help=False) # add_help=False to handle it with LiveKit's CLI
    
    # Custom arguments for this agent
    parser.add_argument('--page-path', type=str, default=GLOBAL_PAGE_PATH, help=f'Path to web page (default: {GLOBAL_PAGE_PATH})')
    parser.add_argument('--tts-model', type=str, default=GLOBAL_MODEL, help=f'Deepgram TTS model (default: {GLOBAL_MODEL})')
    parser.add_argument('--temperature', type=float, default=GLOBAL_TEMPERATURE, help=f'LLM temperature (default: {GLOBAL_TEMPERATURE})')
    parser.add_argument('--avatar-enabled', type=lambda x: (str(x).lower() == 'true'), nargs='?', const=True, default=None,
                        help='Enable Tavus avatar (true/false). Overrides .env if provided.')

    # Parse only known arguments for this script, leave others for LiveKit CLI
    args, unknown_args = parser.parse_known_args()
    
    # Update global settings from CLI arguments if provided
    GLOBAL_PAGE_PATH = args.page_path
    GLOBAL_MODEL = args.tts_model
    GLOBAL_TEMPERATURE = args.temperature
    if args.avatar_enabled is not None: # If --avatar-enabled was present
        GLOBAL_AVATAR_ENABLED = args.avatar_enabled
        if GLOBAL_AVATAR_ENABLED and not TAVUS_ENABLED: # TAVUS_ENABLED checks .env
            logger.warning("Avatar explicitly enabled by CLI, but Tavus credentials in .env are incomplete. Avatar may not function.")
    
    logger.info(f"Final Runtime Configuration -- Page Path: {GLOBAL_PAGE_PATH}, TTS Model: {GLOBAL_MODEL}, Temperature: {GLOBAL_TEMPERATURE}, Avatar Enabled: {GLOBAL_AVATAR_ENABLED}")

    # Reconstruct sys.argv for LiveKit's CLI, passing through unknown args
    # This ensures LiveKit's own CLI arguments (like --url, --api-key, etc.) are processed by it.
    sys.argv = [sys.argv[0]] + unknown_args
    
    agents.cli.run_app(
        WorkerOptions( # Use WorkerOptions from livekit.agents
            entrypoint_fnc=entrypoint
        )
    )