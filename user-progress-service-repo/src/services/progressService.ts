import pool from '../config/db';
import { PoolClient } from 'pg'; // Import PoolClient for transactions
import { TaskCompletionPayload, UserTaskProgress } from '../types';
// Import SRS service for transaction-based updates
import * as srsService from './srsService';

/**
 * Records a task completion for a user, optionally updating SRS data.
 * Uses a transaction to ensure atomicity.
 */
export const recordTaskCompletion = async (userId: string, payload: TaskCompletionPayload): Promise<UserTaskProgress> => {
    const { taskId, score, performanceData, srsItemId, srsCorrect } = payload;

    // Basic validation
    if (!taskId) {
        throw new Error('Task ID is required to record completion');
    }

    const client: PoolClient = await pool.connect();

    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Insert or Update User Task Progress
        // Use ON CONFLICT to handle cases where a user might re-complete a task
        // Update the completion time, score, and performance data if re-completed
        const progressQuery = `
            INSERT INTO user_task_progress (user_id, task_id, score, performance_data)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, task_id)
            DO UPDATE SET
                completed_at = CURRENT_TIMESTAMP,
                score = EXCLUDED.score,
                performance_data = EXCLUDED.performance_data
            RETURNING user_id as "userId", task_id as "taskId", completed_at as "completedAt", score, performance_data as "performanceData";
        `;

        // Ensure performanceData is null if undefined, otherwise valid JSONB
        const performanceDataJson = performanceData ? JSON.stringify(performanceData) : null;

        const progressRes = await client.query<UserTaskProgress>(progressQuery, [
            userId,
            taskId,
            score, // Can be null
            performanceDataJson // Can be null
        ]);
        const recordedProgress = progressRes.rows[0];

        // 2. Handle SRS Update (if applicable)
        if (srsItemId !== undefined && srsCorrect !== undefined) {
            // Assume itemType is 'vocab' for now, or derive it from taskId if possible
            const itemType = 'vocab'; // TODO: Make this more robust if needed

            // Ensure the SRS item exists before trying to update it
            // This handles the case where a user completes a task involving a new vocab word
            await srsService.createInitialSrsItem(client, userId, srsItemId, itemType);

            // Update the SRS item based on correctness
            await srsService.updateSrsItem(
                client,         // Pass the transaction client
                userId,         // string
                srsItemId,      // string
                itemType,       // string
                srsCorrect      // boolean
            );
        }

        await client.query('COMMIT'); // Commit transaction
        return recordedProgress;

    } catch (err) {
        await client.query('ROLLBACK'); // Rollback transaction on error
        console.error(`Error recording task completion for user ${userId}, task ${taskId}:`, err);
        // Re-throw specific errors if needed, otherwise generic
        if (err instanceof Error && err.message.includes('violates foreign key constraint')) {
             if (err.message.includes('task_definitions')) {
                throw new Error(`Invalid Task ID: ${taskId} does not exist.`);
            }
        }
        throw new Error('Database error while recording task progress');
    } finally {
        client.release(); // Release client back to the pool
    }
};

/**
 * Retrieves all task progress records for a specific user.
 */
export const getUserProgress = async (userId: string): Promise<UserTaskProgress[]> => {
    const query = `
        SELECT
            user_id as "userId",
            task_id as "taskId",
            completed_at as "completedAt",
            score,
            performance_data as "performanceData"
        FROM user_task_progress
        WHERE user_id = $1
        ORDER BY completed_at DESC;
    `;
    try {
        const res = await pool.query<UserTaskProgress>(query, [userId]);
        return res.rows;
    } catch (err) {
        console.error(`Error fetching progress for user ${userId}:`, err);
        throw new Error('Database error while fetching user progress');
    }
};

/**
 * Checks if a user has completed a specific task.
 * Used by tocService.
 */
export const hasUserCompletedTask = async (userId: string, taskId: string): Promise<boolean> => {
    const query = 'SELECT 1 FROM user_task_progress WHERE user_id = $1 AND task_id = $2 LIMIT 1';
    try {
        const res = await pool.query(query, [userId, taskId]);
        // Check if rowCount is not null AND greater than 0
        return res.rowCount !== null && res.rowCount > 0;
    } catch (err) {
        console.error(`Error checking task completion for user ${userId}, task ${taskId}:`, err);
        throw new Error('Database error while checking task completion');
    }
};
