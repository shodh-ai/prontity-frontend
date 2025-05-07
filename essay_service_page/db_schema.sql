-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Essays Table
CREATE TABLE essays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- Assuming a separate user management system provides this
  title TEXT,
  content JSONB NOT NULL,       -- Tiptap editor JSON
  version INT NOT NULL DEFAULT 0, -- Document version for collaboration
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Comments Table for AI Suggestions
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  essay_id UUID NOT NULL REFERENCES essays(id) ON DELETE CASCADE,
  range_start INT NOT NULL,
  range_end INT NOT NULL,
  message TEXT NOT NULL,
  comment_type TEXT,            -- e.g. “grammar”, “vocab”, “structure”
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Grades Table for Background Grading Results
CREATE TABLE grades (
  essay_id UUID PRIMARY KEY REFERENCES essays(id) ON DELETE CASCADE,
  score INT,
  feedback JSONB,              -- Store detailed feedback from GPT-4
  graded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table to store individual collaboration steps (for recovery/history)
CREATE TABLE essay_steps (
    id BIGSERIAL PRIMARY KEY,
    essay_id UUID NOT NULL REFERENCES essays(id) ON DELETE CASCADE,
    version INT NOT NULL, -- The version *after* this step is applied
    steps JSONB NOT NULL, -- Array of ProseMirror steps
    client_id TEXT,       -- Socket ID or unique client identifier
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Trigger to update updated_at timestamp on essay update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_essays_updated_at
BEFORE UPDATE ON essays
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Optional: Indexes for frequent lookups
CREATE INDEX idx_comments_essay_id ON comments(essay_id);
CREATE INDEX idx_essay_steps_essay_id_version ON essay_steps(essay_id, version);
