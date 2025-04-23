import os
import sys
import json
import logging
import asyncio
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import plugins that are actually installed
try:
    from livekit.plugins import noise_cancellation
    from livekit.plugins import google  # For Google's realtime model
    # Optional imports - will be skipped if not available
    try:
        from livekit.plugins.turn_detector.multilingual import MultilingualModel
    except ImportError:
        logger.warning("MultilingualModel not available, will not use turn detection")
        MultilingualModel = None
except ImportError as e:
    logger.error(f"Failed to import required packages: {e}")
    logger.error("Please install the missing packages")
    sys.exit(1)

load_dotenv()


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="""
you are a english teacher that will help with pronunciation and grammar.
""")


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    
    # We'll store this to use after session is created
    received_review_text = ""
    
    # Define a synchronous wrapper for the data handler
    def on_data_received_sync(payload, participant=None, kind=None):
        # Use a regular function (not async) for the event listener
        try:
            nonlocal received_review_text
            try:
                # Try to decode as plain text
                text = payload.decode('utf-8')
                print(f"Received data payload of {len(text)} bytes")
                
                # Try to parse as JSON if it's structured that way
                try:
                    import json
                    data = json.loads(text)
                    if isinstance(data, dict) and 'content' in data:
                        text = data['content']
                        print(f"Extracted content from JSON payload: {text[:100]}...")
                except json.JSONDecodeError:
                    # Not JSON, just use the raw text
                    print(f"Using raw text payload: {text[:100]}...")
                    
                received_review_text = text
                print(f"Successfully stored review text of length: {len(received_review_text)}")
                
                # Create a task for async work
                if session:
                    print("Session available, sending text to agent...")
                    
                    # Define an async function to be called as a task
                    async def process_text():
                        try:
                            await session.send_text(f"I've received your presentation to review with {len(text)} characters. Here's my feedback: {text}")
                            print("Successfully sent review to agent session")
                        except Exception as e:
                            print(f"Error in async handler: {e}")
                    
                    # This properly handles async code from a sync callback
                    import asyncio
                    asyncio.create_task(process_text())
                    print("Created async task for processing the review")
                else:
                    print("Session not available yet, storing for later use")
            except UnicodeDecodeError:
                print("Received binary data that couldn't be decoded as UTF-8")
        except Exception as e:
            print(f"Error processing data message: {str(e)}")
    
    # Register the synchronous event handler
    ctx.room.on('DataReceived', on_data_received_sync)
    
    # Initialize session as None first
    session = None
    
    # Create agent session using Google's realtime model
    try:
        model = google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice="Puck",
            temperature=0.8,
            instructions="You are a helpful assistant for TOEFL speaking practice.",
            api_key=os.environ.get('GOOGLE_API_KEY'),
        )
        
        session = AgentSession(llm=model)
        logger.info("Created agent session with Google's realtime model")
    except Exception as e:
        logger.error(f"Failed to create Google realtime model: {e}")
        # Fallback to original session with commented code
        logger.warning("Agent session creation failed")
    
    # Start the agent session in the specified room
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )
    
    # Send an initial greeting
    await session.generate_reply(
        instructions="hi."
    )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
