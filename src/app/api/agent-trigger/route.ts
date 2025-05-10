import { NextResponse } from 'next/server';
import { addImage } from '../check-images/route';

interface AgentRequestLog {
  timestamp: number;
  source: string;
  action: string;
  word: string;
  promptLength: number;
  success: boolean;
  imageId?: string;
  error?: string;
}

// Request log to track requests and prevent duplicates
const requestLog: AgentRequestLog[] = [];

// This endpoint receives direct requests from the agent
// and generates images to be picked up by the frontend
export async function POST(request: Request) {
  try {
    // Get client information
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const source = `${ip.split(',')[0]}-${userAgent.substring(0, 20)}`;
    
    const data = await request.json();
    
    // Extract the action and payload from the request
    const { action, word, prompt, requestId } = data;
    
    if (!action || !word) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // Generate a request ID if not provided
    const effectiveRequestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Log the received trigger
    console.log(`Agent Trigger API received: ${action} for word: ${word} (${effectiveRequestId})`);
    
    // Check for duplicate requests in the last 30 seconds
    const now = Date.now();
    const recentDuplicate = requestLog.find(entry => 
      entry.word === word && 
      entry.action === action && 
      now - entry.timestamp < 30000 && // within last 30 seconds
      entry.success === true // only consider successful requests
    );
    
    if (recentDuplicate) {
      console.log(`Duplicate request detected for "${word}", reusing imageId: ${recentDuplicate.imageId}`);
      return NextResponse.json({ 
        success: true, 
        message: `Image already generated for "${word}"`,
        imageId: recentDuplicate.imageId,
        reused: true
      });
    }
    
    // Handle image generation
    if (action === 'generate_image' && prompt) {
      try {
        console.log(`Generating image for "${word}" with prompt: ${prompt.substring(0, 50)}...`);
        
        // Call the Gemini API to generate the image
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/gemini-generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': effectiveRequestId
          },
          body: JSON.stringify({
            prompt,
            context: word
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Error from Gemini API: ${response.status}`);
        }
        
        // Process the response
        const result = await response.json();
        
        if (result.imageData) {
          // Add the generated image to the queue for frontend to pick up
          const imageId = addImage(word, prompt, result.imageData);
          
          // Log the request
          requestLog.push({
            timestamp: now,
            source,
            action,
            word,
            promptLength: prompt.length,
            success: true,
            imageId
          });
          
          // Keep the log at a reasonable size
          if (requestLog.length > 100) {
            requestLog.splice(0, 50); // Remove oldest 50 entries when we hit 100
          }
          
          console.log(`Successfully added image for "${word}" to queue with ID: ${imageId}`);
          
          return NextResponse.json({ 
            success: true, 
            message: `Image generated for "${word}"`,
            imageId,
            requestId: effectiveRequestId
          });
        } else {
          throw new Error('No image data in response');
        }
      } catch (error) {
        // Log the failed request
        requestLog.push({
          timestamp: now,
          source,
          action,
          word,
          promptLength: prompt.length,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        console.error('Error generating image:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Error generating image',
          requestId: effectiveRequestId
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Request processed but no action taken',
      requestId: effectiveRequestId
    });
  } catch (error) {
    console.error('Error in agent-trigger API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      errorDetails: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
