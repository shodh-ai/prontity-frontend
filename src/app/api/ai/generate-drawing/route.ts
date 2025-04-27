import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
// Use the specific model that supports image generation
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
      // Using the gemini-2.0-flash-exp model with image generation capability
      console.log('Attempting to generate image with model', modelName);
      console.log('API Key first 5 chars:', process.env.GOOGLE_API_KEY?.substring(0, 5) || 'none');
      
      // Using the correct format for Gemini API
      const result = await model.generateContent({
        contents: [{ 
          role: 'user',
          parts: [{ text: enhancedPrompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.4,
          topK: 32,
          topP: 1,
        }
      } as any);
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
    
    // Extract image and text from the response
    let imageData = null;
    let explanationText = '';
    
    // Dump the raw structure to help with debugging
    console.log('Response structure:', JSON.stringify(responseData).substring(0, 500));
    
    // Process the response to find image data and text - following the co-drawing example pattern
    if (responseData?.candidates && responseData.candidates.length > 0 && responseData.candidates[0].content?.parts) {
      const parts = responseData.candidates[0].content.parts;
      console.log('Parsing response parts, count:', parts?.length || 0);
      
      for (const part of parts) {
        // Based on the part type, either get the text or image data
        if (part.text) {
          console.log('Found text response, first 50 chars:', part.text.substring(0, 50));
          explanationText += part.text;
        } else if (part.inlineData) {
          console.log('Found inline data with mime type:', part.inlineData.mimeType);
          imageData = part.inlineData;
        }
      }
    } else {
      console.error('Invalid response structure from Gemini API');
      console.log('Full response for debugging:', JSON.stringify(responseData));
    }

    // Handle the case where we got a text response but no image
    // This commonly happens with content policy restrictions
    let imageUrl;
    let explanation = explanationText;
    
    if (imageData) {
      console.log('Creating data URL with mime type:', imageData.mimeType);
      // Create a data URL from the inline data
      imageUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
    } else {
      // Check if we have text indicating content policy issues
      if (explanationText && (
          explanationText.includes("unable to") ||
          explanationText.includes("can't") ||
          explanationText.includes("cannot") ||
          explanationText.includes("sorry")
        )) {
        console.log('Content policy restriction detected, using placeholder');
        explanation = "I couldn't generate that image. Please try a different prompt.";
        // Create a friendly placeholder with the explanation
        const safeText = encodeURIComponent("Please try a different prompt");
        imageUrl = `https://placehold.co/600x400/eee/777?text=${safeText}`;
      } else if (explanationText) {
        // We have text but no image for some other reason
        console.log('No image data found but have text, using text-based placeholder');
        const safeText = encodeURIComponent(explanationText.substring(0, 30));
        imageUrl = `https://placehold.co/600x400/lightblue/darkblue?text=${safeText}`;
      } else {
        // No text or image - this is a true error
        console.error('No image data or text found in the response');
        return NextResponse.json(
          { error: 'No content was generated in the response' },
          { status: 500 }
        );
      }
    }
    
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
