'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import { useCanvasStore } from '@/state/canvasStore';
// Removed redundant: import debounce from 'lodash/debounce';
import { useAuth } from '@/contexts/AuthContext';
// import Image from 'next/image'; // Not used, can remove
import _ from 'lodash';
// import { Editor } from '@tiptap/react'; // Not directly used, TiptapEditor handles it
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
// Removed redundant: import { debounce } from 'lodash';

// Import the TiptapEditor and necessary extensions
import TiptapEditor, { TiptapEditorHandle } from '@/components/TiptapEditor';
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';

// Import Socket.IO hook for AI suggestions
import { useSocketIO } from '@/hooks/useSocketIO';

// Import API functions - ADAPTED FOR WRITING
// You'll need to create saveWritingSubmission and WritingPracticeData in your client
import { saveWritingSubmission, WritingPracticeData } from '@/api/pronityClient'; 
// Assuming PRONITY_API_URL is globally available or imported
const PRONITY_API_URL = process.env.NEXT_PUBLIC_PRONITY_API_URL || 'http://localhost:8000';


// Define task data structure from the task generation service
interface TaskData {
  taskTitle: string;
  taskDescription: string;
  suggestedPoints: string[];
  difficultyLevel: number;
  topic: string;
  error?: string;
}

// Define types for Question data (can be generic for speaking/writing)
interface Question {
  id: string;
  type: string; // e.g., 'independent-writing', 'integrated-writing'
  title: string;
  prompt: string;
  preparationTime: number;
  writingTime: number; // Changed from responseTime
  difficultyLevel: number;
  suggestedPoints?: string[];
  topic?: string;
}

// Define highlight interface (remains the same)
interface HighlightType {
  id: string;
  content: string;
  from: number;
  to: number;
  type: string;
  start: number;
  end: number;
  message?: string;
  wrongVersion?: string;
  correctVersion?: string;
  meta?: {
    reason?: string;
    suggestion?: string;
  };
}

// Import styles
import './figma-styles.css'; // Assuming these are general UI styles
import '@/styles/enhanced-room.css'; // Assuming these are general UI styles
import '@/styles/tts-highlight.css'; // Keep if highlighting style is general

// Type for messages to the socket server (remains the same)
interface TextUpdateMessage {
  type: 'text_update';
  content: string; // This will be HTML content from Tiptap
  timestamp: number;
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export default function WritingRecordPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth(); // Assuming useAuth handles auth state
  const searchParams = useSearchParams();
  
  const flowPosition = parseInt(searchParams?.get('flowPosition') || '0', 10);
  const totalTasks = parseInt(searchParams?.get('totalTasks') || '0', 10);
  const taskId = searchParams?.get('taskId');
  const topicId = searchParams?.get('topicId');
  
  const session = useMemo(() => { // Mimicking next-auth session
    return user ? { user: { name: user.name, email: user.email, id: user.id } } : null;
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [savingData, setSavingData] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentStep, setCurrentStep] = useState<'preparation' | 'writing' | 'review'>('preparation');
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [userName, setUserName] = useState('');
  const writingStartTimeRef = useRef<number | null>(null); // For tracking writing duration
  const [writingDuration, setWritingDuration] = useState<number>(0);

  const [wordCount, setWordCount] = useState(0);
  const editorRef = useRef<TiptapEditorHandle>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null); // Stores the fetched question
  const lastSentContentRef = useRef('');

  // Placeholder for isConnected state, assuming it's defined elsewhere like:
  // const [isConnected, setIsConnected] = useState(false);

  const sendContent = useCallback((htmlContent: string) => {
    // For now, this is a placeholder. Implement your actual socket sending logic here.
    // You might want to check 'isConnected' before sending.
    console.log('Simulating debounced content send (placeholder):', htmlContent.substring(0, 50) + '...');
    lastSentContentRef.current = htmlContent;
  }, [lastSentContentRef]); // Add dependencies like 'isConnected' or 'socketRef' if used in actual implementation

  const debouncedSendContent = useMemo(() => {
    return _.debounce(sendContent, 500); // Adjust debounce delay (e.g., 500ms) as needed
  }, [sendContent]);
  
