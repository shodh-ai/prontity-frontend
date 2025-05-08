'use client';

// Import TTS highlighting styles
import '@/styles/tts-highlight.css';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import useWritingTTS from '@/components/WritingTTS';
// Import our Socket.IO hook
import { useSocketIO } from '@/hooks/useSocketIO';

// Types for messages
interface TextUpdateMessage {
  type: 'text_update';
  content: string;
  timestamp: number;
}

export default function WritingPage() {
  // State for word count
  const [wordCount, setWordCount] = useState(0);
  
  // State for AI suggestions/highlights
  const [aiSuggestions, setAiSuggestions] = useState<HighlightType[]>([]);
  
  // State for active highlight ID
  const [activeHighlightId, setActiveHighlightId] = useState<string | number | null>(null);
  
  // State for TTS
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  
  // State for editor content (for debouncing)
  const [editorContent, setEditorContent] = useState('');
  
  // Ref for current editor content to avoid stale closures in socket handlers
  const editorContentRef = useRef('');
  
  // Last sent content for avoiding duplicate sends
  const lastSentContentRef = useRef('');
  
  // Use our Socket.IO hook for real-time communication
  const { socket, isConnected, sendMessage, aiSuggestion, clientId, error } = useSocketIO();
  
  // Initialize TTS hook
  const tts = useWritingTTS({
    suggestions: aiSuggestions,
    onSpeakingStateChange: (speaking: boolean) => setIsSpeaking(speaking),
    onHighlightChange: (highlightId: string | number | null) => setActiveHighlightId(highlightId)
  });
  
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
            type: suggestion.type,
            message: suggestion.message
          })) : [];
        
        setAiSuggestions(highlights);
      } catch (e) {
        console.error('Error parsing AI suggestions:', e);
      }
    }
  }, [aiSuggestion]);
  
  // When connection is established, send current content
  useEffect(() => {
    if (isConnected && editorContentRef.current && editorContentRef.current !== lastSentContentRef.current) {
      sendTextUpdate(editorContentRef.current);
    }
  }, [isConnected, sendTextUpdate]);
  
  // Reference to the editor for imperative actions if needed
  const editorRef = useRef<TiptapEditorHandle>(null);
  
  // Define the extensions we want to use
  const extensions = useMemo(() => [
    StarterKit,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    Placeholder.configure({
      placeholder: 'Start typing here...'
    }),
    // Add the HighlightExtension
    HighlightExtension
  ], []);

  // Handle editor updates
  const handleEditorUpdate = useCallback(({ editor }: { editor: Editor }) => {
    // Update word count
    const text = editor.getText();
    setWordCount(text.split(/\s+/).filter(Boolean).length);
    
    // Only process if there is actual text content
    if (text.trim().length > 0) {
      // Get HTML content from the editor
      const content = editor.getHTML();
      
      // Update content state and refs
      setEditorContent(content);
      editorContentRef.current = content;
      
      // Send content update to server (debounced)
      debouncedSendTextUpdate(content);
    }
  }, [debouncedSendTextUpdate]);
  
  // Handle click on a highlight
  const handleHighlightClick = useCallback((id: string | number) => {
    console.log('WritingPage: handleHighlightClick called with ID:', id);
    
    // Use our enhanced TTS component to both speak and highlight
    if (!isSpeaking) {
      tts.speakSuggestionById(id);
    } else {
      // If we're already speaking, just stop and restart with this suggestion
      tts.stopSpeaking();
      setTimeout(() => tts.speakSuggestionById(id), 100);
    }
  }, [tts, isSpeaking]);

  return (
    <div className="writing-page p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Writing Page</h1>
        <div className="connection-status">
          <span className="mr-2">Connection:</span>
          <span className={`px-2 py-1 rounded text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      <div className="editor-wrapper border border-gray-300 rounded-lg p-4 bg-white">
        {/* The editor toolbar component */}
        <EditorToolbar 
          editor={editorRef.current?.editor ?? null} 
          className="mb-4" 
        />
        
        {/* Our reusable TiptapEditor component */}
        <TiptapEditor
          ref={editorRef}
          initialContent="<p>This is a sample paragraph with some text that will have highlights applied to it. You can click on the highlights to see the associated message. Try typing more text to see how the editor behaves.</p>"
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
            {aiSuggestions.length > 0 && (
              <button 
                className={`px-3 py-1 rounded text-sm ${isSpeaking 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white transition-colors'}`}
                onClick={tts.speakAllSuggestions}
                disabled={isSpeaking || aiSuggestions.length === 0}
                title={isSpeaking ? 'Speaking...' : 'Listen to explanations'}
              >
                {isSpeaking ? 'Speaking...' : 'Explain Suggestions'}
              </button>
            )}
          </div>
          <div className="space-y-2">
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
              <div className="text-gray-500 italic">AI suggestions will appear here after you start typing...</div>
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
          {isSpeaking && (
            <button 
              className="mt-2 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              onClick={tts.stopSpeaking}
              title="Stop speaking"
            >
              Stop Speaking
            </button>
          )}
        </div>
      </div>
      
      {/* Accessibility element for screen readers */}
      <div className="sr-only" aria-live="polite">
        {isSpeaking ? `Reading ${activeHighlightId ? 'suggestion ' + activeHighlightId : 'suggestions'} aloud` : 'Ready to read suggestions'}
      </div>
    </div>
  );
}