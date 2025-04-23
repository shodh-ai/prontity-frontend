# Full LiveKit Agent Implementation

This is a complete implementation of a LiveKit Agent with voice AI capabilities using the STT-LLM-TTS pipeline.

## Features

- Speech-to-Text via Deepgram
- Language model via OpenAI
- Text-to-Speech via Cartesia
- Voice Activity Detection (VAD) via Silero
- Background noise cancellation
- Multi-language turn detection

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
# Install the required packages
pip install \
  "livekit-agents[deepgram,openai,cartesia,silero,turn-detector]~=1.0" \
  "livekit-plugins-noise-cancellation~=0.2" \
  "python-dotenv"
```

### 3. Set Up Environment Variables

Create a `.env` file with the following variables:

```
DEEPGRAM_API_KEY=<Your Deepgram API Key>
OPENAI_API_KEY=<Your OpenAI API Key>
CARTESIA_API_KEY=<Your Cartesia API Key>
LIVEKIT_API_KEY=<your API Key>
LIVEKIT_API_SECRET=<your API Secret>
LIVEKIT_URL=<your LiveKit server URL>
```

### 4. Run the Agent

```bash
python main.py --room <room_name>
```

## Connecting to Your Frontend

The frontend is already configured to work with this agent. Once the agent is running, it will automatically connect to the LiveKit room and be ready to interact with users.
