#!/usr/bin/env python3
"""
LiveKit Agent Implementation - Google Realtime Model

This script implements a LiveKit agent using Google's realtime model for natural
conversation. This is a standalone script that can be run directly to join a LiveKit room.
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables from multiple possible locations
script_dir = Path(__file__).parent.absolute()
possible_env_paths = [
    script_dir / '.env',               # .env in current directory
    script_dir.parent / '.env',        # .env in parent directory
    script_dir / '.env.local',         # .env.local in current directory
    script_dir.parent / '.env.local',  # .env.local in parent directory
]

# Try to load from each possible location
for env_path in possible_env_paths:
    if env_path.exists():
        logger.info(f"Loading environment from: {env_path}")
        load_dotenv(dotenv_path=env_path)

# Will check for required environment variables after parsing args

# Import LiveKit packages
try:
    from livekit import agents
    from livekit.agents import AgentSession, Agent, RoomInputOptions
    from livekit.plugins import google
    from livekit.plugins import noise_cancellation
except ImportError:
    logger.error("Failed to import LiveKit packages. Please install required packages:")
    logger.error("pip install livekit-agents livekit-plugins-google livekit-plugins-noise-cancellation python-dotenv")
    sys.exit(1)

class AIAssistant(Agent):
    """AI Assistant agent implementation for LiveKit"""
    
    def __init__(self, assistant_type="toefl", custom_instructions=None):
        # Select instructions based on assistant type
        if assistant_type == "toefl":
            instructions = """
            You are a professional TOEFL speaking practice assistant.
            
            Here's how you can help students:
            1. Ask open-ended questions that require detailed responses
            2. Evaluate grammar, vocabulary, and pronunciation
            3. Provide constructive feedback on speaking skills
            4. Offer specific suggestions for improvement
            5. Engage in natural conversation to help students practice
            
            Be patient, encouraging, and helpful while maintaining a professional tone.
            """
        elif assistant_type == "general":
            instructions = """
            You are a helpful voice AI assistant. 
            Respond to questions clearly and concisely.
            Provide useful information and assist with any tasks as needed.
            """
        else:
            # Use custom instructions if provided, or default to general assistant
            instructions = custom_instructions if custom_instructions else """
            You are a helpful voice AI assistant.
            """
            
        super().__init__(instructions=instructions)


def entrypoint(room, identity, assistant_type="toefl", voice="Puck", temperature=0.8, google_api_key=None):
    """Entrypoint function for the agent that will be called by the LiveKit CLI"""
    logger.info(f"Agent entrypoint called for room '{room}' with identity '{identity}'")
    
    # Create the AI assistant with instructions based on type
    agent = AIAssistant(assistant_type=assistant_type, custom_instructions=None)
    
    # Create the Google realtime model with the specified voice and temperature
    try:
        model = google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice=voice,
            temperature=temperature,
            instructions=agent.instructions,  # Use instructions from AIAssistant
            api_key=google_api_key,  # Explicitly pass the API key
        )
        logger.info("Successfully created Google realtime model")
    except Exception as e:
        logger.error(f"Failed to create Google model: {str(e)}")
        return
    
    # Create the agent session
    session = AgentSession(llm=model)
    
    # Configure room input options with noise cancellation
    input_options = RoomInputOptions(
        noise_cancellation=noise_cancellation.BVC(),
    )
    
    # Start the agent session
    session.start_sync(
        room=room,
        agent=agent,
        room_input_options=input_options,
    )
    
    # Send an initial greeting
    greeting = "Hello! I'm your AI assistant for "
    if assistant_type == "toefl":
        greeting += "TOEFL speaking practice. How can I help you prepare for your test today?"
    else:
        greeting += "this conversation. How can I assist you today?"
    
    # Use generate_reply_sync to output the initial greeting.
    # While the parameter is 'instructions', for this model/plugin,
    # providing direct text here results in it being spoken.
    session.generate_reply_sync(instructions=greeting)
    
    logger.info(f"Agent successfully started in room {room}")
    return session


def run_agent_cli(room_name, identity="ai-assistant", assistant_type="toefl", voice="Puck", temperature=0.8):
    """Run the agent using the LiveKit CLI approach"""
    try:
        # Create a WorkerOptions object with our entrypoint function
        worker_options = agents.WorkerOptions(
            entrypoint_fnc=lambda room: entrypoint(
                room,
                identity,
                assistant_type,
                voice,
                temperature,
                google_api_key=os.environ.get('GOOGLE_API_KEY')
            ),
            url=os.environ.get('LIVEKIT_URL'),
            api_key=os.environ.get('LIVEKIT_API_KEY'),
            api_secret=os.environ.get('LIVEKIT_API_SECRET'),
            agent_name=identity,
            room_name=room_name,
        )
        
        # Run the agent using the LiveKit CLI
        logger.info(f"Starting agent '{identity}' in room '{room_name}'")
        agents.cli.run_app(worker_options)
        
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, disconnecting agent...")
    except Exception as e:
        logger.error(f"Error running agent: {str(e)}")
        raise


def main():
    """Main entry point for the script"""
    import argparse
    
    parser = argparse.ArgumentParser(description="LiveKit Agent Service")
    parser.add_argument("--room", required=True, help="Room name to connect to")
    parser.add_argument("--identity", default="ai-assistant", help="Identity for the agent")
    parser.add_argument("--type", default="toefl", choices=["toefl", "general", "custom"], help="Type of assistant")
    parser.add_argument("--voice", default="Puck", help="Voice to use for the assistant")
    parser.add_argument("--temperature", type=float, default=0.8, help="Temperature for the model responses")
    parser.add_argument("--api-key", help="Google API key (overrides environment variable)")
    parser.add_argument("--env-file", help="Path to specific .env file to load")
    parser.add_argument("--livekit-url", help="LiveKit server URL")
    parser.add_argument("--livekit-api-key", help="LiveKit API key")
    parser.add_argument("--livekit-api-secret", help="LiveKit API secret")
    
    args = parser.parse_args()
    
    # Load specific env file if provided
    if args.env_file:
        env_path = Path(args.env_file)
        if env_path.exists():
            logger.info(f"Loading environment from specified file: {env_path}")
            load_dotenv(dotenv_path=env_path)
    
    # Set environment variables from command line arguments if provided
    if args.api_key:
        os.environ['GOOGLE_API_KEY'] = args.api_key
    if args.livekit_url:
        os.environ['LIVEKIT_URL'] = args.livekit_url
    if args.livekit_api_key:
        os.environ['LIVEKIT_API_KEY'] = args.livekit_api_key
    if args.livekit_api_secret:
        os.environ['LIVEKIT_API_SECRET'] = args.livekit_api_secret
    
    # Check for required environment variables
    missing_vars = []
    if not os.environ.get('GOOGLE_API_KEY'):
        missing_vars.append('GOOGLE_API_KEY')
    if not os.environ.get('LIVEKIT_URL'):
        missing_vars.append('LIVEKIT_URL')
    if not os.environ.get('LIVEKIT_API_KEY'):
        missing_vars.append('LIVEKIT_API_KEY')
    if not os.environ.get('LIVEKIT_API_SECRET'):
        missing_vars.append('LIVEKIT_API_SECRET')
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please either:")
        logger.error("  1. Add them to your .env file")
        logger.error("  2. Use command line parameters")
        logger.error("  3. Use --env-file to specify a different env file")
        sys.exit(1)
    
    # Print connection info
    logger.info(f"Connecting to LiveKit server: {os.environ.get('LIVEKIT_URL')}")
    logger.info(f"Using API Key: {os.environ.get('LIVEKIT_API_KEY')[:5]}...")
    
    try:
        # Run the agent using the CLI approach
        run_agent_cli(args.room, args.identity, args.type, args.voice, args.temperature)
    except KeyboardInterrupt:
        logger.info("Program terminated by user")
    except Exception as e:
        logger.error(f"Error running agent: {str(e)}")


if __name__ == "__main__":
    main()
