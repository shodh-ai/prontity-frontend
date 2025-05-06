// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import contentRoutes from './routes/contentRoutes';
import pool from './config/db'; // Import pool to ensure db connection is attempted on startup

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json()); // For parsing application/json

// Simple Root Route
app.get('/', (req: Request, res: Response) => {
  res.send('AI Tutor Content Service is running!');
});

// Mount Content Routes
app.use('/content', contentRoutes);

// Basic Error Handling Middleware (Example)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Content service listening on port ${PORT}`);
    // Attempt a simple query to verify DB connection (optional)
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Database connection error:', err);
        } else {
            console.log('Database connection verified:', res.rows[0].now);
        }
    });
});