  const [aiSuggestions, setAiSuggestions] = useState<HighlightType[]>([]);
  const [activeHighlightId, setActiveHighlightId] = useState<string | number | null>(null);
  
  const { socket, isConnected, sendMessage, lastMessage, error: socketError } = useSocketIO();
  
  const handleAiSuggestion = useCallback((data: any) => {
    console.log('Received AI suggestion for writing:', data);
    if (!data || !editorRef.current?.editor) return;
    
    const highlight: HighlightType = {
      id: `suggestion-${Date.now()}`,
      start: data.start || 0,
      end: data.end || 0,
      type: data.category || 'grammar',
      message: data.reason || '',
      wrongVersion: data.text || '',
      correctVersion: data.suggestion || '',
      content: data.text || '',
      from: data.start || 0,
      to: data.end || 0,
      meta: { reason: data.reason || '', suggestion: data.suggestion || '' }
    };
    setAiSuggestions(prev => [...prev, highlight]);
  }, [editorRef]);

  // Default/Placeholder question data
  const [questionData, setQuestionData] = useState<Question>({
    id: 'writing-task-1',
    type: 'independent-writing',
    title: 'Essay on Climate Change',
    prompt: 'Discuss the primary causes of climate change and propose three actionable solutions that individuals or communities can implement. Support your points with specific examples or evidence.',
    preparationTime: 60, // 1 minute for preparation
    writingTime: 1200, // 20 minutes for writing
    difficultyLevel: 3,
    suggestedPoints: ["Identify 2-3 main causes", "Propose 3 distinct solutions", "Provide examples/evidence for solutions", "Structure your essay clearly"]
  });

