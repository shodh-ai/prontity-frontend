'use client';

import { useState } from 'react';
import { Comment } from './types';

interface CommentDisplayProps {
  comments: Comment[];
  essayText: string;
  onCommentClick?: (commentId: number, rangeStart: number, rangeEnd: number) => void;
}

/**
 * Displays AI-generated comments for the essay
 */
const CommentDisplay = ({ comments, essayText, onCommentClick }: CommentDisplayProps) => {
  const [activeComment, setActiveComment] = useState<number | null>(null);

  // Group comments by type for better organization
  const groupedComments = comments.reduce((acc, comment) => {
    const type = comment.comment_type || 'general';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(comment);
    return acc;
  }, {} as Record<string, Comment[]>);
  
  // Generates the display text for a comment's location
  const getCommentLocation = (comment: Comment) => {
    if (!essayText || comment.range_start === undefined || comment.range_end === undefined) {
      return '';
    }
    
    try {
      // Get text snippet context
      const start = Math.max(0, comment.range_start - 20);
      const end = Math.min(essayText.length, comment.range_end + 20);
      let context = essayText.substring(start, end);
      
      // If we cut in the middle of words, adjust to show whole words
      if (start > 0) {
        const firstSpace = context.indexOf(' ');
        if (firstSpace > 0) {
          context = '...' + context.substring(firstSpace);
        }
      }
      
      if (end < essayText.length) {
        const lastSpace = context.lastIndexOf(' ');
        if (lastSpace > 0) {
          context = context.substring(0, lastSpace) + '...';
        }
      }
      
      return context;
    } catch (e) {
      console.error('Error generating comment location:', e);
      return '';
    }
  };

  const handleCommentClick = (comment: Comment) => {
    setActiveComment(activeComment === comment.id ? null : comment.id);
    if (onCommentClick && comment.range_start !== undefined && comment.range_end !== undefined) {
      onCommentClick(comment.id, comment.range_start, comment.range_end);
    }
  };

  if (!comments || comments.length === 0) {
    return (
      <div className="text-center py-4">
        <h3 className="text-lg font-semibold mb-2">Comments & Suggestions</h3>
        <p className="text-gray-500">No comments yet. Click "AI Suggestions" to analyze your essay.</p>
      </div>
    );
  }

  return (
    <div className="comments-container">
      <h3 className="text-lg font-semibold mb-4">Comments & Suggestions</h3>
      {Object.entries(groupedComments).map(([type, typeComments]) => (
        <div key={type} className="mb-4">
          <h4 className="font-medium capitalize mb-2">
            {type === 'grammar' ? 'Grammar & Mechanics' : type}
          </h4>
          <ul className="space-y-2">
            {typeComments.map((comment) => (
              <li 
                key={comment.id} 
                className={`comment-item p-2 rounded-md cursor-pointer transition-colors ${
                  activeComment === comment.id ? 'bg-blue-50 border-blue-200 border' : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => handleCommentClick(comment)}
              >
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium">{comment.message}</p>
                </div>
                {getCommentLocation(comment) && (
                  <div className="mt-1">
                    <p className="text-xs text-gray-500 italic">
                      "{getCommentLocation(comment)}"
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default CommentDisplay;
