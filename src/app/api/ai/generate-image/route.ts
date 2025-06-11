import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the API with Google API key
const apiKey = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { prompt } = body;

    // Validate inputs
    if (!prompt) {
      return NextResponse.json(
        { success: false, message: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Get the model
    const modelName = 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`Generating image with prompt: ${prompt}`);

    // Call the Gemini API with text-to-image prompt
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    // Check if we have an image part in the response
    const parts = response.candidates?.[0]?.content?.parts || [];
    let imageData = null;
    
    for (const part of parts) {
      if ('inlineData' in part && part.inlineData) {
        imageData = part.inlineData.data;
        break;
      }
    }

    if (!imageData) {
      console.log('No image data found in response');
      return NextResponse.json({
        success: false,
        message: 'Failed to generate image'
      }, { status: 500 });
    }

    // Return the image data
    return NextResponse.json({
      success: true,
      imageData
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error generating image'
    }, { status: 500 });
  }
}
