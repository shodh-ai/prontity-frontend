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
    highlight_ranges_payload_data: list = None  # New parameter for highlight data
) -> interaction_pb2.ClientUIActionResponse | None:
    """
    Sends an RPC to a specific client to perform a UI action.
    Can now handle highlight_ranges_payload.
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
        logger.info(f"B2F Agent Logic: Test HIGHLIGHT_TEXT_RANGES action sent to {target_client_identity}")

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