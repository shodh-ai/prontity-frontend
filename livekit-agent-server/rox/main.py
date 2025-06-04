#!/usr/bin/env python3
"""
Rox Assistant LiveKit Agent

This script connects the Rox assistant AI agent to LiveKit sessions.
The agent processes audio via the LiveKit SDK and generates responses using
the external agent service defined in custom_llm.py.
It also exposes an RPC service for frontend interactions and can send UI commands.
"""

import base64 # For B2F RPC payload
import uuid   # For unique request IDs
import time   # For timestamps
import json   # For handling JSON data
from livekit import rtc # For B2F RPC type hints
from generated.protos import interaction_pb2 # For B2F and F2B RPC messages

import os
import sys
import logging
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import LiveKit components
from livekit import agents
from livekit.agents import Agent, JobContext, RoomInputOptions, WorkerOptions
from livekit.agents.llm import LLM, ChatContext, ChatRole, ChatMessage, ChatChunk # For on_llm_response_done

# Import VPA pipeline components
tavus_module = None
try:
    from livekit.plugins import noise_cancellation
    from livekit.plugins import deepgram, silero
    from livekit.plugins.turn_detector.multilingual import MultilingualModel

    try:
        from livekit.plugins import tavus as tv_module
        tavus_module = tv_module
        logger.info("Tavus plugin imported successfully.")
    except TypeError as te:
        if "unsupported operand type(s) for |" in str(te):
            logger.warning("Tavus plugin could not be imported. This is likely due to Python version incompatibility (Tavus plugin may require Python 3.10+). Tavus features will be disabled.")
        else:
            logger.error(f"TypeError while importing Tavus plugin: {te}")
    except ImportError as ie:
        logger.warning(f"Tavus plugin not found (ImportError: {ie}). Tavus features will be disabled.")

except ImportError as e:
    logger.error(f"Failed to import core LiveKit plugins (deepgram, silero, noise_cancellation, turn_detector): {e}")
    logger.error("Please install/check: 'livekit-agents[deepgram,silero,turn-detector]' and 'livekit-plugins-noise-cancellation'")
    sys.exit(1)

# Import the Custom LLM Bridge
try:
    from custom_llm import CustomLLMBridge
except ImportError:
    logger.error("Failed to import CustomLLMBridge. Make sure custom_llm.py exists in the 'rox' directory and aiohttp is installed.")
    sys.exit(1)

# Import RPC service implementation
try:
    from rpc_services import AgentInteractionService
except ImportError as e:
    logger.error(f"Failed to import AgentInteractionService from rpc_services.py. Error: {e}", exc_info=True)
    sys.exit(1)

# Define the RPC method name that the AGENT CALLS ON THE CLIENT for UI actions
CLIENT_RPC_FUNC_PERFORM_UI_ACTION = "rox.interaction.ClientSideUI/PerformUIAction"

# Find and load .env file
script_dir = Path(__file__).resolve().parent
env_path = script_dir / '.env'
if env_path.exists():
    logger.info(f"Loading environment from: {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    logger.warning(f"No .env file found at {env_path}, using environment variables directly if set.")

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

# Tavus configuration
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY", "")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID", "")
TAVUS_ENABLED = bool(TAVUS_API_KEY and TAVUS_REPLICA_ID)
if TAVUS_ENABLED:
    logger.info("Tavus avatar configuration found and seems complete.")
else:
    logger.warning("Tavus avatar not fully configured. Avatar functionality will be disabled.")

# Global configuration
GLOBAL_PAGE_PATH = "roxpage"
GLOBAL_MODEL = "aura-asteria-en"
GLOBAL_TEMPERATURE = 0.7
GLOBAL_AVATAR_ENABLED = tavus_module is not None and TAVUS_ENABLED

