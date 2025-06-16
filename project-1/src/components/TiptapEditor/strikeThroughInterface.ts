export interface StrikeThroughRange {
  id: string; // Unique identifier for the strikethrough
  start: number; // Start position (ProseMirror index)
  end: number; // End position (ProseMirror index)
  type: string; // Type of strikethrough (e.g., 'deletion-suggestion', 'error-mark')
  message?: string; // Optional message/comment associated with the strikethrough
  // Add other properties as needed, e.g., for styling or interaction
}
