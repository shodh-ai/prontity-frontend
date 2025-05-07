import pool from '../config/db';
import { NextTaskResponse, TaskDefinition } from '../types';

/**
 * Determines the next task for a user based on their progress.
 * Current simple implementation: Finds the first task definition (by sequence_order)
 * that the user hasn't completed.
 */
export const getNextTaskForUser = async (userId: string): Promise<NextTaskResponse | null> => {
    // Query to find the task definition with the lowest sequence_order
    // that does not have a corresponding entry in user_task_progress for this user.
    const query = `
        SELECT
            td.task_id AS "taskId",
            td.task_type AS "taskType",
            td.content_ref_id AS "contentRefId",
            td.difficulty_level AS "difficultyLevel",
            td.sequence_order AS "sequenceOrder"
        FROM task_definitions td
        LEFT JOIN user_task_progress utp ON td.task_id = utp.task_id AND utp.user_id = $1
        WHERE utp.user_id IS NULL -- Task not completed by the user
        ORDER BY td.sequence_order ASC, td.task_id ASC -- Ensure consistent ordering
        LIMIT 1;
    `;

    try {
        const res = await pool.query<TaskDefinition>(query, [userId]);
        const nextTaskDefinition = res.rows[0];

        if (!nextTaskDefinition) {
            // No incomplete tasks found (or task definitions are empty)
            return null;
        }

        // Map TaskDefinition to NextTaskResponse
        // In this simple case, they are very similar, but could diverge later
        const nextTask: NextTaskResponse = {
            taskId: nextTaskDefinition.taskId,
            taskType: nextTaskDefinition.taskType,
            contentRefId: nextTaskDefinition.contentRefId,
            difficultyLevel: nextTaskDefinition.difficultyLevel
            // Add other details needed by the frontend/client if necessary
        };

        return nextTask;

    } catch (err) {
        console.error(`Error fetching next task for user ${userId}:`, err);
        throw new Error('Database error while fetching next task');
    }
};

// Future enhancement: Incorporate SRS data, user performance, etc., into next task logic.
