// Define the structure for a single highlight object
export interface Highlight {
  id: string | number; // Unique identifier for the highlight
  start: number;       // Start position (ProseMirror index)
  end: number;         // End position (ProseMirror index)
  type: 'grammar' | 'coherence' | 'suggestion' | string; // Type of highlight (extensible)
  message?: string;    // Optional message/comment associated with the highlight
  wrongVersion?: string; // The original text that needs correction
  correctVersion?: string; // The suggested correction to replace the original text
}
