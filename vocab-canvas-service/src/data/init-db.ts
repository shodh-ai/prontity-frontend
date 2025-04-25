import { query } from '../config/database';

/**
 * Initialize the database schema for the vocabulary canvas service
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Create the table for user canvas states
    await query(`
      CREATE TABLE IF NOT EXISTS user_canvas_states (
        user_id VARCHAR(255) NOT NULL,
        word_id VARCHAR(255) NOT NULL,
        canvas_data JSONB, -- Use JSONB for efficient storage and querying of JSON
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, word_id) -- Composite primary key
      );
    `);

    // Add index for user_id for faster queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_user_canvas_states_user_id 
      ON user_canvas_states (user_id);
    `);

    // Create function for auto-updating the updated_at timestamp
    await query(`
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
         NEW.updated_at = NOW();
         RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger to auto-update updated_at on records
    await query(`
      DROP TRIGGER IF EXISTS update_user_canvas_states_updated_at ON user_canvas_states;
      CREATE TRIGGER update_user_canvas_states_updated_at
      BEFORE UPDATE
      ON user_canvas_states
      FOR EACH ROW
      EXECUTE PROCEDURE update_timestamp();
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
};

// Allow this to be executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}
