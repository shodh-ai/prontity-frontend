import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
// Use exactly the model specified by the user
const modelName = 'gemini-2.0-flash-exp';

console.log('API Key present:', !!process.env.GOOGLE_API_KEY);

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { prompt: userPrompt, context } = body;
    
    if (!userPrompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Initialize the model
    const model = genAI.getGenerativeModel({
      model: modelName,
    });

    // Prepare input with context about the vocabulary word
    const enhancedPrompt = `Draw a simple, minimal doodle representing: ${userPrompt}. 
      This drawing will help a student learning English remember the word "${context}".
      Make it simple and clear, like a line drawing or sketch.`;

    // Configure for image generation - make sure we're using the proper types
    console.log('Sending prompt to Gemini:', enhancedPrompt);
    
    // Specifically request image generation with the proper parameters
    let responseData;
    try {
      // Use the API in a way compatible with the current version, requesting image output
      // See: https://ai.google.dev/gemini-api/docs/multimodal#text-to-image-from-api
      console.log('Using model:', modelName);
      // Using exact format from the example code
      console.log('Attempting to generate content with model', modelName);
      // Use a type assertion to bypass TypeScript errors while using the exact format
      const result = await model.generateContent({
        // Format the contents as specified
        contents: [{ 
          role: 'user', 
          parts: [{ text: enhancedPrompt }]
        }],
        // Use any to bypass TypeScript checking
        generationConfig: {
          // Use exact responseModalities format from example
          responseModalities: ['TEXT', 'IMAGE'],
        }
      } as any); // Type assertion to bypass strict checking
      responseData = result.response;
      
      // Log the full response structure for debugging
      console.log('Response structure:', JSON.stringify(responseData).substring(0, 200) + '...');
      console.log('Received response from Gemini');
    } catch (genError: any) { // Use any for simplicity here
      console.error('Gemini API error:', genError);
      return NextResponse.json(
        { error: `Gemini API error: ${genError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
    
    // Extract image from the response
    let imageData = null;
    let explanationText = '';
    
    // Add null checks to avoid TypeScript errors
    if (responseData?.candidates && responseData.candidates.length > 0 && responseData.candidates[0].content.parts) {
      console.log('Parsing response parts, count:', responseData.candidates[0].content.parts?.length || 0);
      
      for (const part of responseData.candidates[0].content.parts) {
        if (part.inlineData) {
          console.log('Found inline data with mime type:', part.inlineData.mimeType);
          imageData = part.inlineData;
        } else if (part.text) {
          console.log('Found text response');
          explanationText = part.text;
        }
      }
    } else {
      console.error('Invalid response structure from Gemini API');
    }

    if (!imageData) {
      console.error('No image data found in the response');
      return NextResponse.json(
        { error: 'No image was generated in the response' },
        { status: 500 }
      );
    }

    console.log('Creating data URL with mime type:', imageData.mimeType);
    // Create a data URL from the inline data
    const imageUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
    
    // Return the image data and dimensions
    console.log('Returning successful response with image data');
    return NextResponse.json({
      imageId: `ai-img-${Date.now()}`,
      imageUrl,
      width: 300,  // Default width
      height: 200, // Default height
      explanation: explanationText
    });
    
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error during image generation' },
      { status: 500 }
    );
  }
}