class RoxAgent(Agent):
    """Rox AI assistant with UI interaction capabilities."""
    def __init__(self, page_path="roxpage") -> None:
        super().__init__(instructions="You are Rox, an AI assistant for students using the learning platform. You help students understand their learning status and guide them through their learning journey.")
        self.page_path = page_path
        self.latest_transcript_time = 0


        self._latest_student_context: Optional[Dict[str, Any]] = None
        self._latest_session_id: Optional[str] = None
        self._interaction_service_registered = False # Flag to track RPC service registration
        # Initialize the CustomLLMBridge instance here, passing self (RoxAgent instance)
        self.custom_llm_bridge = CustomLLMBridge(rox_agent_ref=self) # Pass self as rox_agent_ref
        self._room = None  # Initialize _room attribute
        self.participant_data = {} # Stores participant-specific data like userToken
        logger.info(f"RoxAgent.__init__: self (type: {type(self)}) is a JobContext. self._room initially: {getattr(self, '_room', 'Not yet initialized')}")
        logger.info(f"RoxAgent.__init__ called for page_path: {page_path}. Attributes: {dir(self)}")


    async def send_ui_action_to_frontend(self, action_data: dict):
        """
        Sends a structured UI action to the frontend using room.rpc.send_request.
        This method is kept from File 1 and uses raw protobuf bytes.
        """
        if not self._room: # Use self._room consistently
            logger.error("RoxAgent.send_ui_action_to_frontend: Room (self._room) not available.")
            return

        try:
            action_type_str = action_data.get("action_type_str")
            parameters = action_data.get("parameters", {})

            if not action_type_str:
                logger.warning("RoxAgent.send_ui_action_to_frontend: 'action_type_str' missing.")
                return

            try:
                action_type_enum = interaction_pb2.ClientUIActionType.Value(action_type_str)
            except ValueError:
                logger.error(f"Invalid action_type_str '{action_type_str}'.")
                return

            request_id = str(uuid.uuid4())
            action_request_proto_args = {
                "request_id": request_id, # Corrected from requestId
                "action_type": action_type_enum,
            }

            if "targetElementId" in parameters:
                 action_request_proto_args["target_element_id"] = parameters.pop("targetElementId") # Corrected field name

            # Specific payload handling from File 1's send_ui_action_to_frontend
            if action_type_enum == interaction_pb2.ClientUIActionType.STRIKETHROUGH_TEXT_RANGES:
                st_ranges_data = action_data.get("strikethrough_ranges_data", [])
                proto_ranges = [interaction_pb2.StrikeThroughRangeProto(**r) for r in st_ranges_data]
                action_request_proto_args["strikethrough_ranges_payload"] = proto_ranges
            elif action_type_enum == interaction_pb2.ClientUIActionType.HIGHLIGHT_TEXT_RANGES:
                hl_ranges_data = action_data.get("highlight_ranges_data", [])
                proto_ranges = [interaction_pb2.HighlightRangeProto(**r) for r in hl_ranges_data]
                action_request_proto_args["highlight_ranges_payload"] = proto_ranges
            
            # Fallback to parametersJson if other specific payloads are not handled here
            # This assumes AgentToClientUIActionRequest might have a parameters_json field
            # If it only has map<string, string> parameters, this part might need adjustment
            # or be removed if trigger_client_ui_action is always preferred.
            if parameters:
                 action_request_proto_args["parameters_json"] = json.dumps(parameters)


            action_request_proto = interaction_pb2.AgentToClientUIActionRequest(**action_request_proto_args)
            payload_bytes = action_request_proto.SerializeToString()
            
            service_name = "rox.interaction.ClientSideUI"
            method_name = "PerformUIAction"

            logger.info(f"RoxAgent: Sending UI action (via send_request): {action_type_str}, params: {json.dumps(parameters)}")
            await self._room.rpc.send_request(
                service=service_name,
                method=method_name,
                payload=payload_bytes,
                timeout=10
            )
            logger.debug(f"Successfully sent RPC (via send_request) for UI action '{action_type_str}'.")

        except Exception as e:
            logger.error(f"Error in send_ui_action_to_frontend: {e}", exc_info=True)

    async def dispatch_frontend_rpc(self, rpc_call_data: dict):
        """Sends generic RPC-like call via data channel (from File 1)."""
        if not self._room:
            logger.error("RoxAgent.dispatch_frontend_rpc: Room (self._room) not available.")
            return
        try:
            rpc_topic = "agent_rpc_calls"
            payload_str = json.dumps(rpc_call_data)
            payload_bytes = payload_str.encode('utf-8')
            logger.info(f"RoxAgent: Dispatching RPC data via data channel. Topic: '{rpc_topic}', Data: {payload_str}")
            await self._room.send_data(payload=payload_bytes, topic=rpc_topic, reliable=True)
            logger.debug(f"Successfully sent data for RPC call '{rpc_call_data.get('function_name')}' via data channel.")
        except Exception as e:
            logger.error(f"Error in dispatch_frontend_rpc: {e}", exc_info=True)

    async def on_transcript(self, transcript: str, language: str) -> None:
        logger.info(f"USER SAID (lang: {language}): '{transcript}'")
        
    async def on_reply(self, message: str, audio_url: str = None) -> None:
        logger.info(f"ROX ASSISTANT REPLIED: '{message}'")
        if audio_url: logger.debug(f"Audio URL: {audio_url}")
        else: logger.warning("No audio URL for reply.")
            
    async def on_llm_response_done(self, chunks: list[ChatChunk]):
        """Called when LLM response is done, processes tool calls for UI actions (from File 1)."""
        logger.info(f"RoxAgent on_llm_response_done: Received {len(chunks)} chunks.")
        if not self._room:
            logger.error("on_llm_response_done: No room, cannot send UI actions.")
            return

        client_participant_identity = None
        if self._room.remote_participants:
            client_participant_identity = next(iter(self._room.remote_participants.values())).identity
        
        if not client_participant_identity and self._room.participants:
             for p_info in self._room.participants.values():
                if self._room.local_participant and p_info.identity != self._room.local_participant.identity:
                    client_participant_identity = p_info.identity
                    break
        
        if not client_participant_identity:
            logger.warning("on_llm_response_done: Could not determine client participant.")
            return
        
        logger.info(f"Targeting client '{client_participant_identity}' for UI actions from LLM.")
        processed_actions_count = 0
        for chunk in chunks:
            if hasattr(chunk, 'delta') and hasattr(chunk.delta, 'tool_calls') and chunk.delta.tool_calls:
                for tool_call in chunk.delta.tool_calls:
                    if hasattr(tool_call, 'name') and tool_call.name == '_internal_dom_actions':
                        try:

                            actions = json.loads(tool_call.arguments)
                            if not isinstance(actions, list): continue
                            for action_item in actions:
                                action_name_str = action_item.get('action')
                                payload = action_item.get('payload', {})
                                target_id = payload.get('targetElementId', payload.get('target_element_id'))
                                params = payload.get('parameters', {})
                                action_type_enum = getattr(interaction_pb2.ClientUIActionType, action_name_str, None)


                                if action_type_enum is not None:
                                    # This part needs to be adapted based on how trigger_client_ui_action
                                    # expects its specific payload data (e.g., highlight_ranges_payload_data)
                                    # For simplicity, this example assumes params are sufficient or
                                    # trigger_client_ui_action can derive specific payloads from generic params if needed.
                                    await trigger_client_ui_action(
                                        room=self._room,
                                        client_identity=client_participant_identity,
                                        action_type=action_type_enum,
                                        target_element_id=target_id,
                                        parameters=params 
                                        # Add specific payload data here if action_item contains it
                                        # e.g., highlight_ranges_payload_data=payload.get("highlight_data")
                                    )
                                    processed_actions_count += 1
                                else:
                                    logger.warning(f"Unknown action name '{action_name_str}' from LLM.")
                        except Exception as e:
                            logger.error(f"Error processing LLM tool_call action: {e}", exc_info=True)
        logger.info(f"Processed {processed_actions_count} UI actions from LLM tool_calls.")


