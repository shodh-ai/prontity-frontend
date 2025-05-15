import { NextResponse } from 'next/server';

// Define types for global variables
declare global {
  var pendingHighlightActions: Array<{ highlightId: string; action: string; timestamp: number }> | undefined;
}

// Access the globally stored pending actions
if (typeof globalThis.pendingHighlightActions === 'undefined') {
  globalThis.pendingHighlightActions = [];
}

/**
 * API endpoint to check for pending highlight control actions
 * The frontend polls this endpoint to see if the agent has requested highlight changes
 * This follows the same pattern as the image generation system
 */
export async function GET() {
  try {
    // Get all pending actions
    const pendingActions = globalThis.pendingHighlightActions || [];
    
    // Clear the queue after retrieving them
    globalThis.pendingHighlightActions = [];
    
    return NextResponse.json({
      success: true,
      pendingActions
    });
    
  } catch (error) {
    console.error('Error checking highlight controls:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing request' }, 
      { status: 500 }
    );
  }
}
