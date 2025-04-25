import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a new pool using environment variables
// This will use PGUSER, PGHOST, PGDATABASE, PGPASSWORD, PGPORT by default
const pool = new Pool();

/**
 * Execute a query on the database
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

/**
 * Get a client from the connection pool
 * @returns Client and release function
 */
export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = () => {
    client.release();
  };
  return { client, query, release };
};

// Export the pool for potential direct use
export default pool;
