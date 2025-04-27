# Agent Management - Moved to Server-Based Architecture

This API route has been deprecated in favor of a more robust server-based architecture to better handle multiple rooms.

## New Architecture

The agent management functionality is now implemented in a dedicated agent server:
- Location: `/livekit-agent-server/server/agent-server.js`
- Runs on: `http://localhost:8080`

## Endpoints

The agent server provides the following endpoints:
- `/connect-agent` - Connect an agent to a room
- `/disconnect-agent/:roomName` - Disconnect an agent from a room
- `/agent-status/:roomName` - Get the status of an agent in a room
- `/room-status/:roomName` - Get the status of a room
- `/list-rooms` - List all active rooms

## Benefits of Server-Based Approach

- Centralized management of multiple agents across different rooms
- Connection persistence independent of the Next.js app lifecycle
- More robust error handling and reconnection logic
- Better resource efficiency

This change maintains compatibility with the refactored LiveKitSession component structure that fixed React hooks ordering issues and implemented the advanced echo cancellation features.
