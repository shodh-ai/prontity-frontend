import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { StrikeThroughRange } from './strikeThroughInterface';

/**
 * Creates a Tiptap extension that handles strikethrough text ranges.
 */
export const StrikeThroughExtension = Extension.create({
  name: 'strikeThrough',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'strikethrough-extension',
      },
      onStrikeThroughClick: (id: string) => {
        console.log('StrikeThrough clicked:', id);
      },
    };
  },

  addProseMirrorPlugins() {
    const { onStrikeThroughClick } = this.options;
    
    // Create a unique plugin key
    const strikeThroughPluginKey = new PluginKey('strikeThrough');

    return [
      new Plugin({
        key: strikeThroughPluginKey,
        props: {
          // Handle clicks on strikethrough decorations
          handleClick(view, pos) {
            const { state } = view;
            const decorations = strikeThroughPluginKey.getState(state);
            
            if (!decorations) return false;
            
            // Find if click was on a strikethrough decoration
            // DecorationSet doesn't have find().find(), we need to iterate over the decorations
            let clickedDecoration: any = null;
            
            // Use safer approach with forEach to avoid type issues
            decorations.find(pos, pos).forEach((decoration: any) => {
                // Type guard check to ensure decoration has the required properties
                if (decoration && 
                    typeof decoration.from === 'number' && 
                    typeof decoration.to === 'number' && 
                    decoration.type && 
                    decoration.type.spec && 
                    decoration.type.spec.strikeThrough === true && 
                    pos >= decoration.from && 
                    pos <= decoration.to) {
                  
                  clickedDecoration = decoration;
                }
              }
            );
            
            if (clickedDecoration) {
              const id = clickedDecoration.type.spec.strikeThroughId;
              if (id && onStrikeThroughClick) {
                onStrikeThroughClick(id);
                return true; // Handled click
              }
            }
            
            return false; // Not handled, let other plugins or default behavior handle it
          },
          
          // Add decorations for strikethrough ranges
          decorations(state) {
            const { doc } = state;
            const strikeThroughData = this.getState(state);
            
            if (!strikeThroughData || !strikeThroughData.ranges || !strikeThroughData.ranges.length) {
              return DecorationSet.empty;
            }
            
            const decorations: Decoration[] = [];
            
            strikeThroughData.ranges.forEach((range: { id?: string; start: number; end: number; type?: string; message?: string }) => {
              if (typeof range.start !== 'number' || typeof range.end !== 'number') {
                console.warn('Invalid strikethrough range:', range);
                return;
              }
              
              try {
                // Check if the start and end positions are valid in the document
                if (range.start < 0 || range.end > doc.content.size) {
                  console.warn(
                    `StrikeThrough range out of bounds: (${range.start}, ${range.end}). Document size: ${doc.content.size}`
                  );
                  return;
                }
                
                const className = `strikethrough-text ${range.type || 'default-strikethrough'}`;
                
                decorations.push(
                  Decoration.inline(range.start, range.end, {
                    class: className,
                    'data-strikethrough-id': range.id,
                    style: 'text-decoration: line-through;',
                    title: range.message || 'Strikethrough text'
                  }, 
                  {
                    strikeThrough: true, // Mark as a strikethrough decoration
                    strikeThroughId: range.id // Store the ID for click handling
                  })
                );
              } catch (e) {
                console.error('Error creating strikethrough decoration:', e);
              }
            });
            
            return DecorationSet.create(doc, decorations);
          }
        },
        
        state: {
          // Initialize with empty state
          init() {
            return { ranges: [] };
          },
          
          // Apply changes to state when transaction is applied
          apply(tr, value) {
            // Get the meta data with strikethrough ranges if it exists
            const meta = tr.getMeta(strikeThroughPluginKey);
            
            if (meta && meta.ranges) {
              return { ranges: meta.ranges };
            }
            
            // Otherwise keep current state
            return value;
          }
        }
      })
    ];
  },
});

// Helper function to create a plugin with the ranges
export function createStrikeThroughPlugin(ranges: StrikeThroughRange[] = [], activeId: string | null = null) {
  return {
    key: new PluginKey('strikeThroughRanges'),
    ranges,
    activeId
  };
}
