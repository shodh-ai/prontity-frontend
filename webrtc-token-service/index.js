const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const tokenRoutes = require('./routes/tokenRoutes');
const { apiKeyAuth } = require('./middleware/auth');
const { requestLogger } = require('./middleware/logger');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Apply request logging middleware
app.use(requestLogger);

// Parse JSON bodies
app.use(express.json());

// Configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
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

// Start the server
app.listen(PORT, () => {
  console.log(`WebRTC Token Service running on port ${PORT} [${process.env.NODE_ENV || 'development'} mode]`);
});
