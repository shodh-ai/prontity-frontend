import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the API with Google API key
const apiKey = process.env.GOOGLE_API_KEY || '';
console.log('API Key available:', !!apiKey);

if (apiKey) {
  console.log('API Key first 5 chars:', apiKey.substring(0, 5));
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!apiKey) {
      console.error('No Google API key found in environment variables');
      return NextResponse.json(
        { success: false, message: 'API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { prompt, drawingData } = body;

    // Validate inputs
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
    console.log('API Key present:', !!apiKey);
    console.log('API Key first 5 chars:', apiKey.substring(0, 5));
    
    try {
      // Let's use a more widely available model that's more reliable
      const modelName = 'gemini-1.5-flash'; // More stable than 2.0-flash-exp
      console.log('Using model:', modelName);
      
      const model = genAI.getGenerativeModel({
        model: modelName,
      });
      
      // Create request content
      const contents = [
        {
          role: 'USER',
          parts: [{ inlineData: { data: drawingData, mimeType: 'image/png' } }],
        } as any,
        {
          role: 'USER',
          text: prompt,
        } as any,
      ];
      
      console.log('Sending request to Gemini model');
      
      try {
        // Generate content with a simpler approach
        const result = await model.generateContent(contents);
        console.log('Received response from Gemini');
        
        // Log the response structure for debugging
        console.log('Response structure:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
      
        // Process the response
        const response = {
          success: true,
          message: '',
          imageData: null as string | null,
        };
        
        // Extract data from response
        if (result.response?.candidates && result.response.candidates.length > 0) {
        const parts = result.response.candidates[0].content.parts;
        
        for (const part of parts) {
          if ('text' in part && part.text) {
            response.message = part.text;
            console.log('Text response:', part.text.substring(0, 100) + '...');
          } else if ('inlineData' in part && part.inlineData) {
            const inlineDataContent = part.inlineData.data;
            if (typeof inlineDataContent === 'string') {
              // Construct a data URL for the frontend to use directly
              response.imageData = `data:${part.inlineData.mimeType};base64,${inlineDataContent}`;
              console.log('Image data received, length:', inlineDataContent.length);
            } else {
              console.log('Warning: direct-edit-drawing inlineData.data was present but not a string. Actual data:', inlineDataContent);
            }
          }
        }
      }
      
        if (!response.imageData) {
          console.log('No image data found in the response');
          return NextResponse.json({
            success: false,
            message: 'No image was generated. Please try with a different prompt.'
          }, { status: 500 });
        }
        
        return NextResponse.json(response);
      } catch (modelError) {
        console.error('Error calling model.generateContent:', modelError);
        if (modelError instanceof Error) {
          console.error('Model error message:', modelError.message);
          console.error('Model error name:', modelError.name);
          console.error('Model error stack:', modelError.stack);
        }
        
        return NextResponse.json({
          success: false,
          message: `Model generation error: ${modelError instanceof Error ? modelError.message : String(modelError)}`
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}` 
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