  // Preparation Timer
  useEffect(() => {
    if (currentStep !== 'preparation' || !currentQuestion) return;
    console.log('⏱️ PREPARATION PHASE - Starting timer');
    
    let countdown = currentQuestion.preparationTime;
    setTimerSeconds(countdown);
    
    const interval = setInterval(() => {
      countdown -= 1;
      setTimerSeconds(countdown);
      
      if (countdown <= 0) {
        clearInterval(interval);
        console.log('✅ Preparation phase complete');
        console.log('✍️ Starting writing phase');
        setCurrentStep('writing');
        setTimerSeconds(currentQuestion.writingTime); // Set timer for writing phase
        writingStartTimeRef.current = Date.now(); // Start timing the writing duration
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentStep, currentQuestion]);

  // Writing Timer
  useEffect(() => {
    if (currentStep !== 'writing' || !currentQuestion) return;
    console.log('⏱️ WRITING PHASE - Starting timer');
    
    let writingTimeRemaining = timerSeconds > 0 && timerSeconds <= currentQuestion.writingTime 
                               ? timerSeconds 
                               : currentQuestion.writingTime;
    setTimerSeconds(writingTimeRemaining);

    const interval = setInterval(() => {
      setTimerSeconds(prevTime => {
        const newTime = prevTime - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          console.log('✅ Writing phase complete');
          handleFinishWriting(true); // Auto-submit when time is up
          return 0;
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentStep, currentQuestion]); // Re-run if currentQuestion (and its writingTime) changes

  const isBrowser = typeof window !== 'undefined';

  useEffect(() => {
    if (!isBrowser) return;
    
    const initPage = async () => {
      try {
        setLoading(true);
        setError(null);
        if (user?.name) setUserName(user.name);
        else {
          const storedUserName = localStorage.getItem('userName');
          if (storedUserName) setUserName(storedUserName);
        }
        await fetchWritingTask();
        console.log('Flow params:', { flowPosition, totalTasks, taskId, topicId });
      } catch (err) {
        console.error('Failed to initialize page:', err);
        setError('Failed to load writing task. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, [isBrowser, user, topicId, taskId, flowPosition, totalTasks]);


  const saveCurrentWriting = async () => {
    if (!editorRef.current?.editor || !session?.user?.id || !currentQuestion) {
        console.warn('Cannot save: Editor, user, or question not ready.');
        return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
        setSaveError('Authentication token not found. Please log in.');
        return;
    }

    const writtenTextHtml = editorRef.current.editor.getHTML();
    const writtenTextPlain = editorRef.current.editor.getText();

    if (!writtenTextPlain.trim()) {
        console.warn('No text to save.');
        // Optionally, still navigate or show a message
        return; // Or proceed to navigate without saving if that's desired
    }

    try {
        setSavingData(true);
        setSaveError(null);
        setSaveSuccess(false);

        let currentWritingDuration = 0;
        if (writingStartTimeRef.current) {
            currentWritingDuration = Math.floor((Date.now() - writingStartTimeRef.current) / 1000);
        } else {
            // If writing started and finished very quickly or timer logic path was missed
            currentWritingDuration = currentQuestion.writingTime - timerSeconds;
        }
        setWritingDuration(currentWritingDuration);


        const writingData: WritingPracticeData = {
            userId: session.user.id,
            questionText: currentQuestion.prompt,
            writtenText: writtenTextHtml, // Save HTML for rich text, backend can store plain too
            practiceDate: new Date().toISOString(),
            topicId: topicId || currentQuestion.topic || '',
            taskId: taskId || currentQuestion.id || '',
            duration: currentWritingDuration,
        };

        console.log('------- SAVING WRITING TO PRONITY BACKEND -------');
        console.log('Writing data to save:', {
            userId: writingData.userId,
            questionTextLength: writingData.questionText?.length ?? 0,
            writtenTextLength: writtenTextPlain.length, // Log plain text length
            duration: writingData.duration,
            topicId: writingData.topicId,
            taskId: writingData.taskId
        });
        
        // Use the new saveWritingSubmission function
        const savedData = await saveWritingSubmission(writingData, token);
        console.log('✅ Writing submission saved successfully!', savedData);
        localStorage.setItem('lastSavedWritingId', savedData?.id || '');
        localStorage.setItem('lastSavedWritingTime', new Date().toISOString());
        setSaveSuccess(true);

    } catch (error) {
        console.error('Error saving writing data:', error);
        setSaveError('Failed to save writing. ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
        setSavingData(false);
    }
  };


  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartWriting = () => {
    if (!currentQuestion) return;
    setCurrentStep('writing');
    setTimerSeconds(currentQuestion.writingTime);
    writingStartTimeRef.current = Date.now(); // Track start time
    if (editorRef.current?.editor) { // Clear previous content
        editorRef.current.editor.commands.setContent('');
    }
  };

  const handleFinishWriting = async (isAutoSubmit = false) => {
    console.log('Finishing writing...');
    if (writingStartTimeRef.current) {
        const durationMs = Date.now() - writingStartTimeRef.current;
        setWritingDuration(Math.floor(durationMs / 1000));
        writingStartTimeRef.current = null;
    }
    setTimerSeconds(0); // Stop timer visually
    setCurrentStep('review'); // Go to review step OR directly navigate
    
    await saveCurrentWriting(); // Save the work

    if (isAutoSubmit || true) { // For now, always navigate after saving in review
        handleNavigateToReport();
    }
  };
  
  const getTopicFromUrl = () => {
    if (topicId && topicId.startsWith('topic-')) return topicId.substring(6);
    const defaultTopics = ['technology', 'education', 'environment', 'health', 'culture'];
    return defaultTopics[Math.floor(Math.random() * defaultTopics.length)];
  };
  
  const generateTask = async (topic: string): Promise<TaskData | null> => {
    try {
      console.log('Generating WRITING task for topic:', topic);
      const response = await fetch('http://localhost:5001/generate-task', { // Your task generation service
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic, taskType: 'writing' }), // Specify 'writing'
      });
      if (!response.ok) throw new Error(`Failed to generate task: ${response.statusText}`);
      return await response.json();
    } catch (err: any) {
      console.error('Error generating task:', err);
      return { // Fallback writing task
        taskTitle: `Essay on ${topic}`,
        taskDescription: `Write an essay discussing your views on ${topic}. Consider its impact and future implications. Provide specific examples.`,
        suggestedPoints: ['Introduction with thesis', 'Body paragraphs with examples', 'Counter-arguments (optional)', 'Conclusion summarizing views'],
        difficultyLevel: 3,
        topic: topic,
        error: err.message
      };
    }
  };
  
  const handleNavigateToReport = () => {
    console.log('🚀 Starting navigation to WRITING report page');
    try {
      let currentWrittenText = '';
      let currentWrittenTextHtml = '';

      if (editorRef.current?.editor) {
        currentWrittenText = editorRef.current.editor.getText();
        currentWrittenTextHtml = editorRef.current.editor.getHTML();
      }
      
      localStorage.setItem('writingTextPlain', currentWrittenText);
      localStorage.setItem('writingTextHtml', currentWrittenTextHtml);
      localStorage.setItem('writingTextTime', new Date().toISOString());
      
      const taskReportData = {
        id: taskId || currentQuestion?.id || '',
        topicId: topicId || currentQuestion?.topic || '',
        title: currentQuestion?.title || 'Writing Task',
        prompt: currentQuestion?.prompt || '',
        suggestedPoints: currentQuestion?.suggestedPoints || [],
        topic: currentQuestion?.topic || '',
        difficultyLevel: currentQuestion?.difficultyLevel || 3,
        flowPosition: flowPosition,
        totalTasks: totalTasks,
        writtenAt: new Date().toISOString()
      };
      localStorage.setItem('writingTask', JSON.stringify(taskReportData));

      // Save text directly with task/topic IDs for easier retrieval by report page
      const writingObject = {
        userId: localStorage.getItem('userId') || 'anonymous', // or session.user.id
        writtenText: currentWrittenText,
        writtenTextHtml: currentWrittenTextHtml,
        taskId: taskId || currentQuestion?.id || '',
        topicId: topicId || currentQuestion?.topic || '',
        questionText: currentQuestion?.prompt || '',
        recordedAt: new Date().toISOString(), // "recorded" is a bit of a misnomer here
        duration: writingDuration 
      };
      localStorage.setItem(`writing_${taskId}_${topicId}`, JSON.stringify(writingObject));

      const authToken = localStorage.getItem('token');
      if (authToken) localStorage.setItem('token', authToken);
      
      const reportUrl = `/writingreport?taskId=${taskId || 'task1'}&topicId=${topicId || 'general'}&src=writing`;
      console.log('🔗 Navigating to URL:', reportUrl);
      
      router.push(reportUrl);
      // Fallback navigation in case router.push fails silently in some scenarios
      setTimeout(() => {
          if (window.location.pathname !== new URL(reportUrl, window.location.origin).pathname) {
              console.log('⏳ Router navigation might have failed, trying window.location.href');
              window.location.href = reportUrl;
          }
      }, 1500);

    } catch (error) {
      console.error('❌ Error preparing navigation for writing report:', error);
      window.location.href = '/writingreport'; // Fallback to generic report page
    }
  };
  
  const fetchWritingTask = async () => {
    try {
      setLoading(true);
      const topic = getTopicFromUrl();
      const taskData = await generateTask(topic);
      if (!taskData) throw new Error('Failed to generate writing task');
      
      const newQuestion: Question = {
        id: taskData.taskTitle.toLowerCase().replace(/\s+/g, '-') || 'writing-task-default',
        type: 'independent-writing', // Assuming default type
        title: taskData.taskTitle,
        prompt: taskData.taskDescription,
        preparationTime: 60, // Default: 1 minute preparation
        writingTime: 1200,   // Default: 20 minutes writing time
        difficultyLevel: taskData.difficultyLevel,
        suggestedPoints: taskData.suggestedPoints,
        topic: taskData.topic
      };
      
      setCurrentQuestion(newQuestion); // Use setCurrentQuestion
      setQuestionData(newQuestion); // Also update questionData if it's used directly in UI before currentQuestion is set
      
      console.log('Writing task data loaded:', taskData);
      console.log('Writing question set:', newQuestion);
      
      setTimerSeconds(newQuestion.preparationTime);
      setCurrentStep('preparation');
      
    } catch (error) {
      console.error('Error fetching writing task:', error);
      setError('Failed to load writing task. Please try again.');
      // Set a fallback question if API fails
        const fallbackQuestion: Question = {
            id: 'fallback-writing-task',
            type: 'independent-writing',
            title: 'General Essay',
            prompt: 'Write a short essay on a topic of your choice. Focus on clear arguments and good structure.',
            preparationTime: 30,
            writingTime: 600, // 10 minutes
            difficultyLevel: 2,
            suggestedPoints: ["Choose a clear topic", "State your main idea", "Support with 2-3 points", "Write a brief conclusion"],
            topic: "general"
        };
        setCurrentQuestion(fallbackQuestion);
        setQuestionData(fallbackQuestion);
        setTimerSeconds(fallbackQuestion.preparationTime);
        setCurrentStep('preparation');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-lg">Loading writing task...</p>
        </div>
      </div>
    );
  }

  if (error || !currentQuestion) { // Added !currentQuestion check
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-600">
          <p className="text-xl">Error: {error || "Could not load task."}</p>
          <button 
            onClick={() => router.push('/writingpage')} // Navigate to a general writing tasks page
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none"
          >
            Back to Writing Tasks
          </button>
        </div>
      </div>
    );
  }

  return (
  <ProtectedRoute>
    <div className="min-h-screen bg-gray-50">
      <main className="flex flex-col h-screen">
          <div className="flex flex-col md:flex-row h-full">
            {/* Sidebar */}
            <div className="w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Writing Task</h2>
                <button 
                  onClick={() => router.push('/writingpage')} // Or your main writing tasks page
                  className="text-gray-600 hover:text-gray-800"
                >
                  <span className="sr-only">Back</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h3 className="font-medium text-blue-900 mb-2">Writing Prompt</h3>
                <h4 className="font-semibold text-blue-800 mb-2">{currentQuestion.title}</h4>
                <div className="border-l-2 border-blue-300 pl-3 my-3">
                  <p className="text-blue-800 text-sm whitespace-pre-line">{currentQuestion.prompt}</p>
                </div>
                
                {currentQuestion.suggestedPoints && currentQuestion.suggestedPoints.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-blue-900 mb-2">Suggested points to address:</h4>
                    <ul className="list-disc pl-5 text-blue-800 text-sm">
                      {currentQuestion.suggestedPoints.map((point: string, index: number) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="mt-3 text-xs text-blue-700">
                  Difficulty: {Array(currentQuestion.difficultyLevel || 3).fill('⭐').join('')}
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                <div className="mb-4">
                  <h3 className="font-medium text-gray-800 mb-2">Instructions</h3>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start">
                      <span className="text-indigo-500 mr-2">1.</span>
                      <span>Prepare your thoughts for {formatTime(currentQuestion.preparationTime)}.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-indigo-500 mr-2">2.</span>
                      <span>Write your response for up to {formatTime(currentQuestion.writingTime)}.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-indigo-500 mr-2">3.</span>
                      <span>Review your essay. You can get real-time AI suggestions.</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-2">
                    {currentStep === 'preparation' ? 'Preparation' : currentStep === 'writing' ? 'Writing Time' : 'Review'}
                  </h3>
                  
                  <div className="text-center my-4">
                    <div className="text-3xl font-bold text-indigo-600">
                      {formatTime(timerSeconds)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {currentStep === 'preparation' ? 'Preparation time remaining' : currentStep === 'writing' ? 'Writing time remaining' : 'Review your essay'}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    {currentStep === 'preparation' && (
                      <button
                        onClick={handleStartWriting}
                        disabled={timerSeconds > 0}
                        className={`w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${timerSeconds > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none'}`}
                      >
                        {timerSeconds > 0 ? 'Preparing...' : 'Start Writing'}
                      </button>
                    )}
                    
                    {currentStep === 'writing' && (
                      <button
                        onClick={() => handleFinishWriting(false)} // Manual finish
                        className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                      >
                        Finish Writing & Review
                      </button>
                    )}
                    
                    {currentStep === 'review' && (
                      <div className="space-y-2">
                        <button
                          onClick={async () => {
                            await saveCurrentWriting(); // Ensure it's saved before navigating
                            handleNavigateToReport();
                          }}
                          disabled={savingData}
                          className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                        >
                          {savingData ? "Saving..." : "Submit & View Report"}
                        </button>
                        <button
                          onClick={() => {
                            setCurrentStep('preparation');
                            if (editorRef.current?.editor) editorRef.current.editor.commands.setContent('');
                            setTimerSeconds(currentQuestion.preparationTime);
                          }}
                          className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={async () => {
                            await fetchWritingTask(); // Fetches new task, resets step to 'preparation'
                          }}
                          className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                        >
                          Next Question
                        </button>
                      </div>
                    )}
                  </div>
                   {saveError && <p className="text-red-500 text-sm mt-2">{saveError}</p>}
                   {saveSuccess && <p className="text-green-500 text-sm mt-2">Essay saved successfully!</p>}
                </div>
              </div>
            </div>
            
            {/* Main content area */}
            <div className="flex-1 bg-white p-4 md:p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                  <h1 className="text-2xl font-bold">Enhanced Writing Practice</h1>
                  <div className="text-sm text-gray-600">
                    Words: <span className="font-semibold">{wordCount}</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Your Essay</h3>
                    <p className="text-sm text-gray-500">Write your essay below. You can review and make changes.</p>
                  </div>
                  
                  <div className="mt-2 border border-gray-200 rounded-lg p-4">
                    <TiptapEditor
                      ref={editorRef}
                      initialContent={""} // Start with empty editor for writing
                      onUpdate={({ editor }) => {
                        const textContent = editor.getText();
                        setWordCount(textContent.trim() ? textContent.trim().split(/\s+/).length : 0);
                        
                        // Debounced content update to socket server
                        const htmlContent = editor.getHTML();
                        // Only send if content has meaningfully changed and socket is connected
                        if (htmlContent !== lastSentContentRef.current && htmlContent.length > 10 && isConnected) { 
                          // Added length check to avoid sending too many small updates
                          debouncedSendContent(htmlContent);
                        }
                      }}
                      extensions={[
                        StarterKit.configure({
                            // You can configure StarterKit extensions here if needed
                        }), 
                        TextStyle, 
                        Color, 
                        Placeholder.configure({
                            placeholder: 'Start writing your essay here...',
                        }),
                        HighlightExtension // Keep for AI suggestions
                      ]}
                      isEditable={currentStep === 'writing' || currentStep === 'review'} // Editable during writing and review
                      onHighlightClick={(id) => setActiveHighlightId(id)}
                      highlightData={aiSuggestions}
                      activeHighlightId={activeHighlightId}
                      className="prose max-w-none min-h-[300px] md:min-h-[400px] focus:outline-none" // Increased min height
                    />
                    
                    <div className="flex justify-between text-sm text-gray-500 mt-2">
                      <div>Word count: {wordCount}</div>
                      <div>{isConnected ? 'AI feedback active' : 'Connect to receive AI feedback'}</div>
                    </div>
                  </div>
                  
                  {/* AI Suggestions Panel */}
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">AI Feedback</h3>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto p-2 border border-gray-200 rounded">
                      {aiSuggestions.map((highlight) => (
                        <div 
                          key={highlight.id}
                          id={`suggestion-${highlight.id}`}
                          className={`p-2 border rounded-md cursor-pointer transition-colors ${
                            activeHighlightId === highlight.id 
                              ? 'bg-yellow-100 border-yellow-400' 
                              : 'bg-white border-gray-200'
                          }`}
                          onClick={() => setActiveHighlightId(highlight.id)}
                        >
                          <div className="font-medium text-sm capitalize">{highlight.type || 'Suggestion'}</div>
                          <div className="text-sm mt-1">
                            <span className="font-medium">Issue:</span> {highlight.message || highlight.meta?.reason || 'Potential issue detected.'}
                          </div>
                          {(highlight.correctVersion || highlight.meta?.suggestion) && (
                            <div className="mt-2 text-sm">
                              <div className="font-medium text-xs mb-1">Suggestion:</div>
                              <div className="flex items-center">
                                <span className="line-through text-red-600 text-xs">{highlight.wrongVersion || highlight.content}</span>
                                <span className="mx-2 text-gray-400">→</span>
                                <span className="text-green-600 text-xs font-medium">{highlight.correctVersion || highlight.meta?.suggestion}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {aiSuggestions.length === 0 && isConnected && currentStep !== 'preparation' && (
                        <div className="text-gray-500 italic p-4 text-center">AI feedback will appear here as you write...</div>
                      )}
                      {aiSuggestions.length === 0 && !isConnected && (
                        <div className="text-gray-500 italic p-4 text-center">Connect to the server to receive AI feedback.</div>
                      )}
                       {currentStep === 'preparation' && (
                         <div className="text-gray-500 italic p-4 text-center">Start writing to see AI feedback.</div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </main>
    </div>
  </ProtectedRoute>
  );
}