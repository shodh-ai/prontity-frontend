// backend/src/worker.js
require('dotenv').config();
const { Worker } = require('bullmq');
const { connection, queueName } = require('./config/queue');
const db = require('./config/db');
const OpenAI = require('openai');
const { getTextFromTiptapJson } = require('./utils/tiptapUtils');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = 'gpt-4o-mini';

/**
 * Grades an essay using OpenAI and the TOEFL rubric
 * @param {string} essayText - Plain text of the essay to grade
 * @returns {Promise<{score: number, feedback: Object}>} The grading results
 */
async function gradeEssay(essayText) {
  if (!essayText || essayText.trim().length === 0) {
    console.log('Essay text is empty, cannot grade.');
    throw new Error('Essay text is empty');
  }

  const systemPrompt = `You are an expert English essay evaluator following the TOEFL Independent Writing Task rubric.
Evaluate the given essay on the following criteria:
1. Overall quality (0-30 scale)
2. Task completion and response development
3. Organization and coherence 
4. Language use (grammar, vocabulary)
5. Mechanics (spelling, punctuation)

Provide feedback in a structured format as a valid JSON object with the following properties:
- score: A numeric score from 0-30
- feedback: An object containing:
  - overall_assessment: A brief summary of the essay's strengths and weaknesses
  - task_completion: Feedback on how well the essay addresses the prompt and develops ideas
  - organization: Feedback on essay structure, flow, and coherence
  - language_use: Feedback on grammar, vocabulary, and language proficiency
  - mechanics: Feedback on spelling, punctuation, and formatting

Your response should be ONLY the JSON object with no other text.`;

  try {
    console.log(`Sending ${essayText.length} characters to ${AI_MODEL} for grading...`);
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: essayText }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more consistent scoring
    });

    const responseContent = completion.choices[0]?.message?.content;
    console.log("Raw OpenAI grading response:", responseContent);

    if (!responseContent) {
      throw new Error('Empty response content from OpenAI');
    }

    // Parse the response
    let gradeResult;
    try {
      gradeResult = JSON.parse(responseContent);
      
      // Basic validation of the grading result
      if (typeof gradeResult.score !== 'number' || !gradeResult.feedback) {
        throw new Error('Invalid grading result format from OpenAI');
      }
      
      // Ensure score is within range 0-30
      gradeResult.score = Math.min(Math.max(Math.round(gradeResult.score), 0), 30);
      
    } catch (parseError) {
      console.error("Failed to parse JSON response from OpenAI:", parseError);
      console.error("Raw response content:", responseContent);
      throw new Error(`Failed to parse grading result from OpenAI: ${parseError.message}`);
    }

    console.log(`Essay graded with score: ${gradeResult.score}/30`);
    return gradeResult;

  } catch (error) {
    console.error('Error calling OpenAI API for grading:', error.message);
    if (error.response) {
      console.error('API Error Status:', error.response.status);
      console.error('API Error Data:', error.response.data);
    }
    throw new Error(`Failed to grade essay with OpenAI: ${error.message}`);
  }
}

// Create a BullMQ Worker to process jobs
const gradingWorker = new Worker(queueName, async (job) => {
  console.log(`Processing grading job ${job.id} for essay ${job.data.essayId}...`);
  const { essayId } = job.data;
  
  if (!essayId) {
    throw new Error('Essay ID missing from job data');
  }
  
  try {
    // 1. Fetch the essay content from the database
    const essayResult = await db.query(
      'SELECT content FROM essays WHERE id = $1',
      [essayId]
    );
    
    if (essayResult.rows.length === 0) {
      throw new Error(`Essay with ID ${essayId} not found`);
    }
    
    const essayContentJson = essayResult.rows[0].content;
    
    // 2. Convert the Tiptap JSON to plain text
    const essayPlainText = getTextFromTiptapJson(essayContentJson);
    
    // 3. Call grading function
    const gradeResult = await gradeEssay(essayPlainText);
    
    // 4. Store the results in the database
    await db.query(
      'INSERT INTO grades (essay_id, score, feedback, graded_at) VALUES ($1, $2, $3, NOW()) ' +
      'ON CONFLICT (essay_id) DO UPDATE SET score = $2, feedback = $3, graded_at = NOW()',
      [essayId, gradeResult.score, gradeResult.feedback]
    );
    
    console.log(`Essay ${essayId} graded successfully with score ${gradeResult.score}/30`);
    return { success: true, essayId, score: gradeResult.score };
    
  } catch (error) {
    console.error(`Error grading essay ${essayId}:`, error);
    throw error; // Let BullMQ handle the error
  }
}, { connection });

// Log events from the worker
gradingWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

gradingWorker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

console.log(`Essay grading worker started and connected to queue: ${queueName}`);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down grading worker...');
  await gradingWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down grading worker...');
  await gradingWorker.close();
  process.exit(0);
});
