import { Request } from 'express';

// --- Authentication --- //

export interface RegisterPayload {
    name: string;
    email: string;
    password: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    user: UserProfile;
}

export interface JwtPayload {
    userId: string; 
    // Add other relevant claims like roles if needed
}

// Extend Express Request to include authenticated user info
export interface AuthenticatedRequest extends Request {
    auth?: { userId: string }; 
}

// --- User Profile --- //

export interface UserProfile {
    userId: string; 
    name: string | null; 
    email: string;
    createdAt?: Date; 
    updatedAt?: Date; 
}

// Internal representation matching DB (includes password hash)
export interface UserRecord extends UserProfile {
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}

// --- Progress Tracking --- //

export interface TaskCompletionPayload {
    taskId: string;         
    score?: number | null;   
    performanceData?: Record<string, any> | null; 
    srsItemId?: string;     
    srsCorrect?: boolean;   
}

export interface UserTaskProgress {
    userId: string;         
    taskId: string;         
    completedAt: Date;
    score?: number | null;
    performanceData?: Record<string, any> | null;
    // Note: The composite primary key (userId, taskId) is implicit
}

// --- Table of Content (ToC) --- //

export interface TaskDefinition { 
    taskId: string;         
    taskType: 'vocab' | 'speaking' | 'writing' | 'reflection'; 
    contentRefId: string;
    difficultyLevel: number | null; 
    sequenceOrder: number | null; 
}

export interface NextTaskResponse {
    taskId: string;
    taskType: string;
    contentRefId: string;
    difficultyLevel?: number | null;
    // Include other necessary task details to start the task
}

// --- Spaced Repetition System (SRS) --- //

export interface UserSrsItem {
    userId: string;         
    itemId: string;         
    itemType: string;       
    lastReviewedAt: Date | null;
    nextReviewAt: Date;
    // DB stores INTERVAL, but we'll likely handle as number of days in service
    currentIntervalDays: number; 
    easeFactor: number;
    // Note: Composite primary key (userId, itemId, itemType) is implicit
}

// Represents a row from user_srs_items table directly
export interface UserSrsItemRecord {
    user_id: string;
    item_id: string;
    item_type: string;
    last_reviewed_at: Date | null;
    next_review_at: Date;
    current_interval: string; 
    ease_factor: number;
}

export interface SrsReviewItem {
    // This might represent the user_srs_items record ID if it had one, or just the item details.
    // Let's align with the query in srsService which selects item_id.
    // We also need the user_srs_items primary key parts to update it later.
    userId: string;
    itemId: string; 
    itemType: string;
    nextReviewAt: Date;
}
