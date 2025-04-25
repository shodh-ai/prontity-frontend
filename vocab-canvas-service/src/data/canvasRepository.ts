import { query } from '../config/database';
import { CanvasStatePayload, StoredCanvasData } from '../types';

/**
 * Repository for canvas data operations
 */
export class CanvasRepository {
  /**
   * Save canvas state for a specific user and word
   * @param userId User ID
   * @param wordId Word ID
   * @param canvasData Canvas state data to save
   * @returns Success status
   */
  async saveCanvasState(
    userId: string,
    wordId: string,
    canvasData: CanvasStatePayload
  ): Promise<boolean> {
    try {
      // Use UPSERT pattern (INSERT ... ON CONFLICT DO UPDATE) to handle both insert and update cases
      const result = await query(
        `
        INSERT INTO user_canvas_states (user_id, word_id, canvas_data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, word_id) 
        DO UPDATE SET canvas_data = $3, updated_at = NOW()
        RETURNING user_id, word_id
        `,
        [userId, wordId, JSON.stringify(canvasData)]
      );

      return !!result.rowCount && result.rowCount > 0;
    } catch (error) {
      console.error('Error saving canvas state:', error);
      throw error;
    }
  }

  /**
   * Get canvas state for a specific user and word
   * @param userId User ID
   * @param wordId Word ID
   * @returns Canvas state data or null if not found
   */
  async getCanvasState(
    userId: string,
    wordId: string
  ): Promise<StoredCanvasData | null> {
    try {
      const result = await query(
        `
        SELECT canvas_data
        FROM user_canvas_states
        WHERE user_id = $1 AND word_id = $2
        `,
        [userId, wordId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // pg will automatically parse the JSONB column to a JavaScript object
      return result.rows[0].canvas_data as StoredCanvasData;
    } catch (error) {
      console.error('Error getting canvas state:', error);
      throw error;
    }
  }

  /**
   * Delete canvas state for a specific user and word
   * @param userId User ID
   * @param wordId Word ID
   * @returns Success status
   */
  async deleteCanvasState(
    userId: string,
    wordId: string
  ): Promise<boolean> {
    try {
      const result = await query(
        `
        DELETE FROM user_canvas_states
        WHERE user_id = $1 AND word_id = $2
        RETURNING user_id
        `,
        [userId, wordId]
      );

      return !!result.rowCount && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting canvas state:', error);
      throw error;
    }
  }

  /**
   * Get all canvas states for a specific user
   * @param userId User ID
   * @returns Map of word IDs to canvas states
   */
  async getAllUserCanvasStates(
    userId: string
  ): Promise<Record<string, StoredCanvasData>> {
    try {
      const result = await query(
        `
        SELECT word_id, canvas_data
        FROM user_canvas_states
        WHERE user_id = $1
        `,
        [userId]
      );

      const canvasStates: Record<string, StoredCanvasData> = {};
      
      for (const row of result.rows) {
        canvasStates[row.word_id] = row.canvas_data;
      }

      return canvasStates;
    } catch (error) {
      console.error('Error getting all user canvas states:', error);
      throw error;
    }
  }
}
