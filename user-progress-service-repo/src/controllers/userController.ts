import { Response } from 'express';
import { AuthenticatedRequest, TaskCompletionPayload, UserProfile, SrsReviewItem } from '../types';
import * as progressService from '../services/progressService';
import * as tocService from '../services/tocService';
import * as srsService from '../services/srsService';
import * as userService from '../services/userService';
import { Request } from 'express';

// GET /users/me/progress
export const getUserProgress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.auth?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        // TODO: Implement service logic
        const progress = await progressService.getUserProgress(userId);
        res.status(200).json(progress);
    } catch (error) {
        console.error('Error fetching user progress:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// POST /users/me/progress
export const recordTaskCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.auth?.userId;
    const payload = req.body as TaskCompletionPayload;

    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    if (!payload.taskId) {
        res.status(400).json({ message: 'Bad Request: taskId is required' });
        return;
    }

    try {
        // TODO: Implement service logic
        await progressService.recordTaskCompletion(userId, payload);
        res.status(201).json({ message: 'Progress recorded' });
    } catch (error) {
        console.error('Error recording task completion:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /users/me/toc/next
export const getNextTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.auth?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        // TODO: Implement service logic
        const nextTask = await tocService.getNextTaskForUser(userId);
        if (!nextTask) {
            res.status(404).json({ message: 'No more tasks available or user progress not found' });
            return;
        }
        res.status(200).json(nextTask);
    } catch (error) {
        console.error('Error getting next task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /users/me/srs/review-items
export const getSrsReviewItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.auth?.userId;
    const itemType = (req.query.type as string) || 'vocab'; // Default to 'vocab'
    const limit = parseInt(req.query.limit as string, 10) || 10; // Default limit

    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        // TODO: Implement service logic
        const reviewItems = await srsService.getReviewItems(userId, itemType, limit);
        res.status(200).json(reviewItems);
    } catch (error) {
        console.error('Error getting SRS review items:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Controller to get the profile of the currently authenticated user.
 * Assumes userId is attached to req.auth by authentication middleware.
 */
export const getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // The auth middleware should attach the user object with the userId
    // AuthenticatedRequest type should guarantee req.auth exists if middleware ran successfully
    const userId = req.auth?.userId;

    if (!userId) {
        // This case indicates a problem with the auth middleware or type definition
        console.error('User ID not found in authenticated request');
        res.status(401).json({ message: 'Authentication error: User ID missing' });
        return;
    }

    try {
        const userProfile: UserProfile | null = await userService.findUserById(userId);

        if (!userProfile) {
            // This is unlikely if the JWT is valid but the user was deleted
            res.status(404).json({ message: 'User profile not found' });
            return;
        }

        res.status(200).json(userProfile);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        // Check if the error is a known type or has a specific message
        if (error instanceof Error) {
            res.status(500).json({ message: 'Error fetching user profile', error: error.message });
        } else {
            res.status(500).json({ message: 'An unexpected error occurred' });
        }
    }
};
