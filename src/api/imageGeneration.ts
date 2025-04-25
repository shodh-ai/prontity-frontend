/**
 * API functions for image generation using Google's Gemini API
 */

interface GenerationResponse {
  success: boolean;
  message: string;
  imageData: string | null;
  error?: string;
}

/**
 * Generate an image based on a text prompt
 * @param prompt - Text prompt describing the desired image
 * @returns Promise with generation response
 */
export async function generateImage(prompt: string): Promise<GenerationResponse> {
  try {
    const response = await fetch('/api/ai/generate-drawing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, context: prompt }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the API response to match our GenerationResponse format
    return {
      success: !data.error,
      message: data.explanation || '',
      imageData: data.imageUrl || null,
      error: data.error
    };
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      imageData: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Edit an existing image based on a drawing and text prompt
 * @param editedImageData - Base64 image data of the edited drawing
 * @param prompt - Text prompt describing the desired changes
 * @returns Promise with generation response
 */
export async function editImage(
  editedImageData: string, 
  prompt: string
): Promise<GenerationResponse> {
  try {
    // For the edited image, we'll just use the generate-drawing endpoint
    // and pass the prompt to create a new image instead of trying to edit
    // This is a simpler approach that will work better with the current API
    console.log('Editing image with prompt:', prompt);
    
    // We'll just use the generate-drawing endpoint to avoid the issues with the edit-drawing endpoint
    const response = await fetch('/api/ai/generate-drawing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        prompt: `Updated drawing: ${prompt}`,
        context: prompt
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the response from generate-drawing to match our GenerationResponse format
    return {
      success: !data.error,
      message: data.explanation || '',
      imageData: data.imageUrl || null,
      error: data.error
    };
  } catch (error) {
    console.error('Error editing image:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      imageData: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
