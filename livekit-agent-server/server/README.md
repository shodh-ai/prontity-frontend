# LiveKit Agent Server

This is a backend server for the LiveKit Agent implementation, enabling voice and text AI capabilities in your video conferencing application.

## Setup Instructions

### 1. Create a Virtual Environment

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file with your API keys
# You need at least:
# - LiveKit credentials (which you already have)
# - OpenAI API key
```

### 4. Run the Server

```bash
python main.py
```

The server will run on http://localhost:8080

## API Endpoints

- `GET /` - Check if the server is running
- `POST /connect-agent` - Connect an agent to a LiveKit room
- `GET /status/{room_name}` - Get the status of an agent in a room
- `POST /disconnect-agent/{room_name}` - Disconnect an agent from a room

## Update Your Frontend

Once the backend server is running, update your frontend VoiceAgent component to call these endpoints:

1. Update the `connectAgent` function in your `VoiceAgent.tsx` file to call `/connect-agent` instead of `/api/agent`
2. Add status polling to check if the agent is connected
3. Add a disconnect button to remove the agent when needed

## Required API Keys

- **OpenAI API Key** - Required for LLM capabilities and default TTS/STT
- **Deepgram API Key** (optional) - For improved Speech-to-Text
- **ElevenLabs API Key** (optional) - For higher quality Text-to-Speech
