-- Create database (run this separately if executing from psql)
-- CREATE DATABASE user_progress_db;

-- Connect to the database
-- \c user_progress_db

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task definitions table
CREATE TABLE IF NOT EXISTS task_definitions (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type VARCHAR(50) NOT NULL, -- e.g., 'lesson', 'exercise', 'quiz'
    content_ref_id VARCHAR(255) NOT NULL, -- Reference to content in external system
    difficulty_level INTEGER, -- Optional difficulty rating
    sequence_order INTEGER NOT NULL, -- For ordering in table of contents
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User task progress table
CREATE TABLE IF NOT EXISTS user_task_progress (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    task_id UUID REFERENCES task_definitions(task_id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    score NUMERIC, -- Optional score (e.g., 0-100)
    performance_data JSONB, -- Flexible performance metrics
    PRIMARY KEY (user_id, task_id)
);

-- User SRS items table
CREATE TABLE IF NOT EXISTS user_srs_items (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL, -- ID of the item (e.g., vocabulary word)
    item_type VARCHAR(50) NOT NULL, -- e.g., 'vocab', 'grammar'
    last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 day',
    current_interval INTERVAL DEFAULT '1 day', -- Interval for spaced repetition
    ease_factor REAL DEFAULT 2.5, -- SM-2 algorithm ease factor
    PRIMARY KEY (user_id, item_id, item_type)
);

-- Add some sample task definitions
INSERT INTO task_definitions (task_type, content_ref_id, difficulty_level, sequence_order) VALUES
('lesson', 'intro-lesson-1', 1, 10),
('exercise', 'basic-exercise-1', 1, 20),
('quiz', 'beginner-quiz-1', 1, 30),
('lesson', 'intro-lesson-2', 1, 40),
('exercise', 'basic-exercise-2', 2, 50);

-- Add indexes for performance
CREATE INDEX idx_user_task_progress_user_id ON user_task_progress(user_id);
CREATE INDEX idx_user_srs_items_user_id ON user_srs_items(user_id);
CREATE INDEX idx_user_srs_items_next_review ON user_srs_items(next_review_at);
