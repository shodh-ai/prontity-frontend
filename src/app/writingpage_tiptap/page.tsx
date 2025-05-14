'use client';

// Import TTS highlighting styles
import '@/styles/tts-highlight.css';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
// Router removed to prevent any redirects
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
// TTS functionality removed
// Import our Socket.IO hook
import { useSocketIO } from '@/hooks/useSocketIO';

// Types for messages
interface TextUpdateMessage {
  type: 'text_update';
  content: string;
  timestamp: number;
}

// Interface for question data received from question page
interface Question {
  id: string;
  topicName: string;
  question: string;
  level: string;
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
  
  // State for the writing question
  const [question, setQuestion] = useState<Question | null>(null);
  
  // Router removed to prevent redirects
  
  // Ref for current editor content to avoid stale closures in socket handlers
  const editorContentRef = useRef('');
  
  // Last sent content for avoiding duplicate sends
  const lastSentContentRef = useRef('');
  
  // Use our Socket.IO hook for real-time communication
  const { socket, isConnected, sendMessage, aiSuggestion, clientId, error } = useSocketIO();
  
  // TTS hook removed
  
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

  // Effect to load the question from localStorage
  useEffect(() => {
    const storedQuestion = localStorage.getItem('writingQuestion');
    if (storedQuestion) {
      try {
        const parsedQuestion = JSON.parse(storedQuestion);
        setQuestion(parsedQuestion);
      } catch (error) {
        console.error('Error parsing stored question:', error);
      }
    } else {
      // If no question is found, create a default one instead of redirecting
      // This prevents redirect loops
      setQuestion({
        id: 'default-writing-prompt',
        topicName: 'General Writing',
        question: 'Write about a topic of your choice',
        level: 'Intermediate'
      });
    }
  }, []);
  
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
  
  // Function to handle when user clicks on a highlighted suggestion
  const handleHighlightClick = useCallback((id: string | number) => {
    console.log('WritingPage: handleHighlightClick called with ID:', id);
    // Set active highlight for UI feedback
    setActiveHighlightId(id);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4 text-center">Writing with AI Assistance</h1>
      
      {/* Display question if available */}
      {question && (
        <div className="mb-6 bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                {question.level}
              </span>
              <span className="inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded ml-2">
                Topic: {question.topicName}
              </span>
            </div>
            <button 
              onClick={() => {
                // Instead of redirecting, just change the question directly
                setQuestion({
                  id: 'alternative-question',
                  topicName: 'Alternative Topic',
                  question: 'Write about a different topic of your choice',
                  level: 'Advanced'
                });
              }} 
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Change Question
            </button>
          </div>
          <h2 className="text-lg font-medium mb-2">Question:</h2>
          <p className="text-gray-700">{question.question}</p>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <div className="connection-status">
          <span className="mr-2">Connection Status:</span>
          <span className={`px-2 py-1 rounded text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Word count: {wordCount}
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
          initialContent="<p>Start writing your response here...</p>"
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
                onClick={() => console.log('TTS functionality removed')}
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
          <div className="text-xs text-gray-400 mb-2">
            {isConnected ? 'Changes are saved automatically' : 'Changes will be saved when connected'}
          </div>
          {isSpeaking && (
            <button 
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              onClick={() => setIsSpeaking(false)}
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