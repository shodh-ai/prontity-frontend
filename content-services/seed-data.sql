-- Insert Sample Vocabulary Words
INSERT INTO vocab_words (word_id, word_text, definition, example_sentence, difficulty_level)
VALUES 
('ubiquitous', 'ubiquitous', 'Present, appearing, or found everywhere.', 'Mobile phones are now ubiquitous in modern society.', 4),
('ameliorate', 'ameliorate', 'To make something better or more tolerable.', 'The medicine helped to ameliorate her symptoms.', 5),
('ephemeral', 'ephemeral', 'Lasting for a very short time.', 'The beauty of cherry blossoms is ephemeral, lasting only a few days.', 4),
('serendipity', 'serendipity', 'The occurrence of events by chance in a happy or beneficial way.', 'Finding this book was pure serendipity as I wasn''t looking for it.', 3);

-- Insert Sample Speaking Topics
INSERT INTO speaking_topics (topic_id, title, prompt_text, difficulty_level)
VALUES 
('topic-daily-routine', 'Daily Routine', 'Describe your typical daily routine. What activities do you do every day, and at what times? Is there anything you would like to change about your routine?', 1),
('topic-climate-change', 'Climate Change', 'What do you think are the most important actions individuals and governments should take to address climate change? How might these challenges impact future generations?', 4),
('topic-technology', 'Technology Impact', 'How has technology changed the way people communicate in the last decade? Do you think these changes are mostly positive or negative?', 3);

-- Insert Sample Writing Prompts
INSERT INTO writing_prompts (prompt_id, title, prompt_text, difficulty_level)
VALUES 
('prompt-narrative-story', 'A Memorable Journey', 'Write a narrative about a memorable journey you took. Describe the destination, the people you met, and how this experience affected you.', 2),
('prompt-argumentative-1', 'Remote Work Debate', 'Do you think remote work should continue to be the norm after the pandemic? Write an argumentative essay supporting your position with clear reasons and examples.', 4),
('prompt-descriptive', 'Favorite Place', 'Write a descriptive essay about your favorite place. Use sensory details to help the reader feel as if they are there with you.', 2);
