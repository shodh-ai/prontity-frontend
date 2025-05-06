-- Vocabulary Words Table
CREATE TABLE vocab_words (
    word_id VARCHAR(255) PRIMARY KEY, -- e.g., 'ubiquitous', 'cacophony' or a UUID if preferred
    word_text VARCHAR(255) NOT NULL,
    definition TEXT NOT NULL,
    example_sentence TEXT,
    difficulty_level INTEGER DEFAULT 1, -- Example: 1=Beginner, 5=Advanced
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Add indexes if needed, e.g., on difficulty_level

-- Speaking Topics Table
CREATE TABLE speaking_topics (
    topic_id VARCHAR(255) PRIMARY KEY, -- e.g., 'topic-daily-routine', 'topic-climate-change' or UUID
    title VARCHAR(255) NOT NULL,
    prompt_text TEXT NOT NULL, -- The question or instruction for the user
    difficulty_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Writing Prompts Table
CREATE TABLE writing_prompts (
    prompt_id VARCHAR(255) PRIMARY KEY, -- e.g., 'prompt-argumentative-1', 'prompt-narrative-story' or UUID
    title VARCHAR(255) NOT NULL,
    prompt_text TEXT NOT NULL, -- The essay question or prompt
    difficulty_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger function to auto-update updated_at timestamps (if not already created by another service)
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_timestamp') THEN
      CREATE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $func$
      BEGIN
         NEW.updated_at = NOW();
         RETURN NEW;
      END;
      $func$ language 'plpgsql';
   END IF;
END;
$$;

CREATE TRIGGER update_vocab_words_updated_at
BEFORE UPDATE ON vocab_words
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_speaking_topics_updated_at
BEFORE UPDATE ON speaking_topics
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_writing_prompts_updated_at
BEFORE UPDATE ON writing_prompts
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
