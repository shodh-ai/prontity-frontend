// backend/src/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { initSocket } = require('./services/socketService');
const essayRoutes = require('./routes/essayRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(express.json()); // for parsing application/json

// CORS middleware with specific settings for our frontend
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001'];
  const origin = req.headers.origin;
  
  // Only allow requests from our frontend origins
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  
  next();
});


// Routes
app.get('/', (req, res) => {
  res.send('Essay Service Backend is running!');
});

app.use('/essays', essayRoutes);

// Basic Error Handling
app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message
    }
  });
});

// Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // Verify DB connection on startup (optional but good practice)
  require('./config/db').pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('!!! Failed to connect to database on startup !!!', err);
    } else {
      console.log('Database connection verified.');
    }
  });
  // Verify Queue connection (optional)
  try {
    const { essayGradingQueue } = require('./config/queue');
    if (essayGradingQueue) {
      console.log('Redis connection for BullMQ initialized.');
    }
  } catch (err) {
    console.error('!!! Failed to connect to Redis for BullMQ on startup !!!', err);
  }
});
