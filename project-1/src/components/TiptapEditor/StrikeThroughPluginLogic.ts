import { Plugin, PluginKey, Transaction, EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StrikeThroughRange } from './strikeThroughInterface'; // Changed import

// Create a unique key for this plugin
export const strikeThroughPluginKey = new PluginKey<StrikeThroughPluginState>('strikeThroughPlugin'); // Renamed

// Define the state managed by this plugin
interface StrikeThroughPluginState {
  decorations: DecorationSet;
  strikeThroughData: StrikeThroughRange[]; // Renamed
  activeStrikeThroughId: string | number | null; // Renamed
  onStrikeThroughClick?: (strikeThroughId: string | number) => void; // Renamed callback for general clicks
  // We might not need specific suggestion-like interactions for basic strikethrough
  // For simplicity, we'll omit onTextSuggestionClick and onSuggestionAccept for now
  // acceptedSuggestions: Set<string | number>; // Omitted for now
  lastClickTime?: number; 
  lastClickId?: string | number; 
}

// Function to create the ProseMirror plugin
export function createStrikeThroughPlugin(options: { 
  onStrikeThroughClick?: (strikeThroughId: string | number) => void; // Renamed
} = {}) {
  return new Plugin<StrikeThroughPluginState>({
    key: strikeThroughPluginKey,

    // --- Plugin State ---
    state: {
      init() {
        return {
          decorations: DecorationSet.empty,
          strikeThroughData: [] as StrikeThroughRange[], // Renamed
          activeStrikeThroughId: null, // Renamed
          onStrikeThroughClick: options.onStrikeThroughClick, // Renamed
          lastClickTime: 0,
          lastClickId: undefined,
        };
      },

      apply(
        tr: Transaction,
        pluginState: StrikeThroughPluginState,
        oldState: EditorState,
        newState: EditorState
      ): StrikeThroughPluginState {
        const meta = tr.getMeta(strikeThroughPluginKey);

        if (meta) {
          const newStrikeThroughData = meta.strikeThroughData !== undefined ? meta.strikeThroughData : pluginState.strikeThroughData;
          const newActiveStrikeThroughId = meta.activeStrikeThroughId !== undefined ? meta.activeStrikeThroughId : pluginState.activeStrikeThroughId;
          const newOnStrikeThroughClick = meta.onStrikeThroughClick !== undefined ? meta.onStrikeThroughClick : pluginState.onStrikeThroughClick;
          const newLastClickTime = meta.lastClickTime !== undefined ? meta.lastClickTime : pluginState.lastClickTime;
          const newLastClickId = meta.lastClickId !== undefined ? meta.lastClickId : pluginState.lastClickId;
          
          console.log('StrikeThroughPluginLogic: Updating state with callback present:', !!newOnStrikeThroughClick);

          if (newStrikeThroughData !== pluginState.strikeThroughData || 
              newActiveStrikeThroughId !== pluginState.activeStrikeThroughId || 
              newOnStrikeThroughClick !== pluginState.onStrikeThroughClick ||
              newLastClickTime !== pluginState.lastClickTime ||
              newLastClickId !== pluginState.lastClickId) {
            
            const decorations = createDecorations(newState.doc, newStrikeThroughData, newActiveStrikeThroughId);
            return {
              decorations,
              strikeThroughData: newStrikeThroughData,
              activeStrikeThroughId: newActiveStrikeThroughId,
              onStrikeThroughClick: newOnStrikeThroughClick,
              lastClickTime: newLastClickTime,
              lastClickId: newLastClickId,
            };
          }
        }

        if (tr.docChanged) {
          const newDecorations = pluginState.decorations.map(tr.mapping, tr.doc);
          return {
            ...pluginState,
            decorations: newDecorations,
          };
        }
        
        return pluginState;
      },
    },

    // --- Plugin Props ---
    props: {
      decorations(state: EditorState): DecorationSet | undefined {
        return strikeThroughPluginKey.getState(state)?.decorations;
      },

      handleClickOn(view, pos, node, nodePos, event, direct) {
        const state = strikeThroughPluginKey.getState(view.state);
        const decorations = state?.decorations;
        if (!decorations) return false;
        
        console.log('StrikeThroughPluginLogic: Event detected:', event.type);

        const clickedDecorations = decorations.find(pos, pos); 
        const strikeThroughDecoration = clickedDecorations.find(d => d.spec.strikeThroughId); // Changed spec property

        if (strikeThroughDecoration) {
          const strikeThroughId = strikeThroughDecoration.spec.strikeThroughId;
          const currentTime = Date.now();
          
          const clickedStrikeThroughObject = state.strikeThroughData.find(s => s.id === strikeThroughId);

          if (!clickedStrikeThroughObject) {
            console.warn(`StrikeThroughPluginLogic: Clicked on decoration but couldn't find strikethrough data for ID: ${strikeThroughId}`);
            return false;
          }

          // Update last click info
          view.dispatch(view.state.tr.setMeta(strikeThroughPluginKey, {
            activeStrikeThroughId: strikeThroughId, 
            lastClickTime: currentTime,
            lastClickId: strikeThroughId
          }));
          
          // Handle general onStrikeThroughClick
          if (state.onStrikeThroughClick) {
            console.log(`StrikeThroughPluginLogic: General click on strikethrough ID: ${strikeThroughId}, type: ${clickedStrikeThroughObject.type}. Calling onStrikeThroughClick.`);
            state.onStrikeThroughClick(strikeThroughId);
            return true; // Handled
          }

          console.log(`StrikeThroughPluginLogic: Click on strikethrough ID: ${strikeThroughId} did not trigger a specific handler.`);
          return false; 
        }
        return false; 
      },
    },
  });
}

