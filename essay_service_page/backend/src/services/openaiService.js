// backend/src/services/openaiService.js
require('dotenv').config();
const OpenAI = require('openai');

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.warn('!!! WARNING: OPENAI_API_KEY environment variable not set. AI features will not work. !!!');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = 'gpt-4o-mini'; // Using the requested model

/**
 * Calls OpenAI API to get inline suggestions for the given essay text
 * @param {string} essayText - Plain text of the essay
 * @returns {Promise<Array<{offset: number, length: number, message: string, type: string}>>} Array of suggestions
 */
async function getEssaySuggestions(essayText) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured.');
  }
  
  if (!essayText || essayText.trim().length === 0) {
    console.log('Essay text is empty, skipping analysis.');
    return []; // Return empty array if no text
  }

  const systemPrompt = `You are an expert writing assistant providing feedback on essays, similar to TOEFL scoring guidelines but focused on inline suggestions.
Analyze the provided essay text and identify specific areas for improvement related to grammar, vocabulary usage, clarity, conciseness, and sentence structure.

For each suggestion, you MUST provide:
1. The exact starting character offset (0-based index) where the issue begins in the text.
2. The exact length of the text span the suggestion refers to.
3. A concise, helpful message explaining the issue and suggesting an improvement.
4. A category type for the suggestion - use one of: "grammar", "vocabulary", "structure", "clarity", "style"

Format your response as a JSON array of objects with these exact keys: offset, length, message, type.
For example:
[
  {
    "offset": 15,
    "length": 10,
    "message": "Consider using a more formal term instead of 'nice'.",
    "type": "vocabulary"
  },
  {
    "offset": 52,
    "length": 25,
    "message": "This sentence is in passive voice. Consider using active voice for more directness.",
    "type": "style"
  }
]

If you find no issues, return an empty array: []
Be precise with the character offsets and spans to ensure suggestions are shown in the correct place.`;

  try {
    console.log(`Sending ${essayText.length} characters to ${AI_MODEL} for analysis...`);
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: essayText }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent suggestions
    });

    const responseContent = completion.choices[0]?.message?.content;
    console.log("Raw OpenAI response:", responseContent);

    if (!responseContent) {
      throw new Error('Empty response content from OpenAI');
    }

    // Parse the response - this may vary depending on how GPT-4o-mini formats its response
    let suggestions = [];
    try {
      const parsedJson = JSON.parse(responseContent);
      
      // Handle different possible response structures
      if (Array.isArray(parsedJson)) {
        suggestions = parsedJson;
      } else if (parsedJson.suggestions && Array.isArray(parsedJson.suggestions)) {
        suggestions = parsedJson.suggestions;
      } else {
        // Look for any array in the response
        const possibleArrays = Object.values(parsedJson).filter(value => Array.isArray(value));
        if (possibleArrays.length > 0) {
          suggestions = possibleArrays[0];
        } else {
          throw new Error('Could not find a suggestions array in the OpenAI response');
        }
      }
    } catch (parseError) {
      console.error("Failed to parse JSON response from OpenAI:", parseError);
      console.error("Raw response content:", responseContent);
      throw new Error(`Failed to parse suggestions from OpenAI response: ${parseError.message}`);
    }

    // Validate suggestions format
    if (!Array.isArray(suggestions)) {
      throw new Error('OpenAI response did not contain a valid JSON array');
    }

    // Basic validation of each suggestion
    const validSuggestions = suggestions.filter(s => {
      const isValid = 
        typeof s.offset === 'number' && 
        typeof s.length === 'number' && 
        typeof s.message === 'string' && 
        typeof s.type === 'string' &&
        s.length > 0;
      
      if (!isValid) {
        console.warn('Invalid suggestion format:', s);
      }
      
      return isValid;
    });

    console.log(`Received ${validSuggestions.length} valid suggestions from ${AI_MODEL}`);
    return validSuggestions;

  } catch (error) {
    console.error('Error calling OpenAI API:', error.message);
    if (error.response) {
      console.error('API Error Status:', error.response.status);
      console.error('API Error Data:', error.response.data);
    }
    throw new Error(`Failed to get suggestions from OpenAI: ${error.message}`);
  }
}

module.exports = { 
  getEssaySuggestions 
};
