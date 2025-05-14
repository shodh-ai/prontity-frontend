import { NextResponse } from 'next/server';

// Store pending highlight actions in a global variable
// This approach is similar to how the image generation queue works
if (typeof globalThis.pendingHighlightActions === 'undefined') {
  globalThis.pendingHighlightActions = [];
}

/**
 * API endpoint to control which highlight is active
 * The speaking agent will call this to select highlights as it explains them
 */
export async function POST(req: Request) {
  try {
    const { highlightId, action } = await req.json();
    
    if (!highlightId) {
      return NextResponse.json({ success: false, error: 'Missing highlightId' }, { status: 400 });
    }
    
    // Add to the queue of pending highlight actions
    const pendingActions = globalThis.pendingHighlightActions || [];
    pendingActions.push({ 
      highlightId, 
      action: action || 'select', 
      timestamp: Date.now() 
    });
    
    globalThis.pendingHighlightActions = pendingActions;
    
    console.log(`Added highlight control action: ${action} for highlight ${highlightId}`);
    
    return NextResponse.json({ 
      success: true,
      pendingCount: pendingActions.length 
    });
    
  } catch (error) {
    console.error('Error handling highlight control request:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing request' }, 
      { status: 500 }
    );
  }
}
