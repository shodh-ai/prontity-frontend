import pool from '../config/db';
import { UserProfile, UserRecord } from '../types';

interface UserCreationData {
    name: string;
    email: string;
    passwordHash: string;
}

export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
    // Select fields matching UserProfile, renaming id to userId
    const query = 'SELECT user_id as "userId", name, email, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1';
    try {
        const res = await pool.query<UserProfile>(query, [email]);
        return res.rows[0] || null;
    } catch (err) {
        console.error('Error finding user by email:', err);
        throw new Error('Database error while finding user by email');
    }
};

// Separate function to fetch password hash when needed (e.g., login)
export const findUserByEmailWithPassword = async (email: string): Promise<UserRecord | null> => {
    // Select fields matching UserRecord, renaming id to userId
    const query = 'SELECT user_id as "userId", name, email, password_hash as "passwordHash", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1';
    try {
        const res = await pool.query<UserRecord>(query, [email]);
        return res.rows[0] || null;
    } catch (err) {
        console.error('Error finding user by email with password:', err);
        throw new Error('Database error while finding user by email');
    }
};

export const findUserById = async (userId: string): Promise<UserProfile | null> => { 
    // Select fields matching UserProfile
    const query = 'SELECT user_id as "userId", name, email, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE user_id = $1';
    try {
        const res = await pool.query<UserProfile>(query, [userId]);
        return res.rows[0] || null;
    } catch (err) {
        console.error('Error finding user by ID:', err);
        throw new Error('Database error while finding user by ID');
    }
};

export const createUser = async (userData: UserCreationData): Promise<UserRecord> => {
    const { name, email, passwordHash } = userData;
    // Use correct column names: password_hash
    const query = 'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id as "userId", name, email, password_hash as "passwordHash", created_at as "createdAt", updated_at as "updatedAt"';
    try {
        const res = await pool.query<UserRecord>(query, [name, email, passwordHash]);
        return res.rows[0]; 
    } catch (err) {
        console.error('Error creating user:', err);
        // Check for unique constraint violation (email exists)
        if ((err as any).code === '23505') { 
            throw new Error('Email already exists');
        }
        throw new Error('Database error while creating user');
    }
};

// Add updateUserProfile function later if needed
