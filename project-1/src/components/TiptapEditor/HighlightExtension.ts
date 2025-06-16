import { Extension, Editor, RawCommands } from '@tiptap/core';
import { createHighlightPlugin, highlightPluginKey } from './HighlightPluginLogic';
import { Highlight } from './highlightInterface';

// --- MODULE AUGMENTATION FOR TIPTAP COMMANDS ---
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlightExtension: {
      setHighlights: (highlights: Highlight[]) => ReturnType;
      setActiveHighlight: (highlightId: string | number | null) => ReturnType;
      updateHighlightState: (highlights: Highlight[], activeId: string | number | null) => ReturnType;
    }
  }
}
// --- END MODULE AUGMENTATION ---

// Define options for the Tiptap extension (if any are needed later)
export interface HighlightExtensionOptions {
  // Callback for when a general highlight is clicked in the editor
  onHighlightClick?: (highlightId: string | number) => void;
  // Callback for when a 'text_suggestion' highlight is clicked
  onTextSuggestionClick?: (highlight: Highlight) => void;
}

// Create the Tiptap Extension
export const HighlightExtension = Extension.create<HighlightExtensionOptions>({
  name: 'highlightExtension',

  // --- Add the ProseMirror Plugin ---
  addProseMirrorPlugins() {
    return [
      createHighlightPlugin({
        onHighlightClick: this.options.onHighlightClick,
        onTextSuggestionClick: this.options.onTextSuggestionClick, // Pass the new callback
        // onSuggestionAccept is part of HighlightPluginLogic's internal wiring for now, not directly set from here unless a specific need arises
      }),
    ];
  },

  // --- Add Commands (Optional but Recommended) ---
  // Commands allow interacting with the plugin's state via transactions
  addCommands() {
    return {
      setHighlights: (highlights: Highlight[]) => ({ tr, dispatch }) => {
        if (dispatch) {
          // Dispatch a transaction with metadata for the plugin
          dispatch(tr.setMeta(highlightPluginKey, { highlightData: highlights }));
        }
        return true;
      },
      setActiveHighlight: (highlightId: string | number | null) => ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(tr.setMeta(highlightPluginKey, { activeHighlightId: highlightId }));
        }
        return true;
      },
      // Command to update both simultaneously
      updateHighlightState: (highlights: Highlight[], activeId: string | number | null) => ({ tr, dispatch }) => {
        if (dispatch) {
          dispatch(tr.setMeta(highlightPluginKey, {
            highlightData: highlights,
            activeHighlightId: activeId
          }));
        }
        return true;
      },
    };
  },

  // addOptions() {
  //   return {
  //     // Default options here
  //   };
  // },
});
