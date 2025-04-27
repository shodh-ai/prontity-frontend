import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the API
const apiKey = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  console.log('Edit drawing API called');
  const hasApiKey = !!apiKey;
  console.log('API Key present:', hasApiKey);
  
  if (!hasApiKey) {
    return NextResponse.json(
      { success: false, message: 'API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Parse the request body
    const body = await req.json();
    const { prompt, drawingData } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, message: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!drawingData) {
      return NextResponse.json(
        { success: false, message: 'Drawing data is required' },
        { status: 400 }
      );
    }

    console.log(`Sending prompt to Gemini: ${prompt}`);
    
    // Configure the model
    const modelName = 'gemini-1.5-flash';
    console.log('Using model:', modelName);

    try {
      console.log('Attempting to generate image with Gemini API');
      
      // Get the model instance
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Create the prompt parts
      const imagePart = {
        inlineData: {
          mimeType: "image/png",
          data: drawingData
        }
      };
      
      const promptText = `${prompt}. Keep the same minimal line doodle style.`;
      
      // Log API key first 5 chars for debugging
      console.log('API Key first 5 chars:', apiKey ? apiKey.substring(0, 5) : 'none');
      console.log('Content parts created, sending to Gemini model');
      
      // Generate the content
      const result = await model.generateContent([imagePart, promptText]);
      
      // Create a response object
      const apiResponse = {
        success: true,
        message: '',
        imageData: null as string | null,
      };

      // Extract parts from the response
      if (result.response) {
        console.log('Gemini response received');
        
        const parts = result.response.candidates?.[0]?.content?.parts;
        
        if (parts && parts.length > 0) {
          // Process each part
          for (const part of parts) {
            if ('text' in part && part.text) {
              apiResponse.message = part.text;
              console.log('Received text response:', part.text);
            } else if ('inlineData' in part && part.inlineData) {
              const imageData = part.inlineData.data;
              console.log('Received image data, length:', imageData.length);
              apiResponse.imageData = imageData;
            }
          }
        } else {
          console.log('No parts found in the response');
        }
      } else {
        console.log('No response part found in result');
      }

      if (!apiResponse.imageData) {
        console.log('No image data found in response');
        console.log('Response structure:', JSON.stringify(result, null, 2).substring(0, 200) + '...');
      }

      return NextResponse.json(apiResponse);
    } catch (error) {
      console.error('Gemini API error:', error);
      // Print full error details for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      } else {
        console.error('Unknown error type:', typeof error);
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}
