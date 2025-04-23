# LiveKit TOEFL Speaking Practice Agent

This project combines LiveKit's real-time communication platform with AI to create an interactive TOEFL speaking practice assistant. The application connects a user to a virtual AI agent that can help practice TOEFL speaking tasks with real-time feedback.

## Project Structure

- **`src/`**: Next.js frontend application
  - **`app/`**: Next.js app router pages
  - **`components/`**: React components including AgentController
  - **`api/`**: API routes for token generation and agent management

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
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
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

## Agent Implementation

The project offers two approaches for the AI agent:

1. **Simple Room Server**: A lightweight HTTP server for room management and token generation
2. **AI Agent**: Uses Google's realtime model for natural voice conversations

## License

MIT