async def trigger_client_ui_action(
    room: rtc.Room,
    client_identity: str,

    action_type: interaction_pb2.ClientUIActionType,
    target_element_id: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    # Specific payload data arguments from File 1
    highlight_ranges_payload_data: Optional[list] = None,
    strikethrough_ranges_data: Optional[list] = None,
    suggest_text_edit_payload_data: Optional[Dict[str, Any]] = None,
    show_inline_suggestion_payload_data: Optional[Dict[str, Any]] = None,
    show_tooltip_or_comment_payload_data: Optional[Dict[str, Any]] = None,
    set_editor_content_payload_data: Optional[Dict[str, Any]] = None,
    append_text_to_editor_realtime_payload_data: Optional[Dict[str, Any]] = None
    ) -> Optional[interaction_pb2.ClientUIActionResponse]:
    """
    Sends an RPC to a specific client to perform a UI action.
    Merged to handle all action types from both files.
    """
    target_participant = room.remote_participants.get(client_identity) # More direct lookup
    if not target_participant and room.local_participant and room.local_participant.identity == client_identity:
        target_participant = room.local_participant # Allow sending to self for testing

    if not target_participant:
        logger.error(f"B2F RPC: Client '{client_identity}' not found. Cannot send UI action.")
        return None

    request_pb = interaction_pb2.AgentToClientUIActionRequest()
    request_pb.request_id = f"ui-{str(uuid.uuid4())[:8]}"
    request_pb.action_type = action_type
    if target_element_id:
        request_pb.target_element_id = target_element_id

    # Convert generic parameters to string map
    # This map will be used for actions that don't have specific typed payloads
    # or for additional data alongside typed payloads.
    if parameters:
        for key, value in parameters.items():
            if value is not None: # Ensure key exists before assignment
                 request_pb.parameters[key] = str(value).lower() if isinstance(value, bool) else str(value)


    # Populate specific typed payloads (from File 1's trigger_client_ui_action)
    if action_type == interaction_pb2.ClientUIActionType.HIGHLIGHT_TEXT_RANGES and highlight_ranges_payload_data:
        for hl_data in highlight_ranges_payload_data:
            request_pb.highlight_ranges_payload.add(**hl_data)
    elif action_type == interaction_pb2.ClientUIActionType.STRIKETHROUGH_TEXT_RANGES and strikethrough_ranges_data:
        for st_data in strikethrough_ranges_data:
            request_pb.strikethrough_ranges_payload.add(**st_data)
    elif action_type == interaction_pb2.ClientUIActionType.SUGGEST_TEXT_EDIT and suggest_text_edit_payload_data:
        request_pb.suggest_text_edit_payload.CopyFrom(interaction_pb2.SuggestTextEditPayloadProto(**suggest_text_edit_payload_data))
    elif action_type == interaction_pb2.ClientUIActionType.SHOW_INLINE_SUGGESTION and show_inline_suggestion_payload_data:
        request_pb.show_inline_suggestion_payload.CopyFrom(interaction_pb2.ShowInlineSuggestionPayloadProto(**show_inline_suggestion_payload_data))
    elif action_type == interaction_pb2.ClientUIActionType.SHOW_TOOLTIP_OR_COMMENT and show_tooltip_or_comment_payload_data:
        request_pb.show_tooltip_or_comment_payload.CopyFrom(interaction_pb2.ShowTooltipOrCommentPayloadProto(**show_tooltip_or_comment_payload_data))
    elif action_type == interaction_pb2.ClientUIActionType.SET_EDITOR_CONTENT and set_editor_content_payload_data:
        request_pb.set_editor_content_payload.CopyFrom(interaction_pb2.SetEditorContentPayloadProto(**set_editor_content_payload_data))
    elif action_type == interaction_pb2.ClientUIActionType.APPEND_TEXT_TO_EDITOR_REALTIME and append_text_to_editor_realtime_payload_data:
        request_pb.append_text_to_editor_realtime_payload.CopyFrom(interaction_pb2.AppendTextToEditorRealtimePayloadProto(**append_text_to_editor_realtime_payload_data))
    
    # For actions from File 2 that primarily use the generic `parameters` map,
    # the `parameters` field in `request_pb` (if it's a map) is already populated above.
    # No specific `elif` blocks are needed here if the proto uses a generic map,
    # unless an action needs special construction beyond just filling the map.
    # Example: START_TIMER from File 2 might have default "timer_type" if not provided.
    # This logic can be handled when preparing the `parameters` dict before calling this function,
    # or by adding specific `elif` blocks here if complex default logic is needed.
    # For now, assuming `parameters` dict is prepared correctly by the caller.

    else:
        # This handles actions that don't have specific typed payloads listed above
        # and rely solely on the generic `parameters` map.
        # Also, if a typed action was called without its specific payload_data,
        # it would fall through here and send only generic params if provided.
        if not (highlight_ranges_payload_data or strikethrough_ranges_data or \
                suggest_text_edit_payload_data or show_inline_suggestion_payload_data or \
                show_tooltip_or_comment_payload_data or set_editor_content_payload_data or \
                append_text_to_editor_realtime_payload_data) and parameters:
            logger.debug(f"Action '{interaction_pb2.ClientUIActionType.Name(action_type)}' using generic parameters: {request_pb.parameters}")
        elif not parameters and not (highlight_ranges_payload_data or strikethrough_ranges_data or \
                suggest_text_edit_payload_data or show_inline_suggestion_payload_data or \
                show_tooltip_or_comment_payload_data or set_editor_content_payload_data or \
                append_text_to_editor_realtime_payload_data):
             logger.debug(f"Action '{interaction_pb2.ClientUIActionType.Name(action_type)}' called with no specific payload data and no generic parameters.")


    service_name = "rox.interaction.ClientSideUI" 
    method_name = "PerformUIAction"
    rpc_method_name = f"{service_name}/{method_name}"

    try:
        payload_bytes = request_pb.SerializeToString()
        base64_encoded_payload = base64.b64encode(payload_bytes).decode('utf-8')
        
        logger.info(f"B2F RPC: Sending '{rpc_method_name}' to '{client_identity}'. Action: {interaction_pb2.ClientUIActionType.Name(action_type)}, ReqID: {request_pb.request_id}")
        
        response_payload_str = await room.local_participant.perform_rpc(
            destination_identity=client_identity,
            method=rpc_method_name,
            payload=base64_encoded_payload
        )
        response_bytes = base64.b64decode(response_payload_str)
        response_pb = interaction_pb2.ClientUIActionResponse()
        response_pb.ParseFromString(response_bytes) # Completed this line

        logger.info(f"B2F RPC: Response from client '{client_identity}' for UI action '{request_pb.request_id}': Success={response_pb.success}, Msg='{response_pb.message}'")
        return response_pb
    except Exception as e:
        logger.error(f"B2F RPC: Error sending '{rpc_method_name}' to '{client_identity}' or processing response: {e}", exc_info=True)
        return None

