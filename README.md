# LiveKit TOEFL Speaking Practice Agent

This project combines LiveKit's real-time communication platform with AI to create an interactive TOEFL speaking practice assistant. The application connects a user to a virtual AI agent that can help practice TOEFL speaking tasks with real-time feedback.

## Project Structure

- **`src/`**: Next.js frontend application
  - **`app/`**: Next.js app router pages
  - **`components/`**: React components including AgentController and LiveKitSession
  - **`config/`**: Configuration files for external services
  - **`api/`**: API routes for agent management

- **`webrtc-token-service/`**: Dedicated microservice for LiveKit token generation
  - **`controllers/`**: Business logic for token generation and verification
  - **`middleware/`**: Authentication and logging middleware
  - **`routes/`**: API route definitions

- **`livekit-agent-server/`**: Python backend for AI agent implementation
  - **`server/`**: Room management service
  - **`full_implementation/`**: AI agent implementation with Google's realtime model
  - **`toefl/`**: Specialized TOEFL speaking practice agent

## Getting Started

### Prerequisites

- Node.js 18+ for the frontend
- Python 3.10+ for the agent implementation
- LiveKit account with API keys and server URL
- Google API key for the realtime model

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```
# LiveKit configuration for API routes
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# WebRTC Token Service configuration
NEXT_PUBLIC_TOKEN_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_TOKEN_SERVICE_API_KEY=your_token_service_api_key
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
```

3. Run the development server:
```bash
npm run dev
```

### Agent Setup

1. Create a Python virtual environment:
```bash
python -m venv main
source main/bin/activate  # On Windows: main\Scripts\activate
```

2. Install agent dependencies:
```bash
pip install livekit-agents livekit-plugins-google python-dotenv
```

3. Configure environment variables in `livekit-agent-server/full_implementation/.env`:
```
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
GOOGLE_API_KEY=your_google_api_key
```

4. Run the agent:
```bash
python main.py connect --room quickstart-room
```

### WebRTC Token Service Setup

1. Install dependencies:
```bash
cd webrtc-token-service
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit the .env file with your LiveKit credentials and service configuration
```

3. Run the token service:
```bash
npm run dev
```

## Architecture Overview

The project uses a microservices architecture with the following components:

1. **Next.js Frontend**: Handles user interface and interaction with LiveKit
2. **WebRTC Token Service**: Dedicated microservice for secure token generation 
3. **AI Agent**: Uses Google's realtime model for natural voice conversations

## License

MIT