// --- Helpers for Creating Decorations ---
function createDecorations(doc: any, strikeThroughs: StrikeThroughRange[], activeStrikeThroughId: string | number | null): DecorationSet {
  const decorations: Decoration[] = [];
  
  // Define priority for strikethrough types if needed, or simplify if all are equal
  const priorityMap = {
    'deletion-suggestion': 2, // Example priorities
    'error-mark': 1,
    // Add other types as needed
  };
  
  const sortedStrikeThroughs = [...strikeThroughs].sort((a, b) => {
    const priorityA = priorityMap[a.type as keyof typeof priorityMap] || 0;
    const priorityB = priorityMap[b.type as keyof typeof priorityMap] || 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA; 
    }
    const lengthA = a.end - a.start;
    const lengthB = b.end - b.start;
    return lengthA - lengthB;
  });
  
  const coveredRanges: {[key: number]: boolean} = {};
  const overlappingStrikeThroughs: {[key: string]: boolean} = {}; // Renamed
  
  sortedStrikeThroughs.forEach(s => {
    const from = Math.max(0, Math.min(s.start, doc.content.size));
    const to = Math.max(from, Math.min(s.end, doc.content.size));
    for (let pos = from; pos < to; pos++) {
      if (coveredRanges[pos]) {
        overlappingStrikeThroughs[s.id] = true;
        break;
      }
    }
    for (let pos = from; pos < to; pos++) {
      coveredRanges[pos] = true;
    }
  });
  
  const hasActiveStrikeThrough = activeStrikeThroughId !== null && 
                           sortedStrikeThroughs.some(s => s.id === activeStrikeThroughId);

  sortedStrikeThroughs.forEach(s => {
    const from = Math.max(0, Math.min(s.start, doc.content.size));
    const to = Math.max(from, Math.min(s.end, doc.content.size));
    if (from === to) return;
    
    const isOverlapping = overlappingStrikeThroughs[s.id];
    
    if (hasActiveStrikeThrough && s.id !== activeStrikeThroughId) {
      return;
    }
    
    let className = 'strikethrough'; // Changed base class
    if (s.type) {
      className += ` strikethrough-${s.type}`; // Changed class prefix
    }
    if (isOverlapping) {
      className += ' strikethrough-overlapping'; // Changed class
      console.log(`StrikeThrough ${s.id} is overlapping with others`);
    }
    if (s.id === activeStrikeThroughId) {
      className += ' strikethrough-active'; // Changed class
    }
    
    const decoration = Decoration.inline(
      from,
      to,
      {
        class: className,
        'data-strikethrough-id': s.id.toString(), // Changed data attribute
        'data-strikethrough-type': s.type,       // Changed data attribute
        title: s.message || '',             
      },
      { strikeThroughId: s.id } // Changed spec property
    );
    
    decorations.push(decoration);
  });
  
  return DecorationSet.create(doc, decorations);
}
