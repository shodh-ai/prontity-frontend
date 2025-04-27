import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';

// Initialize the Gemini API with the API key from environment variables
const getAI = () => {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_API_KEY in environment variables');
  }
  console.log('Using API key:', apiKey.substring(0, 5) + '...');
  return new GoogleGenAI({ apiKey });
};

export async function POST(req: NextRequest) {
  try {
    console.log('API route called');
    
    const { prompt, imageData, context } = await req.json();
    
    console.log('Request data:', { 
      hasPrompt: !!prompt, 
      hasImageData: !!imageData,
      imageDataLength: imageData ? imageData.length : 0,
      context 
    });
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const ai = getAI();
    let enhancedPrompt = prompt;
    
    // Add vocabulary context to the prompt if available
    if (context) {
      enhancedPrompt = `${prompt}. This is for the vocabulary word "${context}" and should help illustrate its meaning.`;
    }
    
    console.log('Enhanced prompt:', enhancedPrompt);

    try {
      // Handle the request differently based on whether we have image data
      if (imageData) {
        console.log('Processing image-to-image request');
        // Case: Modify existing drawing
        // Create content with both image and text
        const content = {
          role: 'user',
          parts: [
            { inlineData: { data: imageData, mimeType: 'image/png' } },
            { text: `${enhancedPrompt}. Keep the same style.` }
          ]
        };

        console.log('Calling Gemini API...');
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: [content],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });

        console.log('API response received:', {
          hasResponse: !!response,
          hasCandidates: !!response.candidates,
          candidatesLength: response.candidates?.length || 0
        });

        // Add safety checks for response structure
        if (!response.candidates || response.candidates.length === 0) {
          throw new Error('No candidates in response');
        }

        if (!response.candidates[0].content) {
          throw new Error('No content in first candidate');
        }

        // Extract the image data from the response
        let resultImageData = null;
        let resultMessage = '';
        
        console.log('Response parts count:', response.candidates[0].content.parts?.length || 0);

        for (const part of response.candidates[0].content.parts || []) {
          console.log('Processing part type:', 'text' in part ? 'text' : 'inlineData' in part ? 'inlineData' : 'unknown');
          
          if ('text' in part && part.text) {
            resultMessage = part.text;
            console.log('Found text part:', part.text.substring(0, 50) + '...');
          } else if ('inlineData' in part && part.inlineData) {
            resultImageData = part.inlineData.data;
            console.log('Found image data of length:', resultImageData.length);
          }
        }

        if (!resultImageData) {
          console.log('Warning: No image data found in response');
        }

        return NextResponse.json({
          success: true,
          imageData: resultImageData,
          message: resultMessage
        });
      } else {
        console.log('Processing text-to-image request');
        // Case: Text-to-image generation (no input image)
        const content = {
          role: 'user',
          parts: [
            { text: `Create a simple drawing that illustrates "${enhancedPrompt}". Use a minimalist line drawing style.` }
          ]
        };

        console.log('Calling Gemini API for text-to-image...');
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: [content],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });

        console.log('API text-to-image response received');

        // Extract the image data from the response
        let resultImageData = null;
        let resultMessage = '';

        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
          for (const part of response.candidates[0].content.parts || []) {
            if ('text' in part && part.text) {
              resultMessage = part.text;
            } else if ('inlineData' in part && part.inlineData) {
              resultImageData = part.inlineData.data;
              console.log('Found text-to-image data of length:', resultImageData.length);
            }
          }
        } else {
          console.log('Warning: Invalid text-to-image response structure');
        }

        return NextResponse.json({
          success: true,
          imageData: resultImageData,
          message: resultMessage
        });
      }
    } catch (apiError: any) {
      console.error('Gemini API error:', apiError);
      return NextResponse.json(
        { 
          error: apiError.message || 'Failed to generate image with Gemini API', 
          apiError: true,
          details: apiError.toString() 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to process request', 
        details: error.toString() 
      },
      { status: 500 }
    );
  }
}
