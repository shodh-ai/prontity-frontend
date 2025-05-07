import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtPayload } from '../types'; 
import dotenv from 'dotenv';

dotenv.config(); 

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!JWT_SECRET) {
        console.error('FATAL ERROR: JWT_SECRET is not defined.');
        res.status(500).json({ message: 'Internal server configuration error' });
        return;
    }

    if (token == null) {
        res.status(401).json({ message: 'Authentication token required' });
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            res.status(403).json({ message: 'Invalid or expired token' });
            return;
        }

        const payload = decoded as JwtPayload;

        if (!payload || !payload.userId) {
             console.error('JWT Payload Error: userId missing in token');
             res.status(403).json({ message: 'Invalid token payload' });
             return;
        }

        req.auth = { userId: payload.userId };

        next(); 
    });
};
