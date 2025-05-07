'use client';

import { Grade } from './types';

interface GradeDisplayProps {
  grade: Grade | null;
  isLoading?: boolean;
}

/**
 * Displays the grade and feedback for an essay
 */
const GradeDisplay = ({ grade, isLoading = false }: GradeDisplayProps) => {
  if (isLoading) {
    return (
      <div className="grade-display">
        <h3 className="text-lg font-semibold mb-4">Grading</h3>
        <div className="text-center py-8">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            <div className="h-4 w-32 bg-gray-200 rounded mt-2"></div>
            <div className="h-4 w-48 bg-gray-200 rounded mt-4"></div>
          </div>
          <p className="mt-4 text-gray-500">Processing your submission...</p>
        </div>
      </div>
    );
  }

  if (!grade) {
    return (
      <div className="grade-display">
        <h3 className="text-lg font-semibold mb-4">Grading</h3>
        <div className="text-center py-4">
          <p className="text-gray-500">
            No grade yet. Click "Submit for Grading" when you're ready.
          </p>
        </div>
      </div>
    );
  }

  // Calculate a color based on the score (red to green gradient)
  const getScoreColor = (score: number) => {
    // Score is expected to be 0-100
    if (score < 60) return 'text-red-600';
    if (score < 70) return 'text-orange-500';
    if (score < 80) return 'text-yellow-500';
    if (score < 90) return 'text-green-500';
    return 'text-green-600';
  };

  return (
    <div className="grade-display">
      <h3 className="text-lg font-semibold mb-4">Essay Evaluation</h3>
      
      <div className="mb-6 flex justify-center">
        <div className={`text-center ${getScoreColor(grade.score)}`}>
          <span className="text-4xl font-bold block">{grade.score}</span>
          <span className="text-sm">Score</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {grade.feedback && (
          <>
            {grade.feedback.overall_assessment && (
              <div>
                <h4 className="font-medium text-sm uppercase text-gray-500">Overall Assessment</h4>
                <p className="text-sm mt-1">{grade.feedback.overall_assessment}</p>
              </div>
            )}
            
            {grade.feedback.task_completion && (
              <div>
                <h4 className="font-medium text-sm uppercase text-gray-500">Task Completion</h4>
                <p className="text-sm mt-1">{grade.feedback.task_completion}</p>
              </div>
            )}
            
            {grade.feedback.organization && (
              <div>
                <h4 className="font-medium text-sm uppercase text-gray-500">Organization</h4>
                <p className="text-sm mt-1">{grade.feedback.organization}</p>
              </div>
            )}
            
            {grade.feedback.language_use && (
              <div>
                <h4 className="font-medium text-sm uppercase text-gray-500">Language Use</h4>
                <p className="text-sm mt-1">{grade.feedback.language_use}</p>
              </div>
            )}
            
            {grade.feedback.mechanics && (
              <div>
                <h4 className="font-medium text-sm uppercase text-gray-500">Mechanics</h4>
                <p className="text-sm mt-1">{grade.feedback.mechanics}</p>
              </div>
            )}
          </>
        )}
      </div>
      
      {grade.graded_at && (
        <div className="mt-4 text-right">
          <p className="text-xs text-gray-500">
            Graded: {new Date(grade.graded_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default GradeDisplay;
