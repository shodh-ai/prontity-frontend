import React, { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { createHighlightPlugin, highlightPluginKey } from './HighlightPluginLogic';
import { Highlight } from './highlightInterface';

// --- Define Prop Types ---
interface TiptapEditorProps {
  initialContent?: string | object; // Allow string (HTML) or JSON
  isEditable?: boolean;
  extensions: any[]; // Parent MUST provide all extensions (any[] to handle mixed Extension types)
  onUpdate?: ({ editor }: { editor: Editor }) => void;
  // Callback for when a highlight is clicked in the editor
  onHighlightClick?: (highlightId: string | number) => void;
  // Props for HighlightPlugin
  highlightData?: Highlight[]; // Now using our proper Highlight interface type
  activeHighlightId?: string | number | null;
  // Standard React props like className can be added if needed
  className?: string;
}

// --- Define Ref Handle Type ---
// What the parent component can access via the ref
export interface TiptapEditorHandle {
  editor: Editor | null;
}

// --- The Component using forwardRef ---
const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  (
    {
      initialContent = '', // Default to empty
      isEditable = true,   // Default to editable
      extensions,          // Required prop
      onUpdate,
      onHighlightClick,    // Optional callback for highlight clicks
      highlightData = [],  // Default to empty array
      activeHighlightId = null, // Default to null
      className = '',      // Default className
    },
    ref
  ) => {
    // EDGE CASE #8: Connection status handling
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [lastConnectedTime, setLastConnectedTime] = useState<Date | null>(null);
    
    // Function to handle connection status changes
    const handleConnectionChange = (status: 'connected' | 'disconnected' | 'reconnecting') => {
      setConnectionStatus(status);
      
      if (status === 'connected') {
        setLastConnectedTime(new Date());
        setReconnectAttempts(0);
      } else if (status === 'reconnecting') {
        setReconnectAttempts(prev => prev + 1);
      }
    };

    // --- Initialize Tiptap Editor ---
    const editor = useEditor({
      // Core settings
      editable: isEditable,
      content: initialContent,
      extensions: extensions, // Use extensions provided by parent

      // --- Event Handlers ---
      // Called whenever the editor's content or selection changes
      onUpdate: ({ editor: updatedEditor }) => {
        // Call the callback prop passed from the parent, if provided
        if (onUpdate) {
          onUpdate({ editor: updatedEditor });
        }
      },

      // Other handlers like onCreate, onTransaction, onDestroy can be added here
      // onCreate: ({ editor }) => { console.log('Editor created'); },
      // onDestroy: () => { console.log('Editor destroyed'); },

      // --- Pass highlight data to extensions (for future HighlightPlugin) ---
      // Tiptap allows passing custom props to extensions via editorProps
      // We'll structure this properly when building the HighlightPlugin
      // Fix for SSR hydration mismatches
      immediatelyRender: false,
      
      editorProps: {
        attributes: {
          // Standard attributes
          class: `prose focus:outline-none ${className}`,
        },
        // Custom props for our plugin would go here, potentially under a namespace
        // highlightPluginOptions: {
        //    highlightData: highlightData,
        //    activeHighlightId: activeHighlightId
        // }
      },
    },
    // Only re-initialize editor on these core changes
    // Using an empty array or minimal dependencies is important for editor stability
    [isEditable, initialContent]
    );

    // --- EFFECT: Update Highlights when Props Change ---
    useEffect(() => {
      if (!editor || editor.isDestroyed) {
        return;
      }

      // Log when onHighlightClick is present
      console.log('TiptapEditor: onHighlightClick callback present:', !!onHighlightClick);

      // Since TypeScript doesn't know about our custom commands, use a more dynamic approach
      // to update the highlight state
      if (editor && highlightData) {
        // EDGE CASE #7: Error handling for unexpected data formats
        // Validate highlight data before applying it
        const validatedHighlights = highlightData.filter(h => {
          // Check for required properties
          if (h.id === undefined || h.start === undefined || h.end === undefined || !h.type) {
            console.warn('Invalid highlight data detected, missing required properties:', h);
            return false;
          }
          
          // Check for valid position values
          if (typeof h.start !== 'number' || typeof h.end !== 'number' || h.start > h.end) {
            console.warn('Invalid highlight position detected:', h);
            return false;
          }

          // Check for document bounds if possible
          if (editor && (h.start < 0 || h.end > editor.state.doc.content.size)) {
            console.warn('Highlight position out of document bounds:', h);
            return false;
          }
          
          return true;
        });
        
        // Check if we filtered out any invalid highlights
        if (validatedHighlights.length < highlightData.length) {
          console.warn(`Filtered out ${highlightData.length - validatedHighlights.length} invalid highlights`);
        }
        
        // Check if the editor instance has our plugin key
        try {
          // Use a dispatch to set highlights via the plugin key
          editor.view.dispatch(editor.state.tr.setMeta(highlightPluginKey, {
            highlightData: validatedHighlights,
            activeHighlightId,
            onHighlightClick, // Pass the callback through the meta data as well
            onSuggestionAccept: (highlight: Highlight) => {
              console.log('Suggestion accepted:', highlight);
              
              // EDGE CASE #6: Suggestion acceptance
              // Here we could add additional logic like tracking accepted suggestions
              // or sending analytics to the server
            }
          }));
        } catch (e) {
          console.error('Error updating highlights:', e);
          // Show a user-friendly error message or notification here if needed
        }
      }
    }, [editor, highlightData, activeHighlightId, onHighlightClick]); // Run effect when these change

    // --- EDGE CASE #8: Connection status handling ---
    // Effect to handle reconnection attempts
    useEffect(() => {
      // Simulate connection events for testing
      // In a real implementation, this would listen to socket events
      const simulateConnectionEvents = () => {
        // This is a mock implementation for testing
        // In production, this would be replaced by actual socket event listeners
        return {
          disconnect: () => {
            console.log('Socket disconnected');
            handleConnectionChange('disconnected');
          },
          reconnect: () => {
            console.log('Socket reconnecting...');
            handleConnectionChange('reconnecting');
          },
          reconnect_success: () => {
            console.log('Socket reconnected');
            handleConnectionChange('connected');
            
            // Re-request suggestions after reconnection
            if (editor) {
              // Could trigger a re-processing of the current content
              // In a real implementation, this would send the current editor content to the server
              console.log('Re-requesting suggestions after reconnection');
            }
          },
          error: (error: any) => {
            console.error('Socket error:', error);
            // Could add additional error handling here
          }
        };
      };
      
      // In a real implementation, this would attach listeners to actual socket events
      const handlers = simulateConnectionEvents();
      
      // Clean up function to remove event listeners
      return () => {
        // In a real implementation, this would remove the socket event listeners
        console.log('Cleaning up socket event listeners');
      };
    }, [editor]); // Re-attach listeners if editor changes
    
    // --- Expose Editor Instance via Ref ---
    useImperativeHandle(ref, () => ({
      editor: editor, // Expose the editor instance
    }), [editor]); // Update the ref handle if the editor instance changes

    // --- Render Editor ---
    // EditorContent handles rendering the actual editable area and connection status
    return (
      <div className="editor-container relative">
        {/* Connection status indicator */}
        {connectionStatus !== 'connected' && (
          <div className={`connection-status absolute top-0 right-0 px-2 py-1 text-xs rounded-bl ${connectionStatus === 'reconnecting' ? 'bg-yellow-500' : 'bg-red-500'} text-white`}>
            {connectionStatus === 'reconnecting' ? 
              `Reconnecting... (Attempt ${reconnectAttempts})` : 
              'Disconnected'}
          </div>
        )}
        
        <EditorContent editor={editor} className={className} />
      </div>
    );
  }
);

TiptapEditor.displayName = 'TiptapEditor'; // For better debugging

export default TiptapEditor;
