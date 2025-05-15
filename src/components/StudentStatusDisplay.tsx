"use client";

import React, { useState, useEffect, useRef } from 'react';

interface ScoreData {
  speaking: number;
  listening: number;
  writing: number;
  last_updated?: string;
}

interface StudentStatusDisplayProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  onClose: () => void; // To allow closing by clicking outside or an explicit close button if added
}

const StudentStatusDisplay: React.FC<StudentStatusDisplayProps> = ({ 
  isOpen, 
  anchorElement,
  onClose 
}) => {
  const [scores, setScores] = useState<ScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchScores = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch('http://localhost:5006/api/mock-toefl-scores');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data: ScoreData = await response.json();
          setScores(data);
        } catch (e) {
          if (e instanceof Error) {
            setError(e.message);
          } else {
            setError('An unknown error occurred.');
          }
          setScores(null); // Clear scores on error
        }
        setIsLoading(false);
      };
      fetchScores();
    }
  }, [isOpen]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
          anchorElement && !anchorElement.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorElement]);

  if (!isOpen || !anchorElement) {
    return null;
  }

  // Calculate position
  const anchorRect = anchorElement.getBoundingClientRect();
  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${anchorRect.bottom + window.scrollY + 5}px`, // 5px below the anchor
    left: `${anchorRect.left + window.scrollX}px`,
    zIndex: 1000,
  };

  return (
    <div 
      ref={popoverRef}
      style={popoverStyle}
      className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-64 text-sm text-gray-700"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">TOEFL Scores</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
      </div>
      {isLoading && <p>Loading scores...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {scores && !isLoading && !error && (
        <div className="space-y-1">
          <p><strong>Speaking:</strong> {scores.speaking}/10</p>
          <p><strong>Listening:</strong> {scores.listening}/10</p>
          <p><strong>Writing:</strong> {scores.writing}/10</p>
          {scores.last_updated && (
            <p className="text-xs text-gray-500 mt-2">
              Last Updated: {new Date(scores.last_updated).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
      {!scores && !isLoading && !error && <p>No scores available.</p>}
    </div>
  );
};

export default StudentStatusDisplay;
