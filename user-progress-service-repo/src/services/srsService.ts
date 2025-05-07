import pool from '../config/db';
import { PoolClient } from 'pg';
import { SrsReviewItem, UserSrsItem, UserSrsItemRecord } from '../types';

// --- Utility to parse INTERVAL string --- //

// Basic parser for simple intervals like 'X days', '1 day', 'X hours'
// Returns interval in days (can be fractional for hours/minutes)
const parseIntervalToDays = (intervalStr: string | null): number => {
    if (!intervalStr) return 1; // Default to 1 day if null/undefined

    const parts = intervalStr.toLowerCase().split(' ');
    if (parts.length !== 2) return 1; // Malformed, default

    const value = parseFloat(parts[0]);
    const unit = parts[1].replace(/s$/, ''); // Remove plural 's'

    if (isNaN(value)) return 1; // NaN value, default

    switch (unit) {
        case 'day':
            return value;
        case 'hour':
            return value / 24;
        case 'minute':
            return value / (24 * 60);
        // Add other units if needed (week, month, year - though SM2 usually uses days)
        default:
            return value; // Assume days if unit unknown
    }
};

// --- Fetching Review Items --- //

// Fetch items due for review
export const getReviewItems = async (userId: string, itemType: string, limit: number): Promise<SrsReviewItem[]> => {
    const query = `
        SELECT
            user_id as "userId",
            item_id as "itemId",
            item_type as "itemType",
            next_review_at as "nextReviewAt"
            -- Removed id since it's not a primary key column
        FROM user_srs_items
        WHERE user_id = $1
          AND item_type = $2
          AND next_review_at <= NOW()
        ORDER BY next_review_at ASC -- Prioritize oldest reviews
        LIMIT $3;
    `;
    try {
        const res = await pool.query<SrsReviewItem>(query, [userId, itemType, limit]);
        return res.rows;
    } catch (err) {
        console.error(`Error fetching SRS review items for user ${userId}, type ${itemType}:`, err);
        throw new Error('Database error while fetching SRS review items');
    }
};

// --- Updating SRS Item --- //

// Default ease factor (adjust as needed)
const DEFAULT_EASE_FACTOR = 2.5;
const CORRECT_ANSWER_EASE_MODIFIER = 0.1; // Additive adjustment for correct answers
const INCORRECT_ANSWER_EASE_MODIFIER = -0.2; // Additive adjustment for incorrect answers
const MIN_EASE_FACTOR = 1.3;
const INCORRECT_ANSWER_RESET_INTERVAL_DAYS = 1; // Reset interval for incorrect answers
const MIN_INTERVAL_DAYS = 1;

/**
 * Updates the SRS data for a specific item after a review.
 * Requires userId, itemId, and itemType to identify the SRS record.
 * Can be called within a transaction by passing a PoolClient.
 */
export const updateSrsItem = async (
    dbClient: PoolClient | typeof pool, // Accept Pool or PoolClient
    userId: string,
    itemId: string,
    itemType: string,
    isCorrect: boolean
): Promise<void> => {

    // Fetch using the composite primary key
    const fetchQuery = `
        SELECT
            user_id,
            item_id,
            item_type,
            last_reviewed_at,
            next_review_at,
            current_interval, -- Fetch the INTERVAL string
            ease_factor
        FROM user_srs_items
        WHERE user_id = $1 AND item_id = $2 AND item_type = $3
        FOR UPDATE;
        -- Lock the row for update to prevent race conditions
    `;

    const updateQuery = `
        UPDATE user_srs_items
        SET last_reviewed_at = NOW(),
            next_review_at = $1,       -- Timestamp
            current_interval = $2,     -- Interval string (e.g., '3 days')
            ease_factor = $3           -- Real number
        WHERE user_id = $4 AND item_id = $5 AND item_type = $6;
    `;

    try {
        const fetchRes = await dbClient.query<UserSrsItemRecord>(fetchQuery, [userId, itemId, itemType]);
        const currentSrsData = fetchRes.rows[0];

        if (!currentSrsData) {
            // This could happen if the item wasn't added to SRS yet.
            // Consider creating it here or logging a warning.
            console.warn(`SRS item ${itemId} (${itemType}) not found for user ${userId} during update. Skipping update.`);
            // Optionally, create the initial record here if it should always exist after first encounter
            // await createInitialSrsItem(dbClient, userId, itemId, itemType);
            return; 
        }

        let newIntervalDays: number;
        let newEaseFactor = currentSrsData.ease_factor || DEFAULT_EASE_FACTOR;

        // Convert DB interval string to days for calculation
        const currentIntervalDays = parseIntervalToDays(currentSrsData.current_interval);

        if (isCorrect) {
            // SM-2 inspired logic for correct answer
            newIntervalDays = Math.max(MIN_INTERVAL_DAYS, Math.round(currentIntervalDays * newEaseFactor));
            newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor + CORRECT_ANSWER_EASE_MODIFIER);
        } else {
            // Incorrect answer: Reset interval, decrease ease factor
            newIntervalDays = INCORRECT_ANSWER_RESET_INTERVAL_DAYS;
            newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor + INCORRECT_ANSWER_EASE_MODIFIER);
        }

        // Calculate next review date based on the *new* interval
        const now = new Date();
        const nextReviewDate = new Date(now.setDate(now.getDate() + newIntervalDays));

        // Format the interval back into a string for PostgreSQL
        const newIntervalString = `${Math.round(newIntervalDays)} days`;

        await dbClient.query(updateQuery, [
            nextReviewDate,
            newIntervalString,
            newEaseFactor,
            userId,
            itemId,
            itemType
        ]);

    } catch (err) {
        console.error(`Error updating SRS item ${itemId} (${itemType}) for user ${userId}:`, err);
        // Re-throw the error so the transaction can roll back
        throw new Error('Database error while updating SRS item');
    }
};

/**
 * Creates an initial SRS record for a user and item if it doesn't exist.
 * Useful when a user encounters a new vocabulary word for the first time.
 * Can be called within a transaction by passing a PoolClient.
 */
export const createInitialSrsItem = async (
    dbClient: PoolClient | typeof pool,
    userId: string,
    itemId: string,
    itemType: string = 'vocab' // Default to vocab
): Promise<void> => {
    const query = `
        INSERT INTO user_srs_items (user_id, item_id, item_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, item_id, item_type) DO NOTHING; -- Avoid error if it already exists
    `;
    try {
        await dbClient.query(query, [userId, itemId, itemType]);
        console.log(`Ensured SRS item ${itemId} (${itemType}) exists for user ${userId}`);
    } catch (err) {
        console.error(`Error creating initial SRS item ${itemId} (${itemType}) for user ${userId}:`, err);
        // Don't necessarily throw, as the calling function might proceed anyway
        // Depending on requirements, you might want to re-throw
        // throw new Error('Database error while creating initial SRS item');
    }
};
