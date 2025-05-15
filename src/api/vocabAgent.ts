/**
 * VocabAgent API - Direct communication with the Vocabulary Teacher Agent
 */

/**
 * Generate an image directly from the provided prompt
 * This bypasses the need to extract metadata from LiveKit messages
 */
export async function generateImageFromPrompt(prompt: string, word: string) {
  try {
    console.log(`[VocabAgent API] Generating image for "${word}" with prompt: ${prompt}`);
    
    // Call the Gemini API endpoint directly
    const response = await fetch('/api/ai/gemini-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        context: word
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[VocabAgent API] Error generating image:', error);
    throw error;
  }
}

/**
 * Send a direct request to the vocab teacher agent
 */
export async function sendRequestToVocabAgent(transcript: string) {
  try {
    // This would connect directly to your vocab_teacher_agent.py
    // Change the URL if your agent is running on a different port/host
    const response = await fetch('http://localhost:5005/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Check if we got an image generation action
    if (result.action === 'generate_image' && result.payload) {
      const { prompt, word } = result.payload;
      
      // Generate the image
      const imageResult = await generateImageFromPrompt(prompt, word);
      return {
        ...result,
        imageGenerated: true,
        imageData: imageResult.imageData
      };
    }
    
    return result;
  } catch (error) {
    console.error('[VocabAgent API] Error sending request:', error);
    throw error;
  }
}
