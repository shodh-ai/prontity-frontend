import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import pool from './config/db'; // Import pool to initialize connection attempt
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Basic Route for Health Check / Welcome
app.get('/', (req: Request, res: Response) => {
    res.send('User & Progress Service is running!');
});

// Mount Routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Global Error Handler (Basic Example)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({ message: 'Something went wrong on the server!' });
});

// Ensure DB connection is attempted on start
const startServer = async () => {
    try {
        // Attempt a simple query to verify connection (optional but good)
        await pool.query('SELECT NOW()');
        console.log('Database connection verified.');

        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to the database:', error);
        console.error('Server will not start without a database connection.');
        process.exit(1); // Exit if DB connection fails
    }
};

startServer();
