/**
 * Types for the Essay Editor component
 */

export interface EssayEditorProps {
  /** Required ID of the essay to edit */
  essayId: string;
  
  /** Required User ID for the current user (for backend requests and collaboration) */
  userId: string;
  
  /** Base URL for the essay service API */
  apiBaseUrl?: string;
  
  /** Base URL for real-time collaboration socket connection */
  socketBaseUrl?: string;
  
  /** Optional initial content in Tiptap JSON format */
  initialContent?: any;
  
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
  
  /** Optional callback when content is saved */
  onSave?: (content: any) => void;
  
  /** Optional callback when AI analysis completes */
  onAnalysisComplete?: (comments: any[]) => void;
  
  /** Optional callback for error handling */
  onError?: (errorType: string, error: any) => void;
  
  /** Whether to enable real-time collaboration */
  collaborationEnabled?: boolean;
  
  /** Whether to show the comments panel */
  showComments?: boolean;
  
  /** Whether to show the grading panel */
  showGrading?: boolean;
  
  /** Debounce time in milliseconds for saving content */
  saveDebounceMs?: number;
  
  /** Optional CSS class name */
  className?: string;
}

export interface Essay {
  id: string;
  user_id: string;
  title: string;
  content: any; // Tiptap JSON content
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Comment {
  id: number;
  essay_id: string;
  range_start: number;
  range_end: number;
  message: string;
  comment_type: string;
  created_at?: string;
}

export interface Grade {
  essay_id: string;
  score: number;
  feedback: {
    overall_assessment: string;
    task_completion: string;
    organization: string;
    language_use: string;
    mechanics: string;
  };
  graded_at?: string;
}

export interface EditorUpdate {
  essayId?: string;
  content?: any;
  clientId: string;
}
