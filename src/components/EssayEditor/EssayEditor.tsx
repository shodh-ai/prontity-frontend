'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { EssayEditorProps } from './types';
import { createEssayApi } from './api';
import { useSocketManager } from './socket';
import CommentDisplay from './CommentDisplay';
import GradeDisplay from './GradeDisplay';
import { getTextFromTiptapJson } from './utils';

// Random colors for collaboration cursors
const COLORS = [
  '#ffb3ba', // Light Red
  '#ffdfba', // Light Orange
  '#ffffba', // Light Yellow
  '#baffc9', // Light Green
  '#bae1ff', // Light Blue
  '#e2baff', // Light Purple
];

/**
 * Reusable Essay Editor component that can connect to the essay service backend
 */
const EssayEditor = ({
  essayId,
  userId,
  apiBaseUrl = 'http://localhost:3001',
  socketBaseUrl = 'http://localhost:3001',
  initialContent,
  readOnly = false,
  onSave,
  onAnalysisComplete,
  onError,
  collaborationEnabled = true,
  showComments = true,
  showGrading = true,
  saveDebounceMs = 1000,
  className = '',
}: EssayEditorProps) => {
  // State
  const [essay, setEssay] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [grade, setGrade] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [essayText, setEssayText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId] = useState(`client-${Math.floor(Math.random() * 0xFFFFFF).toString(16)}`);
  const [userColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [debounceSaveTimer, setDebounceSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize API with configurable base URL
  const api = createEssayApi(apiBaseUrl);
  
  // Initialize Socket manager with configurable base URL if collaboration is enabled
  const { socket, connected } = useSocketManager(
    collaborationEnabled ? socketBaseUrl : null, 
    essayId
  );

  // Load essay data
  useEffect(() => {
    const loadEssay = async () => {
      if (!essayId) return;
      
      try {
        setIsLoading(true);
        
        // If we have initial content, use it instead of fetching
        if (initialContent) {
          setEssay({
            id: essayId,
            user_id: userId,
            content: initialContent,
            title: 'Untitled Essay',
          });
          setEssayText(getTextFromTiptapJson(initialContent));
          setIsLoading(false);
          return;
        }
        
        // Otherwise fetch from API
        const essayData = await api.getById(essayId);
        setEssay(essayData);
        setEssayText(getTextFromTiptapJson(essayData.content));
        
        // Load comments
        const commentsData = await api.getComments(essayId);
        setComments(commentsData);
        
        // Try to load grade if available
        if (showGrading) {
          try {
            const gradeData = await api.getGrade(essayId);
            setGrade(gradeData);
          } catch (gradeError) {
            // It's okay if grade is not available yet
            console.log('No grade available yet.');
          }
        }
      } catch (err) {
        console.error('Failed to load essay:', err);
        setError('Failed to load essay. Please try again later.');
        if (onError) onError('load_error', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEssay();
  }, [essayId, userId, initialContent, api, showGrading, onError]);

  // Save essay content with debounce
  const saveEssay = useCallback(async (content: any) => {
    if (!essayId || !api) return;
    
    try {
      await api.update(essayId, { content });
      if (onSave) onSave(content);
    } catch (err) {
      console.error('Failed to save essay:', err);
      if (onError) onError('save_error', err);
    }
  }, [essayId, api, onSave, onError]);

  // Create the editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your essay here...',
      }),
    ],
    onUpdate: ({ editor }) => {
      const content = editor.getJSON();
      
      // Update local state
      if (essay) {
        setEssay({ ...essay, content });
      }
      
      // Update plain text for comment highlighting
      setEssayText(getTextFromTiptapJson(content));
      
      // Send to other clients if collaboration is enabled
      if (socket && connected && collaborationEnabled) {
        socket.emit('content-update', {
          essayId,
          content,
          clientId,
        });
      }
      
      // Save to server with debounce
      if (debounceSaveTimer) {
        clearTimeout(debounceSaveTimer);
      }
      
      const timer = setTimeout(() => {
        saveEssay(content);
      }, saveDebounceMs);
      
      setDebounceSaveTimer(timer);
    },
    content: initialContent || essay?.content || {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Start writing your essay here...' }]
      }]
    },
    editable: !readOnly,
  });

  // Set up socket listeners for editor updates
  useEffect(() => {
    if (!socket || !editor || !collaborationEnabled) return;
    
    const handleContentUpdate = (data: any) => {
      if (data.clientId === clientId) return;
      
      console.log(`Received content update from ${data.clientId}`);
      
      // Replace the content
      if (data.content) {
        editor.commands.setContent(data.content, false);
        console.log('Updated editor content from remote update');
      }
    };
    
    socket.on('content-update', handleContentUpdate);
    
    return () => {
      socket.off('content-update', handleContentUpdate);
    };
  }, [socket, editor, clientId, collaborationEnabled]);

  // Request AI analysis
  const handleRequestAnalysis = async () => {
    if (!essayId || isAnalyzing || !api) return;
    
    try {
      setIsAnalyzing(true);
      const { comments: newComments } = await api.analyze(essayId);
      setComments(newComments);
      if (onAnalysisComplete) onAnalysisComplete(newComments);
    } catch (err) {
      console.error('Failed to analyze essay:', err);
      setError('Failed to analyze essay. Please try again later.');
      if (onError) onError('analysis_error', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit for grading
  const handleSubmitForGrading = async () => {
    if (!essayId || isSubmitting || !api) return;
    
    try {
      setIsSubmitting(true);
      await api.submitForGrading(essayId);
      
      // Start polling for grade
      checkGradeInterval();
    } catch (err) {
      console.error('Failed to submit for grading:', err);
      setError('Failed to submit essay for grading. Please try again later.');
      if (onError) onError('grading_error', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check for grade periodically
  const checkGradeInterval = useCallback(() => {
    if (!essayId || !api || !showGrading) return null;
    
    const checkGrade = async () => {
      try {
        const gradeData = await api.getGrade(essayId);
        if (gradeData) {
          setGrade(gradeData);
          return true; // Got a grade, can stop polling
        }
        return false; // No grade yet, continue polling
      } catch (err) {
        return false; // Error, continue polling
      }
    };
    
    // Check immediately
    checkGrade().then(hasGrade => {
      if (!hasGrade) {
        // If no grade yet, start interval
        const interval = setInterval(async () => {
          const hasGradeNow = await checkGrade();
          if (hasGradeNow) {
            clearInterval(interval);
          }
        }, 5000);
        
        // Store interval ID for cleanup
        return interval;
      }
    });
  }, [essayId, api, showGrading]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (debounceSaveTimer) {
        clearTimeout(debounceSaveTimer);
      }
    };
  }, [debounceSaveTimer]);

  // Handle comment selection
  const handleCommentClick = (commentId: number, rangeStart: number, rangeEnd: number) => {
    // This would ideally highlight the text in the editor
    // For a complete implementation, this would need Tiptap's
    // commands to select and highlight the text at the given range
    console.log(`Clicked comment ${commentId} at range ${rangeStart}-${rangeEnd}`);
  };

  if (isLoading) {
    return <div className="p-8">Loading essay editor...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">{error}</div>;
  }

  return (
    <div className={`essay-editor-container ${className}`}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{essay?.title || 'Untitled Essay'}</h1>
        <div className="flex space-x-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            onClick={handleRequestAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'AI Suggestions'}
          </button>
          {showGrading && (
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              onClick={handleSubmitForGrading}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Grading'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white shadow-md rounded-md p-4">
            {collaborationEnabled && (
              <div className={`collaboration-status ${connected ? 'online' : 'offline'} mb-2`}>
                {!connected && '⚠️ Not connected to collaboration server'}
                {connected && '✓ Collaborative editing active'}
              </div>
            )}
            <EditorContent editor={editor} className="prose max-w-none" />
          </div>
        </div>
        
        {(showComments || showGrading) && (
          <div className="space-y-6">
            {showComments && (
              <div className="bg-white shadow-md rounded-md p-4">
                <CommentDisplay
                  comments={comments}
                  essayText={essayText}
                  onCommentClick={handleCommentClick}
                />
              </div>
            )}
            
            {showGrading && (
              <div className="bg-white shadow-md rounded-md p-4">
                <GradeDisplay grade={grade} isLoading={isSubmitting} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EssayEditor;
