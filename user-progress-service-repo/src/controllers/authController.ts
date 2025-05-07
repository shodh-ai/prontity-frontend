import { Request, Response } from 'express';
import { RegisterPayload, LoginPayload, UserProfile, AuthenticatedRequest } from '../types'; 
import * as userService from '../services/userService';
import * as hashing from '../utils/hashing';
import { signToken } from '../utils/jwt';

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const { name, email, password } = req.body as RegisterPayload;

    if (!name || !email || !password) {
        res.status(400).json({ message: 'Name, email, and password are required' });
        return;
    }

    try {
        // Check if user already exists
        const existingUser = await userService.findUserByEmail(email);
        if (existingUser) {
            res.status(409).json({ message: 'Email already in use' });
            return;
        }

        // Hash password
        const hashedPassword = await hashing.hashPassword(password);

        // Create user (returns UserRecord)
        const newUser = await userService.createUser({
            name,
            email,
            passwordHash: hashedPassword
        });

        // Generate JWT using the string userId (UUID)
        const token = signToken({ userId: newUser.userId });

        // Respond with token and user profile (excluding password hash)
        // Construct UserProfile from UserRecord
        const userProfile: UserProfile = {
            userId: newUser.userId,
            name: newUser.name,
            email: newUser.email,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt
        };

        res.status(201).json({ token, user: userProfile });

    } catch (error) {
        console.error('Registration error:', error);
        // Handle specific 'Email already exists' error from service
        if (error instanceof Error && error.message === 'Email already exists') {
            res.status(409).json({ message: 'Email already in use' });
        } else {
            res.status(500).json({ message: 'Internal server error during registration' });
        }
    }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as LoginPayload;

    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required' });
        return;
    }

    try {
        // Find user by email (returns UserRecord with passwordHash)
        const user = await userService.findUserByEmailWithPassword(email);
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' }); // User not found
            return;
        }

        // Compare password
        const isMatch = await hashing.comparePassword(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' }); // Incorrect password
            return;
        }

        // Generate JWT using string userId (UUID)
        const token = signToken({ userId: user.userId });

        // Respond with token and user profile
        // Construct UserProfile from UserRecord
        const userProfile: UserProfile = {
            userId: user.userId,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        res.status(200).json({ token, user: userProfile });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error during login' });
    }
};

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // userId from middleware is already string (UUID)
    const userId = req.auth?.userId;

    if (!userId) {
        // This should technically be caught by the 'protect' middleware,
        // but adding a check here for robustness.
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        // findUserById expects string UUID, returns UserProfile
        const userProfile = await userService.findUserById(userId);
        if (!userProfile) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Return user profile data (already UserProfile type)
        res.status(200).json(userProfile);

    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
