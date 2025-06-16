import { NextResponse } from 'next/server';

// Define types for global variables
import { Highlight } from '@/components/TiptapEditor/highlightInterface';

declare global {
  var currentHighlights: Highlight[] | undefined;
  var activeHighlightId: string | number | null | undefined;
}

// Access to globally stored highlights
if (typeof globalThis.currentHighlights === 'undefined') {
  globalThis.currentHighlights = [];
}

if (typeof globalThis.activeHighlightId === 'undefined') {
  globalThis.activeHighlightId = null;
}

/**
 * API endpoint to get current highlights and active highlight ID
 * The agent uses this to synchronize with the frontend's state
 */
export async function GET() {
  try {
    // Get current state
    const currentHighlights = globalThis.currentHighlights || [];
    const activeHighlightId = globalThis.activeHighlightId;
    
    return NextResponse.json({
      success: true,
      highlights: currentHighlights,
      activeHighlightId,
      remainingCount: currentHighlights.filter((h: Highlight & { explained?: boolean }) => !h.explained).length
    });
    
  } catch (error) {
    console.error('Error retrieving highlights:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing request' }, 
      { status: 500 }
    );
  }
}
