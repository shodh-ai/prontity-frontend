import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables FIRST before any other imports
script_dir = Path(__file__).parent.absolute()
env_path = script_dir / '.env.local'
load_dotenv(dotenv_path=env_path)

# Verify API key is loaded
api_key = os.environ.get('GOOGLE_API_KEY')
if api_key:
    print(f"Google API Key loaded successfully")
else:
    print("WARNING: GOOGLE_API_KEY not found in environment variables")

# Now import the rest
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import google
from livekit.plugins import noise_cancellation


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="You are a helpful voice AI assistant.")


async def entrypoint(ctx: agents.JobContext):
    # Connect to the specific 'quickstart-room' used by the Next.js app
    await ctx.connect(room="quickstart-room", identity="ai-assistant")
    
    # Create the model with explicit API key
    model = google.beta.realtime.RealtimeModel(
        model="gemini-2.0-flash-exp",
        voice="Puck",
        temperature=0.8,
        instructions="You are a helpful assistant for TOEFL speaking practice.",
        api_key=os.environ.get('GOOGLE_API_KEY'),  # Explicitly pass the API key
    )
    
    session = AgentSession(
        llm=model,
    )
    
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    await session.generate_reply(
        instructions="Greet the user, introduce yourself as a TOEFL speaking practice assistant, and ask how you can help them practice today."
    )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
