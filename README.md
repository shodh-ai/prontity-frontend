# LiveKit TOEFL Speaking Practice Agent

This project combines LiveKit's real-time communication platform with AI to create an interactive TOEFL speaking practice assistant. The application connects a user to a virtual AI agent that can help practice TOEFL speaking tasks with real-time feedback.

## Overview

The system consists of three main components:

1. **Next.js Frontend** (port 3000): User interface with LiveKit integration
2. **WebRTC Token Service** (port 3002): Dedicated service for generating LiveKit tokens
3. **LiveKit Agent Server**: AI assistant powered by Google's Gemini model

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

## Complete Setup Guide

Follow these steps carefully to set up and run the complete system.

### Prerequisites

- Node.js 18+ for the frontend and token service
- Python 3.10+ for the agent implementation
- LiveKit account with API keys and server URL
- Google API key for the Gemini model
- All component source code in the correct directories

### Step 1: Configure Environment Variables

#### 1.1. Frontend Environment (.env.local)

Create a `.env.local` file in the project root with these variables:

```
# LiveKit Configuration
LIVEKIT_URL=wss://shodhai-pojmjchi.livekit.cloud
LIVEKIT_API_KEY=APIFPSPx95xubAM
LIVEKIT_API_SECRET=VIbj58g0cqmHvPLadQfAinHCBC72FPdtwtDST0UDLdc

# WebRTC Token Service Configuration
NEXT_PUBLIC_TOKEN_SERVICE_URL=http://localhost:3002
NEXT_PUBLIC_TOKEN_SERVICE_API_KEY=your_token_service_api_key
```

#### 1.2. Token Service Environment (.env.local)

Create a `.env.local` file in the `webrtc-token-service` directory:

```
# LiveKit Configuration
LIVEKIT_URL=wss://shodhai-pojmjchi.livekit.cloud
LIVEKIT_API_KEY=APIFPSPx95xubAM
LIVEKIT_API_SECRET=VIbj58g0cqmHvPLadQfAinHCBC72FPdtwtDST0UDLdc

# Server Configuration
PORT=3002
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
```

#### 1.3. Agent Environment (.env)

Create a `.env` file in the `livekit-agent-server/full_implementation` directory:

```
LIVEKIT_URL=wss://shodhai-pojmjchi.livekit.cloud
LIVEKIT_API_KEY=APIFPSPx95xubAM
LIVEKIT_API_SECRET=VIbj58g0cqmHvPLadQfAinHCBC72FPdtwtDST0UDLdc

GOOGLE_API_KEY=AIzaSyBvvp7sahIUJl2JBdz6EYDAaWL-mRJUaUw
```

### Step 2: Install Dependencies

#### 2.1. Frontend Dependencies

```bash
# From the project root directory
npm install
```

#### 2.2. Token Service Dependencies

```bash
cd webrtc-token-service
npm install
```

#### 2.3. Agent Dependencies

```bash
cd livekit-agent-server/full_implementation
pip install python-dotenv livekit-agents livekit-plugins-google
```

### Step 3: Start the Services (In This Order)

#### 3.1. Start the Token Service (Terminal 1)

```bash
cd webrtc-token-service
node index.js
```

Verify it's running with this output: `WebRTC Token Service running on port 3002 [development mode]`

#### 3.2. Start the Next.js Frontend (Terminal 2)

```bash
# From the project root
npm run dev
```

Verify it's running on http://localhost:3000

#### 3.3. Start the AI Agent (Terminal 3)

```bash
cd livekit-agent-server/full_implementation
python3 main.py connect --room Speakingpage --page-path speakingpage
```

You should see output indicating the agent is connected to the LiveKit room.

### Step 4: Test the System

1. Open your browser to http://localhost:3000/speakingpage
2. Allow microphone access when prompted
3. You should see the LiveKit conference interface with the AI agent
4. Verify in the browser console that tokens are being successfully fetched

### Page-Specific Agents

To run agents for different practice pages, use the appropriate page path argument:

```bash
# For speaking practice
python3 main.py connect --room Speakingpage --page-path speakingpage

# For writing practice
python3 main.py connect --room WritingRoom --page-path writingpage

# For vocabulary practice
python3 main.py connect --room VocabRoom --page-path vocabpage
```

Each page type can have specialized instructions for the AI agent.

## Troubleshooting

### Token Service Issues

- **500 Internal Server Error**: Check that the LiveKit credentials are correctly set in the token service's environment variables
- **401 Unauthorized**: Authentication is enabled - in development mode, this should be bypassed automatically

### Agent Connection Issues

- **"No such file or directory"**: Make sure the path to the agent implementation is correct in the API route
- **Module not found errors**: Verify all required Python packages are installed
- **Wrong page path**: Check that the `--page-path` argument matches the expected format

### LiveKit Connection Issues

- **Connection errors**: Ensure the token service is running on port 3002
- **Microphone not working**: Check browser permissions and verify the heartbeat system is functioning

## Architecture Details

The system works through this workflow:

1. **User visits a practice page**: The Next.js frontend loads the LiveKit components
2. **Token service generates tokens**: For both the user and the AI agent
3. **LiveKit room connection**: The user and agent connect to the same virtual room
4. **AI agent activation**: Based on the page type, specialized instructions are loaded
5. **Real-time conversation**: The user can practice speaking with natural voice interaction

## Important Notes

- The API keys in this README are examples and should be replaced with your own
- Each component must run on its designated port for the system to work correctly
- Make sure all three services are running simultaneously

## License

MIT
