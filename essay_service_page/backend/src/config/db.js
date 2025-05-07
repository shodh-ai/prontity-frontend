// backend/src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional: Add SSL configuration if required for your database connection
  // ssl: {
  //   rejectUnauthorized: false // Adjust based on your security requirements
  // }
});

pool.on('connect', () => {
  console.log('Connected to the Database!');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Export the pool itself if direct access is needed
};
