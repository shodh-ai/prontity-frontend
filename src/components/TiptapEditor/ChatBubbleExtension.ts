import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface ChatBubbleExtensionOptions {
  targetWord: string;
  bubbleIdPrefix: string; // To create unique IDs for bubble mount points
}

export const ChatBubblePluginKey = new PluginKey('chatBubble');

export const ChatBubbleExtension = Extension.create<ChatBubbleExtensionOptions>({
  name: 'chatBubble',

  addOptions() {
    return {
      targetWord: 'Hello',
      bubbleIdPrefix: 'chat-bubble-widget-',
    };
  },

  addProseMirrorPlugins() {
    const { targetWord, bubbleIdPrefix } = this.options;

    return [
      new Plugin({
        key: ChatBubblePluginKey,
        state: {
          init: (_, { doc }) => {
            const decorations: Decoration[] = [];
            let count = 0;
            doc.descendants((node, pos) => {
              if (node.isText) {
                let index = node.text?.indexOf(targetWord);
                while (index !== undefined && index >= 0) {
                  const from = pos + index;
                  const to = from + targetWord.length;
                  const bubbleId = `${bubbleIdPrefix}${count++}`;
                  
                  decorations.push(
                    Decoration.widget(to, () => { // Place widget at the end of the word
                      const span = document.createElement('span');
                      span.id = bubbleId;
                      span.className = 'chat-bubble-anchor'; // For potential styling or identification
                      span.style.position = 'relative';
                      span.style.display = 'inline-block'; // Or 'inline', test which works best
                      // The span itself is invisible, it's just a mount point
                      // The React ChatBubble component will be portalled into this span
                      return span;
                    })
                  );
                  index = node.text?.indexOf(targetWord, index + 1);
                }
              }
            });
            return DecorationSet.create(doc, decorations);
          },
          apply: (tr, oldDecorationSet, oldState, newState) => {
            if (!tr.docChanged) {
              return oldDecorationSet;
            }
            // Similar logic to init to update decorations on document change
            const decorations: Decoration[] = [];
            let count = 0;
            newState.doc.descendants((node, pos) => {
              if (node.isText) {
                let index = node.text?.indexOf(targetWord);
                while (index !== undefined && index >= 0) {
                  const from = pos + index;
                  const to = from + targetWord.length;
                  const bubbleId = `${bubbleIdPrefix}${count++}`;
                  decorations.push(
                    Decoration.widget(
                      to,
                      () => { // toDOM function: responsible for creating the widget's DOM structure
                        const span = document.createElement('span');
                        span.id = bubbleId; // bubbleId is from the outer scope
                        span.className = 'chat-bubble-anchor';
                        span.style.position = 'relative'; // For portal positioning context
                        span.style.display = 'inline-block';
                        span.style.cursor = 'pointer';
                        // Visual debugging: make the clickable area visible
                        span.style.backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Brighter yellow
                        span.style.border = '1px dotted orange';
                        span.style.padding = '0 2px'; // Give it some dimension
                        // span.textContent = '🎯'; // Uncomment for an explicit visual marker
                        console.log(`[ChatBubbleExtension] Creating widget span (toDOM) for ID: ${bubbleId}`);
                        return span;
                      },
                      { // WidgetDecorationSpec object
                        // side: -1, // Optional: influences cursor behavior around the widget
                        stopEvent: (event: Event) => {
                          if (event.type === 'click' || event.type === 'mousedown') {
                            console.log(`[ChatBubbleExtension] stopEvent: Caught ${event.type} for bubbleId: ${bubbleId}. Target:`, event.target);
                            
                            // Crucial: Prevent ProseMirror from handling this event further
                            event.preventDefault();
                            event.stopPropagation();

                            const customEvent = new CustomEvent('chat-bubble-anchor-click', {
                              detail: { bubbleId }, // bubbleId from the outer scope
                              bubbles: true,
                              composed: true
                            });
                            document.dispatchEvent(customEvent);
                            console.log(`[ChatBubbleExtension] stopEvent: Dispatched 'chat-bubble-anchor-click' for ${bubbleId}`);
                            return true; // Signify that we've handled this event
                          }
                          return false; // Let ProseMirror handle other events
                        },
                        ignoreSelection: true, // Recommended for widgets that shouldn't affect editor selection
                      }
                    )
                  );
                  index = node.text?.indexOf(targetWord, index + 1);
                }
              }
            });
            return DecorationSet.create(newState.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
