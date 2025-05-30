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
import json   # For parsing dom_actions from metadata
from typing import Optional, Dict, List, Any, Union
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
from livekit.agents.llm import LLM, ChatContext, ChatRole, ChatMessage, ChatChunk # Import rpc for service registration

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
    """Custom agent implementation for Rox page."""
    
    def __init__(self, page_path="roxpage") -> None:
        super().__init__(instructions="You are Rox, an AI assistant for students using the learning platform. You help students understand their learning status and guide them through their learning journey.")
        self.page_path = page_path
        
        # Initialize context and session variables needed by CustomLLMBridge
        self._latest_student_context = {"user_id": "default_init_user"}
        self._latest_session_id = f"init_session_{uuid.uuid4().hex[:8]}_{int(time.time())}"
        
        # Store reference to the room for direct callbacks
        self._room = None
        
        logger.info(f"RoxAgent instance created for page: {self.page_path}")
        logger.info(f"RoxAgent initialized with default context: {self._latest_student_context}")
        logger.info(f"RoxAgent initialized with session ID: {self._latest_session_id}")
        
    async def on_transcript(self, transcript: str, language: str) -> None:
        """Called when a user transcript is received"""
        logger.info(f"USER SAID (lang: {language}): '{transcript}'")
        
    async def on_reply(self, message: str, audio_url: str = None) -> None:
        """Override to log when assistant replies"""
        logger.info(f"ROX ASSISTANT REPLIED: '{message}'")
        logger.debug(f"Audio URL for reply: {audio_url}") # Log URL at DEBUG
        if not audio_url:
            logger.warning("No audio URL provided for reply - Speech not generated by TTS!")

    async def on_llm_response_done(self, chunks: list[ChatChunk]):
        """Called when the LLM response is fully generated and all chunks are received."""
        logger.info(f"RoxAgent on_llm_response_done: Received {len(chunks)} chunks.")

        if not self._room:
            logger.error("on_llm_response_done: No room available (self._room is None), cannot send UI actions.")
            return

        # Determine target client participant
        client_participant = None
        if self._room.remote_participants: # Check remote_participants first
            for p_info in self._room.remote_participants.values():
                # Assuming the first remote participant is the client. Adjust if needed.
                client_participant = p_info
                break
        
        if not client_participant and self._room.participants: # Fallback to general participants if no remote ones (e.g. local testing)
            for p_info in self._room.participants.values():
                if self._room.local_participant and p_info.identity != self._room.local_participant.identity:
                    client_participant = p_info
                    break

        if not client_participant:
            logger.warning("on_llm_response_done: Could not determine the client participant to send UI actions to.")
            return
        target_participant_identity = client_participant.identity
        logger.info(f"Targeting client '{target_participant_identity}' (SID: {client_participant.sid}) for UI actions from LLM.")

        processed_actions_count = 0
        for chunk_idx, chunk in enumerate(chunks):
            if hasattr(chunk, 'delta') and hasattr(chunk.delta, 'tool_calls') and chunk.delta.tool_calls:
                logger.info(f"Chunk {chunk_idx} has tool_calls: {chunk.delta.tool_calls}")
                for tool_call in chunk.delta.tool_calls:
                    # Ensure tool_call is the expected FunctionToolCall object
                    if hasattr(tool_call, 'name') and tool_call.name == '_internal_dom_actions':
                        logger.info(f"Found '_internal_dom_actions' tool call: ID='{tool_call.call_id}', Args='{tool_call.arguments}'")
                        try:
                            actions_from_backend = json.loads(tool_call.arguments)
                            if not isinstance(actions_from_backend, list):
                                logger.warning(f"_internal_dom_actions arguments is not a list, but {type(actions_from_backend)}. Skipping.")
                                continue

                            for action_item in actions_from_backend:
                                action_name_str = action_item.get('action')
                                action_payload = action_item.get('payload', {})
                                # target_id needs to be extracted carefully from payload
                                target_id = action_payload.get('targetElementId', action_payload.get('target_element_id'))
                                params = action_payload.get('parameters', {})

                                logger.info(f"Processing action from backend: Name='{action_name_str}', Target='{target_id}', Params='{params}'")

                                # Map string action name to ClientUIActionType enum
                                action_type_enum = None
                                if action_name_str == "SHOW_ALERT":
                                    action_type_enum = interaction_pb2.ClientUIActionType.SHOW_ALERT
                                elif action_name_str == "UPDATE_TEXT_CONTENT":
                                    action_type_enum = interaction_pb2.ClientUIActionType.UPDATE_TEXT_CONTENT
                                elif action_name_str == "TOGGLE_VISIBILITY":
                                    action_type_enum = interaction_pb2.ClientUIActionType.TOGGLE_VISIBILITY
                                # Add more mappings as needed based on interaction.proto
                                else:
                                    logger.warning(f"Unknown action name '{action_name_str}' from backend. Skipping.")
                                    continue
                                
                                if action_type_enum is not None:
                                    logger.info(f"Attempting to trigger UI action: Type='{action_type_enum}', Target='{target_id}', Params='{params}'")
                                    await trigger_client_ui_action(
                                        room=self._room,
                                        client_identity=target_participant_identity,
                                        action_type=action_type_enum,
                                        target_element_id=target_id, # Pass target_id here
                                        parameters=params
                                    )
                                    processed_actions_count += 1
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse JSON from _internal_dom_actions arguments: {e}. Arguments: '{tool_call.arguments}'")
                        except Exception as e:
                            # It's good practice to log which action_item caused the error if possible
                            current_action_item_str = str(action_item) if 'action_item' in locals() else "Unknown action item"
                            logger.error(f"Error processing action_item '{current_action_item_str}': {e}", exc_info=True)
                    else:
                        if hasattr(tool_call, 'name'):
                            logger.debug(f"Ignoring tool_call with name '{tool_call.name}'")
                        else:
                            logger.debug(f"Ignoring tool_call without a 'name' attribute: {tool_call}")
            else:
                logger.debug(f"Chunk {chunk_idx} has no tool_calls or delta.tool_calls is empty.")

        if processed_actions_count > 0:
            logger.info(f"Finished processing {processed_actions_count} UI actions from LLM tool_calls.")
        else:
            logger.info("No UI actions processed from LLM tool_calls in this response.")

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
) -> Optional[interaction_pb2.ClientUIActionResponse]:
    """
    Sends an RPC to a specific client to perform a UI action.
    """
    target_participant = None
    # Correctly iterate over remote_participants
    for participant in room.remote_participants.values():
        if participant.identity == client_identity:
            target_participant = participant
            break

    if not target_participant:
        logger.error(f"B2F RPC: Client '{client_identity}' not found in room '{room.name}'. Cannot trigger UI action.")
        return None

    request_id = str(uuid.uuid4())
    proto_params = parameters if parameters is not None else {}

    request_pb = interaction_pb2.AgentToClientUIActionRequest(
        request_id=request_id,
        action_type=action_type,
        target_element_id=target_element_id if target_element_id else "",
        parameters=proto_params
    )

    serialized_request = request_pb.SerializeToString()
    # Serialize the protobuf message to binary
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
    # Iterate directly over remote participants
    remote_participants_map = ctx.room.remote_participants
    logger.info(f"B2F Agent Logic: Found remote participants (identities): {[p.identity for p in remote_participants_map.values()]}")

    for participant_info in remote_participants_map.values(): # Iterate over RemoteParticipant objects
        if participant_info.identity == "TestUser": # Hardcoding for now, match your client's userName
            target_client_identity = participant_info.identity
            logger.info(f"B2F Agent Logic: Found target client 'TestUser'.")
            break
        elif participant_info.identity != ctx.identity: # Fallback to first non-agent participant
            target_client_identity = participant_info.identity
            logger.info(f"B2F Agent Logic: Found potential target client (fallback): '{participant_info.identity}'.")
            # break # Uncomment if you want to take the first non-agent

    if not target_client_identity:
        logger.warning("B2F Agent Logic: No suitable client 'TestUser' (or fallback) found to send UI actions to.")
        return

    logger.info(f"B2F Agent Logic: Proceeding to send UI actions to client: '{target_client_identity}'")

    try:
        logger.info(f"B2F Agent Logic: Attempting Action 1: SHOW_ALERT to '{target_client_identity}'.")
        # Action 1: Show Alert
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.SHOW_ALERT,
            parameters={"message": "Agent says hello via B2F RPC!"}
        )
        logger.info(f"B2F Agent Logic: Successfully sent Action 1: SHOW_ALERT to '{target_client_identity}'.")
        await asyncio.sleep(3)

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
        await asyncio.sleep(3)

        logger.info(f"B2F Agent Logic: Attempting Action 3: TOGGLE_ELEMENT_VISIBILITY to '{target_client_identity}'.")
        # Action 3: Toggle Visibility (will toggle based on client's current state)
        await trigger_client_ui_action(
            room=ctx.room,
            client_identity=target_client_identity,
            action_type=interaction_pb2.ClientUIActionType.TOGGLE_ELEMENT_VISIBILITY,
            target_element_id="agentToggleVisibilityElementRoxPage" # Must match ID
        )
        logger.info(f"B2F Agent Logic: Successfully sent Action 3: TOGGLE_ELEMENT_VISIBILITY to '{target_client_identity}'.")
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
        # Start the agent session and store the room reference in the agent for direct callbacks
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
        
        # Store room reference in agent for direct callbacks (e.g., from CustomLLMBridge)
        rox_agent_instance._room = ctx.room
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