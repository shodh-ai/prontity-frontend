const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const tokenRoutes = require('./routes/tokenRoutes');
const { apiKeyAuth } = require('./middleware/auth');
const { requestLogger } = require('./middleware/logger');

// Try to load environment variables from multiple places
// First try .env
dotenv.config();
// Then try .env.local if it exists
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '.env.local') });
}

// Hardcoded credentials as a last resort for this specific development case
if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
  console.log('Setting LiveKit credentials from hardcoded values');
  process.env.LIVEKIT_URL = 'wss://shodhai-pojmjchi.livekit.cloud';
  process.env.LIVEKIT_API_KEY = 'APIFPSPx95xubAM';
  process.env.LIVEKIT_API_SECRET = 'VIbj58g0cqmHvPLadQfAinHCBC72FPdtwtDST0UDLdc';
}

const app = express();
// Force port 3002 for consistency with the frontend
const PORT = 3002;

// Apply request logging middleware
app.use(requestLogger);

// Parse JSON bodies
app.use(express.json());

// Configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:56616', 'http://127.0.0.1:57105', '*'];

app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: true
}));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'webrtc-token-service',
    timestamp: new Date().toISOString()
  });
});

// Apply API key authentication to protected routes
app.use('/api', apiKeyAuth, tokenRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error [${req.requestId || 'unknown'}]: ${err.message}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Print environment variables for debugging (but mask sensitive values)
console.log('Environment check:');
console.log('LIVEKIT_URL:', process.env.LIVEKIT_URL ? process.env.LIVEKIT_URL : 'not set');
console.log('LIVEKIT_API_KEY:', process.env.LIVEKIT_API_KEY ? 'is set' : 'not set');
console.log('LIVEKIT_API_SECRET:', process.env.LIVEKIT_API_SECRET ? 'is set' : 'not set');

// Start the server
app.listen(PORT, () => {
  console.log(`WebRTC Token Service running on port ${PORT} [${process.env.NODE_ENV || 'development'} mode]`);
});
