const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

// LiveKit configuration
const livekitUrl = process.env.LIVEKIT_URL;
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

// Store active room sessions
const activeRooms = {};

// Initialize Express app
const app = express();
const PORT = 8080;

// Enable CORS
app.use(cors());

// Root endpoint - server health check
app.get('/', (req, res) => {
  res.json({ status: 'LiveKit Room Server is running' });
});

// Token endpoint - generate a token for a room
app.get('/token', (req, res) => {
  const roomName = req.query.room;
  const username = req.query.username || 'user';

  if (!roomName) {
    return res.status(400).json({ error: 'Missing room parameter' });
  }

  try {
    // Check if required environment variables are set
    if (!livekitUrl || !apiKey || !apiSecret) {
      console.error('ERROR: Missing LiveKit configuration');
      return res.status(500).json({ 
        error: 'Server misconfigured. Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET' 
      });
    }

    // Create a token using AccessToken from livekit-server-sdk
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username
    });

    at.addGrant({ 
      roomJoin: true, 
      room: roomName,
      canPublish: true,
      canSubscribe: true
    });

    // Keep track of the room
    const now = Math.floor(Date.now() / 1000);
    activeRooms[roomName] = {
      created_at: now,
      participants: activeRooms[roomName]?.participants || []
    };

    if (!activeRooms[roomName].participants.includes(username)) {
      activeRooms[roomName].participants.push(username);
    }

    console.log(`Generated token for user ${username} in room ${roomName}`);

    res.json({
      token: at.toJwt(),
      wsUrl: livekitUrl
    });
  } catch (error) {
    console.error(`Error generating token: ${error.message}`);
    res.status(500).json({ error: `Error generating token: ${error.message}` });
  }
});

// Room status endpoint
app.get('/room-status/:roomName', (req, res) => {
  const roomName = req.params.roomName;
  
  if (activeRooms[roomName]) {
    const participants = activeRooms[roomName].participants || [];
    res.json({
      status: 'active',
      participants: participants,
      participant_count: participants.length
    });
  } else {
    res.json({ status: 'not_active' });
  }
});

// List rooms endpoint
app.get('/list-rooms', (req, res) => {
  const roomList = Object.entries(activeRooms).map(([room, info]) => ({
    name: room,
    participants: info.participants || [],
    created_at: info.created_at
  }));

  res.json({ rooms: roomList });
});

// Start the server
function startServer() {
  if (!livekitUrl || !apiKey || !apiSecret) {
    console.error('ERROR: Missing LiveKit configuration. Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in your .env file');
    return;
  }

  app.listen(PORT, () => {
    console.log(`Room Server running at http://localhost:${PORT}`);
  });
}

startServer();
