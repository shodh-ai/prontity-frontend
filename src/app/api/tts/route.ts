import { NextRequest, NextResponse } from 'next/server';

// Configure CORS headers for the API response
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Deepgram API endpoint for TTS
const DEEPGRAM_TTS_API_URL = 'https://api.deepgram.com/v1/speak';

export async function POST(req: NextRequest) {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    // Check if API key is available
    if (!apiKey) {
      console.error('Deepgram API key not found in environment variables');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500, headers: corsHeaders }
      );
    }
    
    // Parse the request body
    const body = await req.json();
    const { text, voice = 'aura-professional' } = body;
    
    // Validate the request
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log(`TTS API: Processing request for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // Call the Deepgram TTS API with the EXACT format they expect
    // IMPORTANT: Deepgram expects ONLY text in the payload, not nested within a property
    const response = await fetch(`${DEEPGRAM_TTS_API_URL}?voice=${encodeURIComponent(voice)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Deepgram TTS API error: ${response.status} ${errorText}`);
      return NextResponse.json(
        { error: `TTS API error: ${response.status}`, details: errorText },
        { status: response.status, headers: corsHeaders }
      );
    }
    
    // Get the audio data
    const audioBlob = await response.blob();
    
    // Return the audio as a blob
    return new NextResponse(audioBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
      },
    });
    
  } catch (error) {
    console.error('Error in TTS API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: corsHeaders,
    status: 204,
  });
}