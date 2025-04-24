const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const dotenv = require('dotenv');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

// Load environment variables
dotenv.config();

// LiveKit configuration
const livekitUrl = process.env.LIVEKIT_URL;
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

// Agent configuration
const agentPath = process.env.AGENT_PATH || path.join(__dirname, '..', 'full_implementation');
const googleApiKey = process.env.GOOGLE_API_KEY;

// Store active room sessions
const activeRooms = {};

// Store active agent sessions
const activeAgents = {};

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Debug logger
const logError = (message, error) => {
  console.error(`❌ ERROR: ${message}`);
  console.error('Details:', error);
  if (error.stderr) {
    console.error('StdErr:', error.stderr);
  }
};

// Root endpoint - server health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Agent Server is running',
    activeRooms: Object.keys(activeRooms).length,
    activeAgents: Object.keys(activeAgents).length
  });
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

// Connect an agent to a room
app.post('/connect-agent', async (req, res) => {
  try {
    const { room, identity, pagePath, instructions, voice, temperature } = req.body;
    
    if (!room) {
      return res.status(400).json({ error: 'Missing room parameter' });
    }
    
    // If agent is already connected to this room
    if (activeAgents[room] && activeAgents[room].status === 'connected') {
      return res.json({ 
        status: 'already_connected',
        message: 'Agent is already connected to this room' 
      });
    }
    
    // Update status to 'connecting'
    activeAgents[room] = { 
      status: 'connecting',
      startTime: Date.now()
    };
    
    // First, get a token for the agent
    const agentIdentity = identity || 'ai-assistant';
    
    // Create a token using AccessToken from livekit-server-sdk
    const at = new AccessToken(apiKey, apiSecret, {
      identity: agentIdentity
    });

    at.addGrant({ 
      roomJoin: true, 
      room: room,
      canPublish: true,
      canSubscribe: true
    });

    const token = at.toJwt();
    
    // Get the page type for the agent
    const pageType = pagePath || 'speakingpage';
    
    // Build command with parameters
    let command = `cd "${agentPath}" && python3 "${agentPath}/main.py" connect --room "${room}" --token "${token}" --url "${livekitUrl}" --participant-identity "${agentIdentity}" --page-path "${pageType}"`;
    
    // Add voice parameter if provided
    if (voice) {
      command += ` --voice "${voice}"`;
    }
    
    // Add temperature parameter if provided
    if (temperature !== undefined) {
      command += ` --temperature ${temperature}`;
    }
    
    // Add instructions if provided
    if (instructions && instructions.trim() !== '') {
      // Escape quotes in instructions to preserve command integrity
      const escapedInstructions = instructions.replace(/"/g, '\\"');
      command += ` --instructions "${escapedInstructions}"`;
    }
    
    console.log(`Starting agent for room ${room} with page type: ${pageType}`);
    console.log(`Agent path: ${agentPath}`);
    
    // Start agent without waiting for it to complete
    const child = exec(command, (error, stdout, stderr) => {
      if (error) {
        logError(`Failed to start agent for room ${room}`, error);
        activeAgents[room].status = 'error';
        activeAgents[room].error = error.message;
        console.error('Command that failed:', command);
        return;
      }
      if (stderr) {
        console.log(`⚠️ Agent stderr:`, stderr);
      }
      console.log(`✅ Agent stdout:`, stdout);
      // If we get output without errors, update status to connected
      if (stdout && !stderr) {
        activeAgents[room].status = 'connected';
        console.log(`✅ Agent successfully connected to room ${room}`);
      }
    });
    
    // Store process ID for potential termination later
    if (child.pid) {
      activeAgents[room].pid = child.pid;
    }
    
    // Return response immediately while agent starts in background
    return res.json({
      status: 'connecting',
      message: 'Agent is starting in the background',
      room,
      identity: agentIdentity,
      pagePath: pageType
    });
  } catch (error) {
    console.error('Error starting agent:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Disconnect an agent from a room
app.post('/disconnect-agent/:roomName', (req, res) => {
  const roomName = req.params.roomName;
  
  if (!roomName) {
    return res.status(400).json({ error: 'Missing room parameter' });
  }
  
  // If there's no active agent for this room
  if (!activeAgents[roomName]) {
    return res.json({ 
      status: 'not_connected',
      message: 'No agent is connected to this room' 
    });
  }
  
  try {
    // Kill the agent process if we have a PID
    if (activeAgents[roomName].pid) {
      const pid = activeAgents[roomName].pid;
      console.log(`Terminating agent process ${pid} for room ${roomName}`);
      
      // On Unix/Mac, send SIGTERM
      exec(`kill ${pid}`, (error) => {
        if (error) {
          console.error(`Error killing process ${pid}:`, error);
        } else {
          console.log(`Successfully terminated process ${pid}`);
        }
      });
    }
    
    // Mark the agent as disconnected
    delete activeAgents[roomName];
    
    return res.json({
      status: 'disconnected',
      message: 'Agent has been disconnected from the room'
    });
  } catch (error) {
    console.error('Error disconnecting agent:', error);
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to disconnect agent'
    });
  }
});

// Get agent status for a room
app.get('/agent-status/:roomName', (req, res) => {
  const roomName = req.params.roomName;
  
  if (!roomName) {
    return res.status(400).json({ error: 'Missing room parameter' });
  }
  
  // Return the status of the agent in the specified room
  if (activeAgents[roomName]) {
    return res.json({ 
      status: activeAgents[roomName].status,
      startTime: activeAgents[roomName].startTime,
      error: activeAgents[roomName].error
    });
  } else {
    return res.json({ status: 'not_connected' });
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
      participant_count: participants.length,
      has_agent: !!activeAgents[roomName],
      agent_status: activeAgents[roomName]?.status
    });
  } else {
    res.json({ status: 'not_active' });
  }
});

// List rooms endpoint with agent status
app.get('/list-rooms', (req, res) => {
  const roomList = Object.entries(activeRooms).map(([room, info]) => ({
    name: room,
    participants: info.participants || [],
    created_at: info.created_at,
    has_agent: !!activeAgents[room],
    agent_status: activeAgents[room]?.status
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
    console.log(`Agent Server running at http://localhost:${PORT}`);
    console.log(`Agent path: ${agentPath}`);
    console.log(`LiveKit URL: ${livekitUrl}`);
    console.log(`Google API Key: ${googleApiKey ? 'is set' : 'not set'}`);
  });
}

startServer();
