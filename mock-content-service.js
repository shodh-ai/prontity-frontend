// mock-content-service.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Logging middleware to debug incoming requests
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  next();
});

// Sample data for vocabulary words
const vocabData = {
  'ubiquitous': {
    wordId: 'ubiquitous',
    wordText: 'Ubiquitous',
    definition: 'Present, appearing, or found everywhere.',
    exampleSentence: 'Mobile phones have become ubiquitous in modern society.',
    difficultyLevel: 3,
  },
  'ameliorate': {
    wordId: 'ameliorate',
    wordText: 'Ameliorate',
    definition: 'To make something bad or unsatisfactory better.',
    exampleSentence: 'The new policies were designed to ameliorate the living conditions in urban areas.',
    difficultyLevel: 4,
  },
  'ephemeral': {
    wordId: 'ephemeral',
    wordText: 'Ephemeral',
    definition: 'Lasting for a very short time.',
    exampleSentence: 'The beauty of cherry blossoms is ephemeral, lasting only a few days each year.',
    difficultyLevel: 3,
  },
  'serendipity': {
    wordId: 'serendipity',
    wordText: 'Serendipity',
    definition: 'The occurrence and development of events by chance in a happy or beneficial way.',
    exampleSentence: 'Finding this rare book was pure serendipity - I wasn\'t even looking for it!',
    difficultyLevel: 4,
  }
};

// Sample data for speaking topics
const speakingTopics = {
  'topic-daily-routine': {
    topicId: 'topic-daily-routine',
    title: 'Your Daily Routine',
    promptText: 'Describe your typical daily routine. What activities do you do regularly? How do you manage your time?',
    difficultyLevel: 1,
  },
  'topic-climate-change': {
    topicId: 'topic-climate-change',
    title: 'Climate Change',
    promptText: 'What are your thoughts on climate change? How does it affect your country? What can individuals do to help?',
    difficultyLevel: 3,
  },
  'topic-technology': {
    topicId: 'topic-technology',
    title: 'Technology in Education',
    promptText: 'How has technology changed education? Do you think these changes are mostly positive or negative?',
    difficultyLevel: 2,
  }
};

// Sample data for writing prompts
const writingPrompts = {
  'prompt-narrative-story': {
    promptId: 'prompt-narrative-story',
    title: 'A Memorable Journey',
    promptText: 'Write a narrative essay about a memorable journey or trip you have taken. Include details about the destination, the people you were with, and why it was memorable.',
    difficultyLevel: 2,
  },
  'prompt-argumentative-1': {
    promptId: 'prompt-argumentative-1',
    title: 'Technology and Society',
    promptText: 'Do you believe technology has made us more connected or more isolated? Write an argumentative essay supporting your position with examples and evidence.',
    difficultyLevel: 3,
  },
  'prompt-descriptive': {
    promptId: 'prompt-descriptive',
    title: 'A Special Place',
    promptText: 'Describe a place that is special to you. It could be your hometown, a vacation spot, or any location that has meaning for you. Use descriptive language to help readers visualize this place.',
    difficultyLevel: 2,
  }
};

// API Routes

// Vocabulary endpoints - match exactly what the frontend is requesting
app.get('/content/vocab/:wordId', (req, res) => {
  const { wordId } = req.params;
  console.log(`Fetching vocabulary word with ID: ${wordId}`);
  
  const word = vocabData[wordId];
  
  if (!word) {
    console.log(`Vocabulary word not found: ${wordId}`);
    return res.status(404).json({ error: 'Vocabulary word not found' });
  }
  
  console.log(`Returning vocabulary word: ${word.wordText}`);
  return res.json(word);
});

// Speaking topic endpoints - match exactly what the frontend is requesting
app.get('/content/speaking/topic/:topicId', (req, res) => {
  const { topicId } = req.params;
  console.log(`Fetching speaking topic with ID: ${topicId}`);
  
  const topic = speakingTopics[topicId];
  
  if (!topic) {
    console.log(`Speaking topic not found: ${topicId}`);
    return res.status(404).json({ error: 'Speaking topic not found' });
  }
  
  console.log(`Returning speaking topic: ${topic.title}`);
  return res.json(topic);
});

// Writing prompt endpoints - match exactly what the frontend is requesting
app.get('/content/writing/prompt/:promptId', (req, res) => {
  const { promptId } = req.params;
  console.log(`Fetching writing prompt with ID: ${promptId}`);
  
  const prompt = writingPrompts[promptId];
  
  if (!prompt) {
    console.log(`Writing prompt not found: ${promptId}`);
    return res.status(404).json({ error: 'Writing prompt not found' });
  }
  
  console.log(`Returning writing prompt: ${prompt.title}`);
  return res.json(prompt);
});

// Additional catch-all route for debugging
app.use((req, res) => {
  console.log(`Unmatched route accessed: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: 'Route not found',
    requestedUrl: req.url,
    availableRoutes: [
      '/content/vocab/:wordId',
      '/content/speaking/topic/:topicId',
      '/content/writing/prompt/:promptId'
    ]
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Mock Content Service API running on http://localhost:${PORT}`);
  console.log(`Available endpoints:
  - GET /content/vocab/:wordId (e.g., /content/vocab/ubiquitous)
  - GET /content/speaking/topic/:topicId (e.g., /content/speaking/topic/topic-daily-routine)
  - GET /content/writing/prompt/:promptId (e.g., /content/writing/prompt/prompt-narrative-story)
  `);
});
