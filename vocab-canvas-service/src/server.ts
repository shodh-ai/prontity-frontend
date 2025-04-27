import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import canvasRoutes from './routes/canvasRoutes';
import { initializeDatabase } from './data/init-db';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased payload limit for large canvas data
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'vocab-canvas-service' });
});

// API routes
app.use('/api', canvasRoutes);

// Initialize database on startup
initializeDatabase()
  .then(() => {
    // Start server
    app.listen(port, () => {
      console.log(`Vocabulary Canvas Service listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
