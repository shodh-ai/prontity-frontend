import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    // Log information about the API key
    const apiKeyStatus = {
      defined: !!apiKey,
      length: apiKey?.length || 0,
      prefix: apiKey?.substring(0, 5) || 'none',
    };
    
    // Test a simple text generation to verify the API key works
    const genAI = new GoogleGenerativeAI(apiKey || '');
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    let textGeneration: { success: boolean; error: string | null; response: string | null } = { success: false, error: null, response: null };
    try {
      const result = await model.generateContent("Say hello to the world");
      textGeneration.success = true;
      textGeneration.response = result.response.text();
    } catch (err: any) {
      textGeneration.error = err.message || 'Unknown error';
    }
    
    // Test the image generation model
    const imageModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    let imageGeneration = { success: false, error: null, modelAvailable: true };
    try {
      // Use the exact format we're using in the main endpoint
      const result = await imageModel.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ text: "Draw a simple cat" }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        }
      } as any);
      
      imageGeneration.success = true;
      // We don't return the full image here to avoid large response
      imageGeneration.modelAvailable = true;
    } catch (err: any) {
      imageGeneration.error = err.message;
      
      // Check if this is a model not available error
      if (err.message && (
          err.message.includes("not found") || 
          err.message.includes("invalid model") ||
          err.message.includes("not available"))) {
        imageGeneration.modelAvailable = false;
      }
    }
    
    // Return diagnostic information
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      apiKeyStatus,
      textGeneration,
      imageGeneration,
      suggestedFix: !apiKey ? "Add GOOGLE_API_KEY to your .env.local file" : 
                   !imageGeneration.modelAvailable ? "The gemini-2.0-flash-exp model may not be available with your API key. Try using a model that's available with your API key." :
                   "Check the detailed error message"
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