async def agent_main_logic(agent_or_ctx):
    """
    Contains agent logic to proactively send UI commands to the client for testing.
    This is a merged version including tests from both original files.
    
    Parameters:
    agent_or_ctx: Either a RoxAgent instance or a JobContext object
    """
    logger.info("B2F Agent Logic: Started.")
    await asyncio.sleep(5) # Wait for client connection and RPC registration
    logger.info("B2F Agent Logic: Initial 5-second sleep completed.")

    # Determine if we have a JobContext or RoxAgent
    if isinstance(agent_or_ctx, RoxAgent):
        agent_instance = agent_or_ctx
        room = agent_instance._room
    else:  # Assume it's a JobContext
        ctx = agent_or_ctx
        if not hasattr(ctx, 'room') or not ctx.room:
            logger.error("B2F Agent Logic: ctx.room is not available. Cannot proceed.")
            return
        room = ctx.room
        # Try to get agent instance from context if available
        agent_instance = getattr(ctx, 'agent', None)
        if not isinstance(agent_instance, RoxAgent):
            logger.error("B2F Agent Logic: Agent instance not available from ctx.agent or is not a RoxAgent.")
            return
    
    # Ensure we have both agent and room
    if not room:
        logger.error("B2F Agent Logic: Room reference not available. Cannot proceed.")
        return
    
    # Ensure the agent's internal _room reference is set
    if not agent_instance._room:
        agent_instance._room = room
        logger.info(f"B2F Agent Logic: Manually set agent_instance._room to room {room.name}")

    logger.info(f"B2F Agent Logic: Room '{room.name}' is available.")

    target_client_identity = None
    # Find a client (prefer 'TestUser', then first non-agent remote participant)
    logger.info("B2F Agent Logic: Attempting to find target client...")
    
    remote_participants_map = room.remote_participants
    logger.info(f"B2F Agent Logic: Remote participants: {[p.identity for p in remote_participants_map.values()]}")

    # Get agent identity (for exclusion)
    agent_identity = None
    if room and room.local_participant:
        agent_identity = room.local_participant.identity
        logger.info(f"B2F Agent Logic: Agent identity is '{agent_identity}'")

    if "TestUser" in remote_participants_map:
        target_client_identity = remote_participants_map["TestUser"].identity
        logger.info(f"B2F Agent Logic: Found target client 'TestUser'.")
    else:
        for p_info in remote_participants_map.values():
            if agent_identity and p_info.identity != agent_identity: # Exclude self (agent)
                target_client_identity = p_info.identity
                logger.info(f"B2F Agent Logic: Found fallback target client: '{target_client_identity}' (SID: {p_info.sid}).")
                break # Take the first one found
    
    if not target_client_identity:
        logger.warning("B2F Agent Logic: No suitable client 'TestUser' (or fallback) found to send UI actions to.")
        return
    
    logger.info(f"B2F Agent Logic: Proceeding to send UI actions to client: '{target_client_identity}'")

    try:
        # ==========================================
        # ROX_COPY PAGE ACTIONS (from File 2)
        # ==========================================
        
        logger.info(f"B2F Test: SHOW_ALERT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_ALERT,
            parameters={"message": "Agent says hello via MERGED B2F RPC!"}
        )
        await asyncio.sleep(2)

        logger.info(f"B2F Test: UPDATE_TEXT_CONTENT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_TEXT_CONTENT,
            target_element_id="agentUpdatableTextRoxPage",
            parameters={"text": f"Agent updated this text at {asyncio.get_event_loop().time():.0f}"}
        )
        await asyncio.sleep(2)

        logger.info(f"B2F Test: START_TIMER to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.START_TIMER,
            target_element_id="speakingTaskTimer",
            parameters={"duration_seconds": 30, "timer_type": "prep"}
        )
        await asyncio.sleep(1)
        
        logger.info(f"B2F Test: PAUSE_TIMER (true) to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.PAUSE_TIMER,
            target_element_id="speakingTaskTimer", parameters={"pause": "true"}
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: PAUSE_TIMER (false) to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.PAUSE_TIMER,
            target_element_id="speakingTaskTimer", parameters={"pause": "false"}
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: UPDATE_PROGRESS_INDICATOR to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_PROGRESS_INDICATOR,
            target_element_id="drillProgressIndicator",
            parameters={"current_step": 3, "total_steps": 10, "message": "Processing speaking task..."}
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: SHOW_ELEMENT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_ELEMENT,
            target_element_id="roxLoadingIndicator", parameters={"show": "true"}
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: HIDE_ELEMENT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.HIDE_ELEMENT,
            target_element_id="roxLoadingIndicator", parameters={"show": "false"} # Assuming "show": "false" is how hide works
        )
        await asyncio.sleep(1)
        
        # ==========================================
        # NAVIGATE TO WRITINGPRACTICE PAGE (from File 2)
        # ==========================================
        logger.info(f"B2F Test: NAVIGATE_TO_PAGE (writingpractice) to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.NAVIGATE_TO_PAGE,
            parameters={
                "page_name": "writingpractice",
                "data_for_page": json.dumps({ # Ensure data_for_page is a JSON string
                    "user_id": "test123", "essay_id": "writing_sample_01",
                    "mode": "feedback", "show_tutorial": False
                })
            }
        )
        await asyncio.sleep(3) # Allow time for navigation

        # ==========================================
        # WRITINGPRACTICE PAGE ACTIONS (from File 2)
        # ==========================================
        logger.info(f"B2F Test: UPDATE_LIVE_TRANSCRIPT (chunked) to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_LIVE_TRANSCRIPT,
            target_element_id="liveTranscriptArea",
            parameters={"new_chunk": "This is the first part ", "is_final_for_sentence": "false"}
        )
        await asyncio.sleep(0.5)
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.UPDATE_LIVE_TRANSCRIPT,
            target_element_id="liveTranscriptArea",
            parameters={"new_chunk": "of a live transcript.", "is_final_for_sentence": "true"}
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: DISPLAY_TRANSCRIPT_OR_TEXT to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.DISPLAY_TRANSCRIPT_OR_TEXT,
            target_element_id="feedbackContent",
            parameters={"text_content": "Essay feedback: Good structure, needs grammar work."}
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: DISPLAY_REMARKS_LIST to '{target_client_identity}'.")
        remarks_data = [
            {"id": "R1", "title": "Grammar", "details": "Subject-verb agreement.", "correction_suggestion": "Match verb to subject."},
            {"id": "R2", "title": "Vocab", "details": "Limited range.", "correction_suggestion": "Use more academic terms."}
        ]
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.DISPLAY_REMARKS_LIST,
            target_element_id="feedbackRemarks",
            parameters={"remarks": json.dumps(remarks_data)} # Ensure remarks is a JSON string
        )
        await asyncio.sleep(1)

        # ==========================================
        # ACTIONS WITH DEDICATED PAYLOADS (from File 1)
        # ==========================================
        logger.info(f"B2F Test: HIGHLIGHT_TEXT_RANGES to '{target_client_identity}'.")
        sample_highlights = [{"id": "hl1", "start": 0, "end": 5, "type": "test_hl", "message": "Test highlight"}]
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.HIGHLIGHT_TEXT_RANGES,
            target_element_id="liveWritingEditor", # Example target
            highlight_ranges_payload_data=sample_highlights
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: STRIKETHROUGH_TEXT_RANGES to '{target_client_identity}'.")
        sample_strikethroughs = [{"id": "st1", "start": 6, "end": 10, "type": "test_st", "message": "Test strikethrough"}]
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.STRIKETHROUGH_TEXT_RANGES,
            target_element_id="liveWritingEditor",
            strikethrough_ranges_data=sample_strikethroughs
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: SUGGEST_TEXT_EDIT to '{target_client_identity}'.")
        sample_text_edit = {"suggestion_id": "edit1", "start_pos": 11, "end_pos": 15, "original_text": "olld", "new_text": "new"}
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SUGGEST_TEXT_EDIT,
            target_element_id="liveWritingEditor",
            suggest_text_edit_payload_data=sample_text_edit
        )
        await asyncio.sleep(1)

        # ==========================================
        # MORE ACTIONS (from File 2, using generic parameters)
        # ==========================================
        logger.info(f"B2F Test: SET_BUTTON_PROPERTIES to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SET_BUTTON_PROPERTIES,
            target_element_id="submitAnswerButton",
            parameters={"label": "Submit Essay Now", "disabled": "false", "style_class": "primary-button"}
        )
        await asyncio.sleep(1)
        
        logger.info(f"B2F Test: ENABLE_BUTTON to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.ENABLE_BUTTON,
            target_element_id="startRecordingButton"
        )
        await asyncio.sleep(1)

        logger.info(f"B2F Test: SHOW_LOADING_INDICATOR (true) to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_LOADING_INDICATOR,
            target_element_id="globalLoadingIndicator",
            parameters={"is_loading": "true", "message": "Processing..."}
        )
        await asyncio.sleep(2)
        logger.info(f"B2F Test: SHOW_LOADING_INDICATOR (false) to '{target_client_identity}'.")
        await trigger_client_ui_action(
            room=room, client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_LOADING_INDICATOR,
            target_element_id="globalLoadingIndicator",
            parameters={"is_loading": "false"}
        )

        logger.info("B2F Agent Logic: All test UI actions sent.")

        # Keep the agent alive to handle RPC calls
        logger.info("RoxAgent: Entering main loop to keep agent alive for RPCs...")
        while True:
            await asyncio.sleep(3600) # Sleep for a long time, effectively forever
            
    except Exception as e:
        logger.error(f"B2F Agent Logic: Error in agent_main_logic: {e}", exc_info=True)


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the agent job."""
    global GLOBAL_PAGE_PATH, GLOBAL_MODEL, GLOBAL_TEMPERATURE, GLOBAL_AVATAR_ENABLED

    if GLOBAL_AVATAR_ENABLED:
        ctx.identity = "rox-tavus-avatar-agent"
    else:
        ctx.identity = "rox-custom-llm-agent"
    logger.info(f"Agent identity set to: {ctx.identity}")

    try:
        await ctx.connect()
        logger.info(f"Successfully connected to LiveKit room '{ctx.room.name}' as '{ctx.identity}'")
    except Exception as e:
        logger.error(f"Failed to connect to LiveKit room: {e}", exc_info=True)
        return
    
    logger.info(f"Runtime Config -- Page: {GLOBAL_PAGE_PATH}, TTS: {GLOBAL_MODEL}, Temp: {GLOBAL_TEMPERATURE}, Avatar: {GLOBAL_AVATAR_ENABLED}")
    
    rox_agent_instance = RoxAgent(page_path=GLOBAL_PAGE_PATH)
    rox_agent_instance._room = ctx.room # Explicitly set agent's room reference

    avatar_session = None
    if GLOBAL_AVATAR_ENABLED and tavus_module:
        logger.info("Setting up Tavus avatar session...")
        os.environ["TAVUS_API_KEY"] = TAVUS_API_KEY
        try:
            avatar_session = tavus_module.AvatarSession(
                replica_id=TAVUS_REPLICA_ID,
                persona_id=TAVUS_PERSONA_ID if TAVUS_PERSONA_ID else None
            )
            logger.info("Tavus avatar session object created.")
        except Exception as e:
            logger.error(f"Failed to create Tavus AvatarSession: {e}", exc_info=True)
            GLOBAL_AVATAR_ENABLED = False
            avatar_session = None

    try:
        custom_llm_bridge = CustomLLMBridge(rox_agent_ref=rox_agent_instance)
        logger.info("Creating main agent session with VPA pipeline...")

        main_agent_session = agents.AgentSession( # Renamed for clarity
            stt=deepgram.STT(model="nova-2", language="multi"), # nova-2 or nova-3
            llm=custom_llm_bridge, # Pass agent instance
            tts=deepgram.TTS(model=GLOBAL_MODEL),
            vad=silero.VAD.load(),
            turn_detection=MultilingualModel(),
        )
        logger.info("Main agent session created successfully.")

        if avatar_session:
            logger.info("Starting Tavus avatar session...")
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
                audio_enabled=not bool(avatar_session),
            ),
        )
        logger.info("Main agent session started successfully.")


        # Populate participant_data with metadata
        if rox_agent_instance._room:
            logger.info(f"PARTICIPANT_METADATA: Processing local and remote participants. Room SID: {rox_agent_instance._room.sid}, Name: {rox_agent_instance._room.name}")
            
            all_participants_to_process = []
            
            # Process local participant
            local_p = rox_agent_instance._room.local_participant
            if local_p:
                logger.info(f"  PARTICIPANT_METADATA: Adding local_participant: Identity: {local_p.identity}, SID: {local_p.sid}")
                all_participants_to_process.append(local_p)
            else:
                logger.info("  PARTICIPANT_METADATA: No local_participant found on room object.")

            # Process remote participants
            if hasattr(rox_agent_instance._room, 'remote_participants') and rox_agent_instance._room.remote_participants:
                logger.info(f"  PARTICIPANT_METADATA: Found {len(rox_agent_instance._room.remote_participants)} remote_participants. Adding them.")
                all_participants_to_process.extend(rox_agent_instance._room.remote_participants.values())
            else:
                logger.info("  PARTICIPANT_METADATA: No remote_participants found or attribute missing.")

            if not all_participants_to_process:
                logger.info("PARTICIPANT_METADATA: No participants (local or remote) found in the room to process metadata for.")
            else:
                logger.info(f"PARTICIPANT_METADATA: Total participants to process: {len(all_participants_to_process)}")
                for p_obj in all_participants_to_process:
                    logger.info(f"    PARTICIPANT_METADATA: Processing participant Identity: {p_obj.identity}, SID: {p_obj.sid}")
                    if p_obj.metadata:
                        try:
                            logger.info(f"      PARTICIPANT_METADATA: Raw p_obj.metadata for {p_obj.identity}: {p_obj.metadata}")
                            metadata_dict = json.loads(p_obj.metadata)
                            logger.info(f"      PARTICIPANT_METADATA: Parsed metadata_dict for {p_obj.identity}: {metadata_dict}")
                            user_token = metadata_dict.get('userToken')
                            user_id_from_meta = metadata_dict.get('userId') # Key from tokenController.js
                            custom_llm_bridge.add_user_token(user_token,user_id_from_meta)
                            if user_token:
                                logger.info(f"      PARTICIPANT_METADATA: Found userToken for {p_obj.identity}: {user_token[:20]}...")
                            if user_id_from_meta:
                                logger.info(f"      PARTICIPANT_METADATA: Found user_id in metadata for {p_obj.identity}: {user_id_from_meta}")
                            
                            rox_agent_instance.participant_data[p_obj.identity] = {
                                'userToken': user_token,
                                'userId': user_id_from_meta,
                                'sid': p_obj.sid
                            }
                            logger.info(f"      PARTICIPANT_METADATA: Stored data for participant {p_obj.identity} (SID: {p_obj.sid})")

                        except json.JSONDecodeError:
                            logger.error(f"      PARTICIPANT_METADATA: Could not parse metadata for participant {p_obj.identity} (SID: {p_obj.sid}): {p_obj.metadata}")
                        except Exception as e_meta:
                            logger.error(f"      PARTICIPANT_METADATA: Error processing metadata for participant {p_obj.identity} (SID: {p_obj.sid}): {e_meta}")
                    else:
                        logger.info(f"      PARTICIPANT_METADATA: No metadata found for participant {p_obj.identity} (SID: {p_obj.sid})")
        else:
            logger.info("PARTICIPANT_METADATA: rox_agent_instance._room is None. Cannot process participants.")

        # Instantiate the RPC service, passing the agent instance

        agent_rpc_service = AgentInteractionService(agent_instance=rox_agent_instance)
        try:
            if ctx.room and ctx.room.local_participant:
                ctx.room.local_participant.register_rpc_method(
                    "rox.interaction.AgentInteraction/HandleFrontendButton",
                    agent_rpc_service.HandleFrontendButton
                )
                logger.info("Successfully registered RPC handler for HandleFrontendButton.")
                rox_agent_instance._interaction_service_registered = True
            else:
                logger.error("Cannot register RPC handler: room or local_participant not available.")
        except Exception as e_rpc_reg:
            logger.error(f"Failed to register RPC handler: {e_rpc_reg}", exc_info=True)
        
        logger.info(f"Rox agent fully operational in room '{ctx.room.name}'.")

        # Start B2F agent logic for testing UI actions
        asyncio.create_task(agent_main_logic(rox_agent_instance))
        logger.info("B2F Agent Logic Task for UI testing created.")
        
        await asyncio.Event().wait() # Keep agent alive
    except Exception as e:
        logger.error(f"Critical error during agent session: {e}", exc_info=True)
    finally:
        logger.info(f"Agent job for room '{ctx.room.name if ctx.room else 'Unknown'}' ending.")
        if avatar_session: 
            try: await avatar_session.aclose(); logger.info("Tavus avatar session closed.")
            except Exception as e_ac: logger.error(f"Error closing Tavus: {e_ac}")
        
        if 'main_agent_session' in locals() and main_agent_session and hasattr(main_agent_session, 'aclose'):
             try: await main_agent_session.aclose(); logger.info("Main agent session closed.")
             except Exception as e_msc: logger.error(f"Error closing main session: {e_msc}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rox LiveKit AI Agent", add_help=False)
    
    parser.add_argument('--page-path', type=str, default=GLOBAL_PAGE_PATH, help=f'Path to web page (default: {GLOBAL_PAGE_PATH})')
    parser.add_argument('--tts-model', type=str, default=GLOBAL_MODEL, help=f'Deepgram TTS model (default: {GLOBAL_MODEL})')
    parser.add_argument('--temperature', type=float, default=GLOBAL_TEMPERATURE, help=f'LLM temperature (default: {GLOBAL_TEMPERATURE})')
    parser.add_argument('--avatar-enabled', type=lambda x: (str(x).lower() == 'true'), nargs='?', const=True, default=None,
                        help='Enable Tavus avatar. Overrides .env if provided.')

    args, unknown_args = parser.parse_known_args()
    
    GLOBAL_PAGE_PATH = args.page_path
    GLOBAL_MODEL = args.tts_model
    GLOBAL_TEMPERATURE = args.temperature
    if args.avatar_enabled is not None:
        GLOBAL_AVATAR_ENABLED = args.avatar_enabled
        if GLOBAL_AVATAR_ENABLED and not TAVUS_ENABLED:
            logger.warning("CLI requested Tavus avatar, but .env configuration is missing/incomplete. Avatar will remain disabled.")
            GLOBAL_AVATAR_ENABLED = False
        elif not GLOBAL_AVATAR_ENABLED and tavus_module is None:
             logger.warning("CLI requested Tavus avatar, but Tavus plugin could not be imported. Avatar will remain disabled.")
             GLOBAL_AVATAR_ENABLED = False


    # Reconstruct sys.argv for LiveKit's CLI parser
    # This ensures LiveKit's own arguments are processed correctly
    # The first element of sys.argv is the script name, followed by unknown_args
    sys.argv = [sys.argv[0]] + unknown_args 

    # Run the agent using LiveKit's CLI runner
    # This handles LiveKit-specific arguments like --url, --api-key, etc.
    agents.cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))