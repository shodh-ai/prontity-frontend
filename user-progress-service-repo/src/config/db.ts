import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    // Use connection string if available, otherwise use individual variables
    connectionString: process.env.DATABASE_URL,
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: parseInt(process.env.PGPORT || '5432', 10),
    // Recommended settings for production:
    // max: 20, // set pool max size
    // idleTimeoutMillis: 30000, // close idle clients after 30 seconds
    // connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
});

pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1);
});

export default pool;
