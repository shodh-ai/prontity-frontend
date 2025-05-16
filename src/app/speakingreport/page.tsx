'use client';

// Define global types
declare global {
  var currentHighlights: import('@/components/TiptapEditor/highlightInterface').Highlight[] | undefined;
  var activeHighlightId: string | number | null | undefined;
}

// Import TTS highlighting styles
import '@/styles/tts-highlight.css';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// TipTap editor imports
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { Editor } from '@tiptap/react';
import { debounce } from 'lodash';

// Import the HighlightExtension and Highlight interface
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';
import { Highlight as HighlightType } from '@/components/TiptapEditor/highlightInterface';

// Import our reusable components
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor';
import EditorToolbar from '@/components/EditorToolbar';
// import useWritingTTS from '@/components/WritingTTS'; // TTS functionality commented out as requested
import LiveKitSession from '@/components/LiveKitSession';
import BrowserOnly from '../../components/BrowserOnly';

// Import our Socket.IO hook
import { useSocketIO } from '@/hooks/useSocketIO';

// Types for messages
interface TextUpdateMessage {
  type: 'text_update';
  content: string;
  timestamp: number;
}

function SpeakingReportContent() {
  const { user, isLoading: authIsLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const userName = user?.name || (authIsLoading ? 'Loading...' : (isAuthenticated ? 'User' : 'Anonymous User'));
  
  // Reference to the editor component
  const editorRef = useRef<TiptapEditorHandle>(null);
  
  // State for word count
  const [wordCount, setWordCount] = useState(0);
  
  // State for AI suggestions/highlights
  const [aiSuggestions, setAiSuggestions] = useState<HighlightType[]>([]);
  
  // State for active highlight ID
  const [activeHighlightId, setActiveHighlightId] = useState<string | number | null>(null);
  
  // State for TTS - commented out as requested
  // const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  
  // State for editor content (for debouncing)
  const [editorContent, setEditorContent] = useState('');
  
  // Ref for current editor content to avoid stale closures in socket handlers
  const editorContentRef = useRef('');
  
  // Last sent content for avoiding duplicate sends
  const lastSentContentRef = useRef('');
  
  // State for loading
  const [isLoading, setIsLoading] = useState(false);
  
  // Use our Socket.IO hook for real-time communication
  const { socket, isConnected, sendMessage, aiSuggestion, clientId, error } = useSocketIO();
  
  // Define the handleHighlightClick function at the top level (before using it in the useEffect hook)
  const handleHighlightClick = useCallback((highlightId: string | number | null) => {
    setActiveHighlightId(highlightId);
    
    // If we have suggestions and a valid highlight ID, scroll the suggestion into view
    if (highlightId !== null && aiSuggestions.length > 0) {
      const suggestionElement = document.getElementById(`suggestion-${highlightId}`);
      if (suggestionElement) {
        suggestionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      
      // TTS functionality commented out as requested
      /*
      // Optional: Speak the highlight message using TTS
      const highlight = aiSuggestions.find(h => h.id === highlightId);
      if (highlight && !isSpeaking) {
        tts.speakSuggestionById(highlight.id);
      }
      */
    }
  }, [aiSuggestions]); // Removed isSpeaking and tts from dependencies
  
  // Function to send text updates to the server
  const sendTextUpdate = useCallback((content: string) => {
    if (isConnected && content !== lastSentContentRef.current) {
      const message: TextUpdateMessage = {
        type: 'text_update',
        content,
        timestamp: Date.now()
      };
      
      sendMessage(message);
      lastSentContentRef.current = content; // Update last sent content reference
      console.log('Text update sent to server', { contentLength: content.length });
    } else if (!isConnected) {
      console.warn('Failed to send text update - will retry when connection is established.');
    }
  }, [isConnected, sendMessage]);

  // Create a debounced version of the send function to avoid too many updates
  const debouncedSendTextUpdate = useMemo(
    () => debounce(sendTextUpdate, 1000, { maxWait: 5000 }),
    [sendTextUpdate]
  );
  
  // Handle AI suggestions from Socket.IO
  useEffect(() => {
    if (aiSuggestion) {
      try {
        // Parse the AI suggestion string to get the suggestions array
        const suggestionsData = JSON.parse(aiSuggestion);
        
        // Convert server suggestions to our HighlightType format
        const highlights: HighlightType[] = Array.isArray(suggestionsData) ?
          suggestionsData.map((suggestion: any) => ({
            id: suggestion.id,
            start: suggestion.start,
            end: suggestion.end,
            type: suggestion.type || 'suggestion',
            message: suggestion.message
          })) : [];
        
        setAiSuggestions(highlights);
        console.log('Updated AI suggestions:', highlights.length);
      } catch (e) {
        console.error('Error parsing AI suggestions:', e);
      }
    }
  }, [aiSuggestion]);
  
  // When connection is established, send current content
  useEffect(() => {
    if (isConnected && editorContentRef.current) {
      // Send the current editor content
      sendTextUpdate(editorContentRef.current);
    }
  }, [isConnected, sendTextUpdate]);
  
  // Effect to sync highlight data with the agent via Socket.IO
  useEffect(() => {
    // When highlights change, send them to the agent
    if (isConnected && aiSuggestions.length > 0) {
      // We need to store the highlights globally for the API endpoint
      if (typeof globalThis.currentHighlights !== 'undefined') {
        globalThis.currentHighlights = aiSuggestions;
      }
      if (typeof globalThis.activeHighlightId !== 'undefined') {
        globalThis.activeHighlightId = activeHighlightId;
      }
      
      // Send highlights to agent via Socket.IO
      sendMessage({
        type: 'highlights_update',
        highlights: aiSuggestions,
        timestamp: Date.now()
      });
      
      console.log('Sent highlights to agent:', aiSuggestions.length);
    }
  }, [aiSuggestions, isConnected, sendMessage, activeHighlightId]);
  
  // Add effect to poll for highlight control commands from the agent
  useEffect(() => {
    const pollForHighlightControls = async () => {
      try {
        const response = await fetch('/api/check-highlight-controls');
        const data = await response.json();
        
        if (data.pendingActions && data.pendingActions.length > 0) {
          // Handle each pending action
          data.pendingActions.forEach((action: any) => {
            if (action.action === 'select' && action.highlightId) {
              // Set this highlight as active
              handleHighlightClick(action.highlightId);
              console.log(`Agent requested highlight change to: ${action.highlightId}`);
            }
          });
        }
      } catch (error) {
        console.error('Error checking for highlight controls:', error);
      }
    };
    
    // Poll every 2 seconds if we're connected and have suggestions
    let interval: NodeJS.Timeout | null = null;
    if (isConnected && aiSuggestions.length > 0) {
      interval = setInterval(pollForHighlightControls, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [handleHighlightClick, isConnected, aiSuggestions.length]);
  
  // Handle editor updates
  const handleEditorUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      const content = editor.getHTML();
      
      // Update content ref and state
      editorContentRef.current = content;
      setEditorContent(content);
      
      // Update word count
      const text = editor.getText();
      const words = text.split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
      
      // Send to server (debounced)
      debouncedSendTextUpdate(content);
    },
    [debouncedSendTextUpdate]
  );
  
  // Define editor extensions
  const extensions = useMemo(() => [
    StarterKit,
    Highlight,
    TextStyle,
    Color,
    Placeholder.configure({
      placeholder: 'Start typing your report here...',
    }),
    // Our custom highlight extension for AI suggestions
    HighlightExtension,
  ], []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl font-bold text-center mb-8">Speaking Report Generator</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LiveKit component */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-xl font-semibold mb-4">AI Speaking Assistant</h2>
              <div className="h-[300px] overflow-hidden bg-gray-50 rounded border">
                <BrowserOnly>
                  <LiveKitSession
                    roomName="SpeakingReportRoom"
                    userName={userName}
                    pageType="speaking"
                    sessionTitle="Speaking Analysis"
                    aiAssistantEnabled={true}
                    hideVideo={false}
                    hideAudio={false}
                    showTimer={false}
                  />
                </BrowserOnly>
              </div>
            </div>
          </div>
          
          {/* Editor component */}
          <div className="col-span-1 md:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="editor-wrapper border border-gray-300 rounded-lg p-4 bg-white">
                {/* Status indicator */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Report Editor</h2>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${isConnected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'}`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                {/* The editor toolbar component */}
                <EditorToolbar 
                  editor={editorRef.current?.editor ?? null} 
                  className="mb-4" 
                />
                
                {/* Our reusable TiptapEditor component */}
                <TiptapEditor
                  ref={editorRef}
                  initialContent="<p>Start typing your report here. The AI assistant will analyze your speech and help generate content.</p>"
                  isEditable={true}
                  extensions={extensions}
                  onUpdate={handleEditorUpdate}
                  onHighlightClick={handleHighlightClick}
                  highlightData={aiSuggestions}
                  activeHighlightId={activeHighlightId}
                  className="prose max-w-none min-h-[500px] focus:outline-none"
                />
              </div>
              
              <div className="mt-4 flex justify-between items-start">
                <div className="w-2/3">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">AI Suggestions</h3>
                    {/* Explain Suggestions button removed as requested */}
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {aiSuggestions.map((highlight) => (
                      <div 
                        key={highlight.id}
                        id={`suggestion-${highlight.id}`} // Important: consistent ID format
                        className={`p-2 border rounded-md cursor-pointer transition-colors ${
                          activeHighlightId === highlight.id 
                            ? 'bg-yellow-100 border-yellow-400' 
                            : 'bg-white border-gray-200'
                        }`}
                        onClick={() => handleHighlightClick(highlight.id)}
                      >
                        <div className="font-medium text-sm capitalize">{highlight.type}</div>
                        <div className="text-sm">{highlight.message}</div>
                      </div>
                    ))}
                    {aiSuggestions.length === 0 && isConnected && (
                      <div className="text-gray-500 italic">AI suggestions will appear here as you speak and type...</div>
                    )}
                    {aiSuggestions.length === 0 && !isConnected && (
                      <div className="text-gray-500 italic">Connect to the server to receive AI suggestions...</div>
                    )}
                  </div>
                </div>
                <div className="text-right text-gray-600">
                  <div className="mb-2">Word count: {wordCount}</div>
                  <div className="text-xs text-gray-400">
                    {isConnected ? 'Changes are saved automatically' : 'Changes will be saved when connected'}
                  </div>
                  {/* TTS Stop Speaking button removed as requested */}
                </div>
              </div>
              
              {/* Accessibility element for screen readers - TTS functionality commented out */}
              <div className="sr-only" aria-live="polite">
                Ready to view suggestions
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SpeakingReportPage() {
  return (
    <ProtectedRoute>
      <SpeakingReportContent />
    </ProtectedRoute>
  );
}
