// Re-export extensions for easier importing
export { StrikeThroughExtension } from './StrikeThroughExtension';
export { HighlightExtension } from './HighlightExtension';
export { ChatBubbleExtension } from './ChatBubbleExtension';

// Re-export interfaces
export type { StrikeThroughRange } from './strikeThroughInterface';
export type { Highlight } from './highlightInterface';

// Re-export plugin logic
export { strikeThroughPluginKey } from './StrikeThroughPluginLogic';
export { highlightPluginKey } from './HighlightPluginLogic';

// Note: We can't re-export the TiptapEditor component itself or its handle type
// as it would create circular references.
// Import TiptapEditor and its handle type directly from the component file instead.
