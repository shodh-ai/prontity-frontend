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

import aiohttp
import os
import sys
import json
import logging
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Dict, Any

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
    logger.error(f"Failed to import core LiveKit plugins (deepgram, silero, turn_detector): {e}")
    logger.error("Please install/check: 'livekit-agents[deepgram,silero,turn-detector]' and 'livekit-plugins-noise-cancellation'")
    sys.exit(1)

# Import the Custom LLM Bridge
try:
    from custom_llm import CustomLLMBridge # Use relative import if custom_llm.py is in the same directory
except ImportError:
    logger.error("Failed to import CustomLLMBridge. Make sure custom_llm.py exists in the 'rox' directory and aiohttp is installed.")
    sys.exit(1)

# Define the RPC method name for client UI actions globally
CLIENT_RPC_FUNC_PERFORM_UI_ACTION = "rox.interaction.AgentInteraction/PerformUIAction"

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
        super().__init__(instructions="You are Rox, an AI assistant helping users.")
        self.page_path = page_path
        self.latest_transcript_time = 0
        self._latest_student_context: Optional[Dict[str, Any]] = None
        self._latest_session_id: Optional[str] = None
        self._interaction_service_registered = False # Flag to track RPC service registration
        # Initialize the CustomLLMBridge instance here, passing self (RoxAgent instance)
        self.custom_llm_bridge = CustomLLMBridge(rox_agent_ref=self) # Pass self as rox_agent_ref
        logger.info(f"RoxAgent.__init__: self (type: {type(self)}) is a JobContext. self.room initially: {getattr(self, 'room', 'Not yet initialized')}")
        logger.info(f"RoxAgent.__init__ called for page_path: {page_path}. Attributes: {dir(self)}")

    async def send_ui_action_to_frontend(self, action_data: dict):
        """
        Sends a structured UI action to the frontend by invoking a client-side RPC method.
        action_data should be a dict like:
        {"action_type_str": "SHOW_ALERT", "parameters": {"message": "Hello!"}}
        """
        if not getattr(self, 'room', None):
            logger.error("RoxAgent.send_ui_action_to_frontend: Room (self.room) not available.")
            return

        try:
            action_type_str = action_data.get("action_type_str")
            parameters = action_data.get("parameters", {})

            if not action_type_str:
                logger.warning("RoxAgent.send_ui_action_to_frontend: 'action_type_str' missing in action_data.")
                return

            try:
                action_type_enum = interaction_pb2.ClientUIActionType.Value(action_type_str)
            except ValueError:
                logger.error(f"RoxAgent.send_ui_action_to_frontend: Invalid action_type_str '{action_type_str}'. Known values: {interaction_pb2.ClientUIActionType.keys()}")
                return

            request_id = str(uuid.uuid4())
            
            action_request_proto = interaction_pb2.AgentToClientUIActionRequest(
                requestId=request_id,
                actionType=action_type_enum,
                # targetElementId is optional, can be omitted if not relevant for the action
                parametersJson=json.dumps(parameters) # Client expects parameters as a JSON string
            )

            payload_bytes = action_request_proto.SerializeToString()
            # The client's handlePerformUIAction expects a base64 string which it decodes.
            # However, room.rpc.send_request payload is bytes.
            # It's assumed LiveKit handles the bytes -> base64 string transfer if client receives string.

            service_name = "rox.interaction.ClientSideUI"
            method_name = "PerformUIAction"

            logger.info(f"RoxAgent: Sending UI action RPC to frontend: {action_type_str}, params: {json.dumps(parameters)}, service: {service_name}, method: {method_name}")

            # Sending without target_sids or target_identity broadcasts to all other participants.
            # If specific targeting is needed, populate target_sids or target_identity.
            await self.room.rpc.send_request(
                service=service_name,
                method=method_name,
                payload=payload_bytes, # Send raw protobuf bytes
                timeout=10 # seconds
            )
            logger.debug(f"RoxAgent: Successfully sent RPC request for UI action '{action_type_str}'.")

        except Exception as e:
            logger.error(f"RoxAgent.send_ui_action_to_frontend: Error sending UI action RPC: {e}", exc_info=True)

    async def dispatch_frontend_rpc(self, rpc_call_data: dict):
        logger.critical(f"!!!!!! RoxAgent.dispatch_frontend_rpc (id: {id(self)}) ENTERED. self.room: {getattr(self, 'room', 'N/A')} !!!!!!")
        """
        Sends a generic RPC-like call (e.g., for UI actions like alerts) to the frontend 
        via the data channel.
        rpc_call_data should be a dict like:
        {"function_name": "show_alert", "args": {"title": "Alert!", "message": "This is an alert."}}
        """
        if not getattr(self, 'room', None):
            logger.error("RoxAgent.dispatch_frontend_rpc: Room (self.room) not available.")
            return

        try:
            # The frontend will expect a specific topic for these kinds of messages.
            # Let's define it, e.g., "agent_rpc_calls"
            rpc_topic = "agent_rpc_calls" 
            
            # The payload needs to be bytes. We'll send the rpc_call_data as a JSON string.
            payload_str = json.dumps(rpc_call_data)
            payload_bytes = payload_str.encode('utf-8')

            logger.info(f"RoxAgent: Dispatching RPC data to frontend via data channel. Topic: '{rpc_topic}', Data: {payload_str}")
            
            await self.room.send_data(
                payload=payload_bytes,
                topic=rpc_topic,
                reliable=True  # Ensure reliable delivery for UI commands
            )
            logger.debug(f"RoxAgent: Successfully sent data for RPC call '{rpc_call_data.get('function_name')}' via data channel.")

        except Exception as e:
            logger.error(f"RoxAgent.dispatch_frontend_rpc: Error sending data via data channel: {e}", exc_info=True)

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
    parameters: dict = None,
    highlight_ranges_payload_data: list = None,  # New parameter for highlight data
    suggest_text_edit_payload_data: Optional[Dict[str, Any]] = None, # New parameter for text edit suggestion
    show_inline_suggestion_payload_data: Optional[Dict[str, Any]] = None, # For SHOW_INLINE_SUGGESTION
    show_tooltip_or_comment_payload_data: Optional[Dict[str, Any]] = None, # For SHOW_TOOLTIP_OR_COMMENT
    set_editor_content_payload_data: Optional[Dict[str, Any]] = None,      # For SET_EDITOR_CONTENT
    append_text_to_editor_realtime_payload_data: Optional[Dict[str, Any]] = None # For APPEND_TEXT_TO_EDITOR_REALTIME
) -> Optional[interaction_pb2.ClientUIActionResponse]: # Return the response from the client
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
        The response from the client, or None if there was an erro
 """
    target_participant = None
    # Check local participant as well, in case agent is sending to itself (e.g., for testing)
    if room.local_participant and room.local_participant.identity == client_identity:
        target_participant = room.local_participant
    else:
        for participant_info in room.remote_participants.values(): # participant_info is rtc.RemoteParticipant
            if participant_info.identity == client_identity:
                target_participant = participant_info # Use participant_info directly
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

        logger.error(f"B2F RPC: Client '{client_identity}' not found in room '{room.name}'. Cannot send UI action.")
        return None

    request_pb = interaction_pb2.AgentToClientUIActionRequest()
    request_pb.request_id = f"ui-{str(uuid.uuid4())[:8]}" # Generate a unique request ID
    request_pb.action_type = action_type
    if target_element_id:
        request_pb.target_element_id = target_element_id
    if parameters:
        for key, value in parameters.items():
            request_pb.parameters[key] = str(value) # Ensure value is string

    # Populate highlight_ranges_payload if data is provided
    if action_type == interaction_pb2.ClientUIActionType.HIGHLIGHT_TEXT_RANGES and highlight_ranges_payload_data:
        for hl_data in highlight_ranges_payload_data:
            highlight_proto = request_pb.highlight_ranges_payload.add()
            highlight_proto.id = hl_data.get("id", "")
            highlight_proto.start = hl_data.get("start", 0)
            highlight_proto.end = hl_data.get("end", 0)
            highlight_proto.type = hl_data.get("type", "")
            highlight_proto.message = hl_data.get("message", "")
            highlight_proto.wrong_version = hl_data.get("wrongVersion", "")
            highlight_proto.correct_version = hl_data.get("correctVersion", "")

    # Populate suggest_text_edit_payload if data is provided
    if action_type == interaction_pb2.ClientUIActionType.SUGGEST_TEXT_EDIT and suggest_text_edit_payload_data:
        # Create an instance of SuggestTextEditPayloadProto
        suggestion_proto = request_pb.suggest_text_edit_payload # This directly gives a mutable reference
        suggestion_proto.suggestion_id = suggest_text_edit_payload_data.get("suggestion_id", str(uuid.uuid4())) # Default to new UUID if not provided
        suggestion_proto.start_pos = suggest_text_edit_payload_data.get("start_pos", 0)
        suggestion_proto.end_pos = suggest_text_edit_payload_data.get("end_pos", 0)
        suggestion_proto.original_text = suggest_text_edit_payload_data.get("original_text", "")
        suggestion_proto.new_text = suggest_text_edit_payload_data.get("new_text", "")

    if action_type == interaction_pb2.ClientUIActionType.SHOW_INLINE_SUGGESTION and show_inline_suggestion_payload_data:
        # Create an instance of ShowInlineSuggestionPayloadProto
        suggestion_proto = request_pb.show_inline_suggestion_payload # This directly gives a mutable reference
        suggestion_proto.suggestion_id = show_inline_suggestion_payload_data.get("suggestion_id", str(uuid.uuid4())) # Default to new UUID if not provided
        suggestion_proto.start_pos = show_inline_suggestion_payload_data.get("start_pos", 0)
        suggestion_proto.end_pos = show_inline_suggestion_payload_data.get("end_pos", 0)
        suggestion_proto.suggestion_text = show_inline_suggestion_payload_data.get("suggestion_text", "")
        suggestion_proto.suggestion_type = show_inline_suggestion_payload_data.get("suggestion_type", "")

    elif action_type == interaction_pb2.ClientUIActionType.SHOW_TOOLTIP_OR_COMMENT and show_tooltip_or_comment_payload_data:
        logger.debug(f"B2F RPC: Populating SHOW_TOOLTIP_OR_COMMENT payload with: {show_tooltip_or_comment_payload_data}")
        tooltip_proto = request_pb.show_tooltip_or_comment_payload
        tooltip_proto.id = show_tooltip_or_comment_payload_data.get("tooltip_id", str(uuid.uuid4())) # Keep using 'tooltip_id' from the dict for now, or change dict key
        tooltip_proto.start_pos = show_tooltip_or_comment_payload_data.get("start_pos", 0)
        tooltip_proto.end_pos = show_tooltip_or_comment_payload_data.get("end_pos", 0)
        tooltip_proto.text = show_tooltip_or_comment_payload_data.get("tooltip_text", "")
        tooltip_proto.tooltip_type = show_tooltip_or_comment_payload_data.get("tooltip_type", "comment_generic") # Default to generic comment

    elif action_type == interaction_pb2.ClientUIActionType.SET_EDITOR_CONTENT and set_editor_content_payload_data:
        logger.debug(f"B2F RPC: Populating SET_EDITOR_CONTENT payload with: {set_editor_content_payload_data}")
        editor_content_proto = request_pb.set_editor_content_payload
        if "html_content" in set_editor_content_payload_data:
            editor_content_proto.html_content = set_editor_content_payload_data["html_content"]
        elif "json_content" in set_editor_content_payload_data:
            editor_content_proto.json_content = set_editor_content_payload_data["json_content"]
        else:
            logger.warning("SET_EDITOR_CONTENT: Neither html_content nor json_content provided in payload data. Defaulting to empty HTML.")
            editor_content_proto.html_content = "" # Default or handle error appropriately

    elif action_type == interaction_pb2.ClientUIActionType.APPEND_TEXT_TO_EDITOR_REALTIME and append_text_to_editor_realtime_payload_data:
        logger.debug(f"B2F RPC: Populating APPEND_TEXT_TO_EDITOR_REALTIME payload with: {append_text_to_editor_realtime_payload_data}")
        append_text_proto = request_pb.append_text_to_editor_realtime_payload
        append_text_proto.text_chunk = append_text_to_editor_realtime_payload_data.get("text_chunk", "")
        append_text_proto.is_final_chunk = append_text_to_editor_realtime_payload_data.get("is_final_chunk", False)
        append_text_proto.stream_id = append_text_to_editor_realtime_payload_data.get("stream_id", str(uuid.uuid4()))

    # Add more elif blocks here for other action types and their specific payloads
    else:
        # This case handles actions that are defined in the enum but don't have specific payload logic here yet,
        # or if specific payload data was expected but not provided.
        logger.warning(f"B2F RPC: Action type '{action_type}' ({interaction_pb2.ClientUIActionType.Name(action_type)}) is recognized but no specific payload data was provided or handled explicitly in this function. Sending generic request if base parameters (target_element_id, parameters) were set.")


    # The rest of the RPC sending logic should be at the same indentation level as the if/elif/else block for populating payloads.
    service_name = "rox.interaction.ClientSideUI" 
    method_name = "PerformUIAction"
    rpc_method_name = f"{service_name}/{method_name}" # For logging and potentially for the call

    try:
        payload_bytes = request_pb.SerializeToString()
        
        logger.info(f"B2F RPC: Sending '{rpc_method_name}' to client '{client_identity}' with request_id '{request_pb.request_id}'. Action: {interaction_pb2.ClientUIActionType.Name(action_type)}")
        
        base64_encoded_payload = base64.b64encode(payload_bytes).decode('utf-8')

        # Send the RPC using room.local_participant.perform_rpc
        response_payload_str = await room.local_participant.perform_rpc(
            destination_identity=client_identity,
            method=rpc_method_name,
            payload=base64_encoded_payload
        )
        response_bytes = base64.b64decode(response_payload_str)

        response_pb = interaction_pb2.ClientUIActionResponse()
        response_pb.ParseFromString(response_bytes)

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

    # TEST: Send a highlight request
    if target_client_identity and ctx.room:
        logger.info(f"B2F Agent Logic: Attempting to send a test HIGHLIGHT_TEXT_RANGES action to {target_client_identity}")
        sample_highlights = [
            {"id": "first-word-hl", "start": 1, "end": 6, "type": "agent_highlight", "message": "Highlighting the first word 'Hello'"}
        ]
        # Ensure interaction_pb2 is available in this scope. It should be if imported globally.

        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.HIGHLIGHT_TEXT_RANGES,
            highlight_ranges_payload_data=sample_highlights
        )

        logger.info(f"B2F Agent Logic: Successfully sent Action 1: SHOW_ALERT to '{target_client_identity}'.")
        await asyncio.sleep(2)

        logger.info(f"B2F Agent Logic: Attempting Action 2: UPDATE_TEXT_CONTENT to '{target_client_identity}'.")
        # Action 2: Update Text

        logger.info(f"B2F Agent Logic: Test HIGHLIGHT_TEXT_RANGES action sent to {target_client_identity}")

        # TEST: Send a SUGGEST_TEXT_EDIT request
        await asyncio.sleep(2) # Small delay before next test action
        logger.info(f"B2F Agent Logic: Attempting to send a test SUGGEST_TEXT_EDIT action to {target_client_identity}")
        sample_text_edit = {
            "suggestion_id": "edit-suggestion-1",
            "start_pos": 7, # Example: If text is "Hello brave world!", suggest "brave" -> "new". "b" is at 7 (1-indexed).
            "end_pos": 12,  # End of "brave" (exclusive for typical ranges, or inclusive for ProseMirror like end)
            "original_text": "brave",
            "new_text": "new"
        }

        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SUGGEST_TEXT_EDIT,
            suggest_text_edit_payload_data=sample_text_edit
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

        logger.info(f"B2F Agent Logic: Test SUGGEST_TEXT_EDIT action sent to {target_client_identity}")

        # TEST: Send a SHOW_INLINE_SUGGESTION action
        await asyncio.sleep(2) # Stagger actions slightly
        logger.info(f"B2F Agent Logic: Attempting to send a test SHOW_INLINE_SUGGESTION action to {target_client_identity}")
        inline_suggestion_payload = {
            "suggestion_id": "inline-suggest-001",
            "start_pos": 50, # Approximate, client will use actual editor positions
            "end_pos": 63,   # Approximate for "send commands"
            "suggestion_text": "Consider rephrasing to 'dispatch instructions' for a more formal tone.",
            "suggestion_type": "style"
        }
        response_inline = await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_INLINE_SUGGESTION,
            target_element_id="liveWritingEditor", # Assuming this is the target editor
            show_inline_suggestion_payload_data=inline_suggestion_payload
        )
        if response_inline and response_inline.success:
            logger.info(f"B2F RPC: Response from client '{target_client_identity}' for UI action '{response_inline.request_id}': Success={response_inline.success}, Msg='{response_inline.message}'")
        else:
            logger.warning(f"B2F RPC: Failed or no response for SHOW_INLINE_SUGGESTION to '{target_client_identity}'. Response: {response_inline}")
        logger.info(f"B2F Agent Logic: Test SHOW_INLINE_SUGGESTION action sent to {target_client_identity}")

        # TEST: Send a SHOW_TOOLTIP_OR_COMMENT action
        await asyncio.sleep(2) # Stagger actions slightly
        logger.info(f"B2F Agent Logic: Attempting to send a test SHOW_TOOLTIP_OR_COMMENT action to {target_client_identity}")
        tooltip_payload = {
            "tooltip_id": "tooltip-001",
            "start_pos": 18, # Approximate for "Tiptap editor"
            "end_pos": 32,   # Approximate
            "tooltip_text": "This is the main editor component used for writing.",
            "tooltip_type": "info" # Can be 'info', 'warning', 'comment'
        }
        response_tooltip = await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_TOOLTIP_OR_COMMENT,
            target_element_id="liveWritingEditor",
            show_tooltip_or_comment_payload_data=tooltip_payload
        )
        if response_tooltip and response_tooltip.success:
            logger.info(f"B2F RPC: Response from client '{target_client_identity}' for UI action '{response_tooltip.request_id}': Success={response_tooltip.success}, Msg='{response_tooltip.message}'")
        else:
            logger.warning(f"B2F RPC: Failed or no response for SHOW_TOOLTIP_OR_COMMENT to '{target_client_identity}'. Response: {response_tooltip}")
        logger.info(f"B2F Agent Logic: Test SHOW_TOOLTIP_OR_COMMENT action sent to {target_client_identity}")

        # Test SHOW_INLINE_SUGGESTION
        logger.info(f"B2F Agent Logic: Attempting to send a test SHOW_INLINE_SUGGESTION action to {target_client_identity}")
        inline_suggestion_payload_data = {
            "suggestion_id": "suggestion-001",
            "text_to_suggest": " suggested inline text",
            "insertion_pos": 10, # Example position
            "suggestion_type": "correction" # or "completion"
        }
        await trigger_client_ui_action(
            ctx.room,
            target_client_identity,
            interaction_pb2.ClientUIActionType.SHOW_INLINE_SUGGESTION,
            show_inline_suggestion_payload_data=inline_suggestion_payload_data
        )
        await asyncio.sleep(2) # Wait a bit before the next action

        # Test SHOW_TOOLTIP_OR_COMMENT
        logger.info(f"B2F Agent Logic: Attempting to send a test SHOW_TOOLTIP_OR_COMMENT action to {target_client_identity}")
        tooltip_payload_data = {
            "tooltip_id": "comment-001",
            "start_pos": 5,
            "end_pos": 15,
            "tooltip_text": "This is a test comment of type 'info'.",
            "tooltip_type": "comment_info" # Example: 'comment_info', 'comment_warning', 'comment_error', 'comment_question', 'comment_suggestion', 'comment_generic'
        }
        await trigger_client_ui_action(
            ctx.room,
            target_client_identity,
            interaction_pb2.ClientUIActionType.SHOW_TOOLTIP_OR_COMMENT,
            show_tooltip_or_comment_payload_data=tooltip_payload_data
        )
        await asyncio.sleep(2) # Wait a bit before the next action

        # Test SET_EDITOR_CONTENT
        logger.info(f"B2F Agent Logic: Attempting to send a test SET_EDITOR_CONTENT action to {target_client_identity}")
        set_content_payload = {
            "html_content": "<h1>Agent Content Update</h1><p>This is the <strong>new editor content</strong> set by the agent!</p><p>It can span <em>multiple lines</em> and include  разных стилей.</p>"
        }
        await trigger_client_ui_action(
            ctx.room,
            target_client_identity,
            interaction_pb2.ClientUIActionType.SET_EDITOR_CONTENT,
            set_editor_content_payload_data=set_content_payload
        )
        await asyncio.sleep(3) # Wait a bit

        # Test APPEND_TEXT_TO_EDITOR_REALTIME (simulating streaming)
        logger.info(f"B2F Agent Logic: Attempting to send a test APPEND_TEXT_TO_EDITOR_REALTIME action to {target_client_identity}")
        append_chunks = [
            {"text_chunk": "This text is ", "is_final_chunk": False, "stream_id": "stream1-chunk1"},
            {"text_chunk": "being appended ", "is_final_chunk": False, "stream_id": "stream1-chunk2"},
            {"text_chunk": "in real-time!", "is_final_chunk": True, "stream_id": "stream1-chunk3"},
        ]
        for i, chunk_data in enumerate(append_chunks):
            logger.info(f"B2F Agent Logic: Sending append chunk {i+1}/{len(append_chunks)}: {chunk_data['text_chunk']}")
            await trigger_client_ui_action(
                ctx.room,
                target_client_identity,
                interaction_pb2.ClientUIActionType.APPEND_TEXT_TO_EDITOR_REALTIME,
                append_text_to_editor_realtime_payload_data=chunk_data
            )
            await asyncio.sleep(0.5) # Small delay between chunks
        await asyncio.sleep(2) # Wait a bit after appending

        logger.info(f"B2F Agent Logic: All test UI actions sent to {target_client_identity}.")

    # Disable automatic UI actions - all UI actions will come from FastAPI
    logger.info("B2F Agent Logic: Automatic UI actions are disabled. UI actions will be controlled by FastAPI.")
    
    # Simply keep the task alive
    try:
        while True:
            await asyncio.sleep(10)  # Just keep the task alive without sending any actions


    except Exception as e:
        logger.error(f"B2F Agent Logic: Error during sending UI actions: {e}", exc_info=True)

async def entrypoint(ctx: JobContext):
    # Configure the module-level logger (named 'rox.main', aliased as 'logger' in this file)
    # to ensure its messages are processed and displayed.
    logger.setLevel(logging.DEBUG)
    logger.debug(f"Logger '{logger.name}' (used by RoxAgent methods) configured to {logging.getLevelName(logger.getEffectiveLevel())} in entrypoint.")
    logger.info(f"ENTRYPOINT: Received ctx of type: {type(ctx)}. ctx.room initially: {getattr(ctx, 'room', 'Not yet initialized')}")
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
    logger.info(f"ENTRYPOINT: rox_agent_instance (id: {id(rox_agent_instance)}) created. rox_agent_instance.room (same as ctx.room): {getattr(rox_agent_instance, 'room', 'N/A')}, rox_agent_instance.room.status: {getattr(rox_agent_instance.room, 'status', 'N/A') if getattr(rox_agent_instance, 'room', None) else 'N/A'}")

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