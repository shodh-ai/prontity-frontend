'use client';

// Define global types
declare global {
  var currentHighlights: import('@/components/TiptapEditor/highlightInterface').Highlight[] | undefined;
  var activeHighlightId: string | number | null | undefined;
}

// Import TTS highlighting styles
import '@/styles/tts-highlight.css';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
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

// Import API client for fetching transcription data
import { fetchTranscription, TranscriptionData } from '@/api/pronityClient';

// Types for messages
interface TextUpdateMessage {
  type: 'text_update';
  content: string;
  timestamp: number;
}

function WritingReportContent() {
  // Replace useSession with localStorage token check for more reliable auth
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userName, setUserName] = useState('Anonymous User');
  
  // Reference to the editor component
  const editorRef = useRef<TiptapEditorHandle>(null);
  
  // Get task and topic IDs from URL parameters - with null safety
  const taskId = searchParams?.get('taskId') || '';
  const topicId = searchParams?.get('topicId') || '';
  const src = searchParams?.get('src') || ''; // Source of navigation (from speech page?)
  
  // State for word count
  const [wordCount, setWordCount] = useState(0);
  
  // State for AI suggestions/highlights
  const [aiSuggestions, setAiSuggestions] = useState<HighlightType[]>([]);
  
  // State for transcription data
  const [transcriptionData, setTranscriptionData] = useState<TranscriptionData | null>(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  
  // State for task data (from localStorage as fallback)
  const [taskData, setTaskData] = useState<any>(null);
  
  // Effect to fetch transcription from backend
  useEffect(() => {
    // Check auth status and get username
    const storedUserName = localStorage.getItem('userName');
    if (storedUserName) {
      setUserName(storedUserName);
    }
    
    // Try to get task data from localStorage (as fallback)
    try {
      const storedTaskData = localStorage.getItem('WritingTask');
      if (storedTaskData) {
        const parsedData = JSON.parse(storedTaskData);
        setTaskData(parsedData);
        console.log('Task data loaded from localStorage:', parsedData);
      }
    } catch (err) {
      console.error('Error parsing task data from localStorage:', err);
    }
    
    // Get authentication token
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      console.log('No authentication token found, user may need to login');
      setTranscriptionError('Authentication required. Please login to view your transcription.');
      return;
    }
    
    // Don't fetch if we don't have necessary IDs
    if (!taskId || !topicId) {
      console.log('Missing taskId or topicId, cannot fetch transcription');
      setTranscriptionError('Missing task or topic information. Cannot fetch transcription.');
      return;
    }
    
    const fetchTranscriptionData = async () => {
      try {
        setTranscriptionLoading(true);
        setTranscriptionError(null);
        
        console.log(`🔍 Loading transcription for task ${taskId} and topic ${topicId}`);
        
        // First try to get transcription directly from localStorage with task/topic IDs
        const directKey = `transcript_${taskId}_${topicId}`;
        const storedTranscription = localStorage.getItem(directKey);
        
        if (storedTranscription) {
          try {
            const transcriptionObject = JSON.parse(storedTranscription);
            console.log('✅ Found transcription in localStorage with direct key:', transcriptionObject);
            
            setTranscriptionData({
              id: 'local-' + Date.now(),
              userId: transcriptionObject.userId || 'local-user',
              transcription: transcriptionObject.transcription,
              practiceDate: transcriptionObject.recordedAt,
              topicId: transcriptionObject.topicId,
              taskId: transcriptionObject.taskId,
              duration: transcriptionObject.duration
            });
            
            // Set HTML content if available for proper formatting
            setTimeout(() => {
              if (editorRef.current?.editor) {
                if (transcriptionObject.transcriptionHtml) {
                  editorRef.current.editor.commands.setContent(transcriptionObject.transcriptionHtml);
                } else {
                  editorRef.current.editor.commands.setContent(transcriptionObject.transcription);
                }
                console.log('✅ Set editor content with transcription from localStorage');
              }
            }, 500);
            
            setTranscriptionLoading(false);
            return;
          } catch (parseError) {
            console.error('Error parsing direct transcription:', parseError);
          }
        }
        
        // Try fallback methods for transcription
        
        // 1. Try HTML content first (better formatting)
        const htmlTranscript = localStorage.getItem('WritingTranscriptHtml');
        if (htmlTranscript && htmlTranscript.length > 10) {
          console.log('💾 Found HTML transcript in localStorage');
          
          // Get task data from localStorage
          let taskData = {};
          try {
            const taskDataJson = localStorage.getItem('WritingTask');
            if (taskDataJson) {
              taskData = JSON.parse(taskDataJson);
            }
          } catch (taskError) {
            console.error('Error parsing task data:', taskError);
          }
          
          setTranscriptionData({
            id: 'local-' + Date.now(),
            userId: 'local-user',
            transcription: htmlTranscript,
            practiceDate: localStorage.getItem('WritingTranscriptTime') || new Date().toISOString(),
            topicId: topicId,
            taskId: taskId
          });
          
          // Set the editor content with HTML for better formatting
          setTimeout(() => {
            if (editorRef.current?.editor) {
              editorRef.current.editor.commands.setContent(htmlTranscript);
              console.log('✅ Set editor content with HTML transcript from localStorage');
            }
          }, 500);
          
          setTranscriptionLoading(false);
          return;
        }
        
        // 2. Try plain text as last resort
        const plainTranscript = localStorage.getItem('WritingTranscript');
        if (plainTranscript && plainTranscript.length > 10) {
          console.log('💾 Found plain text transcript in localStorage');
          
          setTranscriptionData({
            id: 'local-' + Date.now(),
            userId: 'local-user',
            transcription: plainTranscript,
            practiceDate: localStorage.getItem('WritingTranscriptTime') || new Date().toISOString(),
            topicId: topicId,
            taskId: taskId
          });
          
          // Set plain text in editor
          setTimeout(() => {
            if (editorRef.current?.editor) {
              editorRef.current.editor.commands.setContent(plainTranscript);
              console.log('✅ Set editor content with plain text transcript');
            }
          }, 500);
          
          setTranscriptionLoading(false);
          return;
        }
        
        // If we get here, we didn't find any valid transcription
        console.log('⚠️ No valid transcription found in localStorage');
        setTranscriptionError('No transcription found for this task. Please complete the Writing task first.');
      } catch (err) {
        console.error('❌ Error loading transcription:', err);
        setTranscriptionError(`Failed to load transcription: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setTranscriptionLoading(false);
      }
    };
    
    fetchTranscriptionData();
  }, [taskId, topicId]);
  
  // State for active highlight ID
  const [activeHighlightId, setActiveHighlightId] = useState<string | number | null>(null);
  
  // State for TTS - commented out as requested
  // const [isWriting, setIsWriting] = useState<boolean>(false);
  
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
      if (highlight && !isWriting) {
        tts.speakSuggestionById(highlight.id);
      }
      */
    }
  }, [aiSuggestions]); // Removed isWriting and tts from dependencies
  
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
        <h1 className="text-3xl font-bold text-center mb-8">Writing Report Generator</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LiveKit component */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-xl font-semibold mb-4">AI Writing Assistant</h2>
              <div className="h-[300px] overflow-hidden bg-gray-50 rounded border">
                <BrowserOnly>
                  <LiveKitSession
                    roomName="WritingReportRoom"
                    userName={userName}
                    pageType="speaking"
                    sessionTitle="Writing Analysis"
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
                {transcriptionLoading ? (
                  <div className="bg-white min-h-[500px] border border-gray-200 rounded-md p-4 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                      <p className="mt-4 text-gray-600">Loading your transcription from the server...</p>
                    </div>
                  </div>
                ) : transcriptionError ? (
                  <div className="bg-white min-h-[500px] border border-red-100 rounded-md p-4">
                    <div className="text-center">
                      <div className="text-red-500 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="font-medium text-lg text-red-700">Error Loading Transcription</h3>
                      <p className="text-red-600 mt-2">{transcriptionError}</p>
                      <p className="mt-4 text-gray-600">Tip: Make sure you're logged in and have completed a Writing task for this topic.</p>
                    </div>
                  </div>
                ) : (
                  <TiptapEditor
                    ref={editorRef}
                    initialContent="<p>Your transcription will appear here. If nothing appears, you may not have saved a transcription for this task yet.</p>"
                    isEditable={true}
                    extensions={extensions}
                    onUpdate={handleEditorUpdate}
                    onHighlightClick={handleHighlightClick}
                    highlightData={aiSuggestions}
                    activeHighlightId={activeHighlightId}
                    className="prose max-w-none min-h-[500px] focus:outline-none"
                  />
                )}
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
                  {/* TTS Stop Writing button removed as requested */}
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

export default function WritingReportPage() {
  return (
    <ProtectedRoute>
      <WritingReportContent />
    </ProtectedRoute>
  );
}
