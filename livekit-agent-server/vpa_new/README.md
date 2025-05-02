# LiveKit Voice Processing Agent (VPA)

A complete implementation of a LiveKit Voice Processing Agent using the STT-LLM-TTS pipeline for real-time speech-to-speech conversations.

## Features

- **Speech-to-Text**: Uses Deepgram Nova-3 for high-quality multilingual speech recognition
- **Language Model**: Uses OpenAI's GPT-4o Mini for natural conversational abilities
- **Text-to-Speech**: Uses Cartesia for premium voice synthesis
- **Voice Activity Detection**: Uses Silero VAD for precise speech detection
- **Turn Detection**: Uses multilingual turn detection to enable natural conversation flow
- **Noise Cancellation**: Includes background noise reduction for clear audio

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API Keys

Edit the `.env` file to add your API keys:

```
# LiveKit credentials
LIVEKIT_URL=wss://shodhai-pojmjchi.livekit.cloud
LIVEKIT_API_KEY=APIFPSPx95xubAM
LIVEKIT_API_SECRET=VIbj58g0cqmHvPLadQfAinHCBC72FPdtwtDST0UDLdc

# API keys for VPA pipeline
DEEPGRAM_API_KEY=your_deepgram_api_key
OPENAI_API_KEY=your_openai_api_key
CARTESIA_API_KEY=your_cartesia_api_key
```

### 3. Run the Agent

To connect to a LiveKit room:

```bash
python main.py connect --room Speakingpage --page-path speakingpage
```

## Options

The agent supports several command-line options:

- `--page-path`: Specify the page context (e.g., "speakingpage")
- `--voice`: Override the default voice (default: "Lithium")
- `--temperature`: Set the LLM temperature (default: 0.7)
- `--instructions`: Provide custom instructions for the agent

## Token Service Integration

This implementation automatically integrates with the WebRTC token service at:
`/Users/drsudhanshu/Desktop/please/project-1 copy 2/webrtc-token-service`

## Integration with the Frontend

This VPA seamlessly integrates with the existing LiveKitSession components and provides true real-time speech-to-speech capabilities, complementing the existing image generation functionality.

## Examples

1. Basic connection:
   ```bash
   python main.py connect --room Speakingpage
   ```

2. With custom voice and temperature:
   ```bash
   python main.py connect --room Speakingpage --voice "Quartz" --temperature 0.8
   ```

3. For a specific page context:
   ```bash
   python main.py connect --room Speakingpage --page-path vocabpage
   ```
