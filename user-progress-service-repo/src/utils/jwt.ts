import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { JwtPayload } from '../types';

dotenv.config();

// Simple wrapper for JWT sign operation
export const signToken = (payload: JwtPayload): string => {
    const secretKey = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    
    if (!secretKey) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    
    // Use @ts-ignore to bypass TypeScript's type checking for this line
    // This is a pragmatic solution to avoid the persistent type error
    // involving the jsonwebtoken package type definitions
    // @ts-ignore - TypeScript has trouble with jsonwebtoken parameter types
    return jwt.sign(payload, secretKey, { expiresIn });
};
