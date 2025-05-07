// backend/src/routes/essayRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { addGradingJob } = require('../config/queue');
const { v4: uuidv4 } = require('uuid');
const { getEssaySuggestions } = require('../services/openaiService');
const { getTextFromTiptapJson } = require('../utils/tiptapUtils');

// POST /essays – create a new essay
router.post('/', async (req, res) => {
  const { userId, title, content } = req.body; // Assuming userId comes from auth middleware later
  // Basic validation
  if (!userId || !content) {
    return res.status(400).json({ message: 'userId and initial content are required' });
  }

  const newEssayId = uuidv4();
  const initialContent = content || { type: 'doc', content: [{ type: 'paragraph' }] }; // Default empty Tiptap doc
  const finalTitle = title || 'Untitled Essay';

  try {
    const result = await db.query(
      'INSERT INTO essays (id, user_id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id',
      [newEssayId, userId, finalTitle, initialContent]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Error creating essay:', error);
    res.status(500).json({ message: 'Failed to create essay' });
  }
});

// GET /essays/:id – fetch the essay content and metadata
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT id, user_id, title, content, version, created_at, updated_at FROM essays WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Essay not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching essay ${id}:`, error);
    res.status(500).json({ message: 'Failed to fetch essay' });
  }
});

// PATCH /essays/:id – update essay content or title
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title && !content) {
    return res.status(400).json({ message: 'Either title or content must be provided for update' });
  }

  let queryText = 'UPDATE essays SET ';
  const queryParams = [];
  let paramIndex = 1;

  if (title !== undefined) {
    queryText += `title = $${paramIndex++}, `;
    queryParams.push(title);
  }
  if (content !== undefined) {
    queryText += `content = $${paramIndex++}, `;
    queryParams.push(content);
  }

  // Always update the updated_at timestamp (handled by trigger)
  queryText += `updated_at = NOW() WHERE id = $${paramIndex++} RETURNING id, title, content, updated_at`;
  queryParams.push(id);

  try {
    const result = await db.query(queryText, queryParams);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Essay not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error updating essay ${id}:`, error);
    res.status(500).json({ message: 'Failed to update essay' });
  }
});

// GET /essays/:id/comments – list AI-generated inline comments
router.get('/:id/comments', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT id, range_start, range_end, message, comment_type, created_at FROM comments WHERE essay_id = $1 ORDER BY range_start', [id]);
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching comments for essay ${id}:`, error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// POST /essays/:id/comments – (internal) add a comment at a given text range
router.post('/:id/comments', async (req, res) => {
  // NOTE: This is marked as '(internal)' in the prompt. Generally, the AI analysis
  //       endpoint would call a service function that uses this logic, rather than
  //       exposing it directly unless needed for testing/admin.
  const { id: essayId } = req.params;
  const { range_start, range_end, message, comment_type } = req.body;

  if (range_start === undefined || range_end === undefined || !message) {
    return res.status(400).json({ message: 'range_start, range_end, and message are required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO comments (essay_id, range_start, range_end, message, comment_type, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [essayId, range_start, range_end, message, comment_type || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Handle potential foreign key constraint violation if essay_id doesn't exist
    if (error.code === '23503') { // Foreign key violation error code in PostgreSQL
        return res.status(404).json({ message: `Essay with id ${essayId} not found.` });
    }
    console.error(`Error adding comment for essay ${essayId}:`, error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// POST /essays/:id/analyze – send the current text to OpenAI GPT-4
router.post('/:id/analyze', async (req, res) => {
  const { id: essayId } = req.params;
  const dbClient = await db.pool.connect(); // Get client for transaction
  
  try {
    // 1. Fetch current essay content
    const essayRes = await dbClient.query('SELECT content FROM essays WHERE id = $1', [essayId]);
    if (essayRes.rows.length === 0) {
      return res.status(404).json({ message: 'Essay not found' });
    }
    const essayContentJson = essayRes.rows[0].content;
    
    // 2. Convert Tiptap JSON to plain text
    const essayPlainText = getTextFromTiptapJson(essayContentJson);
    if (!essayPlainText.trim()) {
      return res.status(200).json({ 
        message: "Essay is empty, no analysis performed.", 
        comments: [] 
      });
    }
    
    // 3. Call OpenAI service with TOEFL-rubric prompt
    console.log(`Requesting AI analysis for essay ${essayId}...`);
    const suggestions = await getEssaySuggestions(essayPlainText);
    
    if (!suggestions || suggestions.length === 0) {
      console.log(`No suggestions received from AI for essay ${essayId}.`);
      return res.status(200).json({ 
        message: "AI analysis complete, no suggestions found.", 
        comments: [] 
      });
    }
    
    // 4. Start transaction for saving comments
    await dbClient.query('BEGIN');
    
    // Optional: Delete previous AI comments for this essay
    // In a real app, you might add a 'source' column to differentiate between AI and user comments
    await dbClient.query('DELETE FROM comments WHERE essay_id = $1', [essayId]);
    console.log(`Cleared previous comments for essay ${essayId}.`);
    
    // 5. Save each suggestion as a comment
    const insertedComments = [];
    const insertQuery = 'INSERT INTO comments (essay_id, range_start, range_end, message, comment_type, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *';
    
    for (const suggestion of suggestions) {
      const range_start = suggestion.offset;
      const range_end = suggestion.offset + suggestion.length;
      
      const result = await dbClient.query(insertQuery, [
        essayId,
        range_start,
        range_end,
        suggestion.message,
        suggestion.type
      ]);
      
      insertedComments.push(result.rows[0]);
    }
    
    await dbClient.query('COMMIT');
    console.log(`Saved ${insertedComments.length} new AI comments for essay ${essayId}.`);
    
    // 6. Return the newly created comments
    res.status(201).json({ 
      message: "AI analysis complete.", 
      comments: insertedComments 
    });
    
  } catch (error) {
    // Rollback transaction if any error occurs
    await dbClient.query('ROLLBACK');
    console.error(`Error analyzing essay ${essayId}:`, error);
    res.status(500).json({ message: `Failed to analyze essay: ${error.message}` });
  } finally {
    dbClient.release(); // Always release the client
  }
});

// POST /essays/:id/submit – enqueue a job for background grading
router.post('/:id/submit', async (req, res) => {
  const { id: essayId } = req.params;
  try {
    // Optional: Check if essay exists before queueing
    const essayExists = await db.query('SELECT 1 FROM essays WHERE id = $1', [essayId]);
    if (essayExists.rows.length === 0) {
        return res.status(404).json({ message: `Essay with id ${essayId} not found.` });
    }

    await addGradingJob({ essayId });
    res.status(202).json({ message: 'Essay submitted for grading' });
  } catch (error) {
    console.error(`Error submitting essay ${essayId} for grading:`, error);
    res.status(500).json({ message: 'Failed to submit essay for grading' });
  }
});

module.exports = router;
