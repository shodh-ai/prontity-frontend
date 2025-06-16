# LiveKit Voice AI Project

This repository contains a full-stack, real-time voice AI agent system built with LiveKit, Deepgram, OpenAI, and custom backend services.

## Overview
- **Voice agent**: Real-time voice-to-voice conversation with advanced echo cancellation, powered by LiveKit and Deepgram.
- **Modular architecture**: Easily extendable for additional AI services or custom integrations.

## Project Structure

```
project-root/
├── livekit-agent-server/
│   ├── vpa_new/                # Main agent code, custom LLM bridge, backend integration
│   ├── requirements.txt        # Python dependencies for agent and backend
│   ├── README.md               # Detailed agent/backend setup & usage
│   └── ...
├── webrtc-token-service/       # (If present) Service for generating WebRTC tokens
├── ...                        # Other project components
├── README.md                   # (This file)
```

## Quick Start
1. **Clone the repository**
2. **See [`livekit-agent-server/README.md`](livekit-agent-server/README.md) for full installation and usage instructions.**
3. To use the WebRTC token service, run `npm install` inside the `webrtc-token-service` directory:
   ```sh
   cd webrtc-token-service
   npm install
   npm run dev
   ```
4. To start frontend run `npm install` inside the `frontend` directory:
   ```sh
   npm install
   npm run dev
   ```

## Key Features
- Advanced echo cancellation and audio pipeline
- Real-time speech-to-speech with Gemini/Deepgram/LiveKit
- Extensible backend agent (Flask/OpenAI)
- Robust error handling and logging
- Environment variable-based configuration

## Security & Configuration
- All secrets and API keys must be placed in `.env` files (never commit secrets)