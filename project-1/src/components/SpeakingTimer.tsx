'use client';

import { useState, useEffect, useCallback } from 'react';

interface SpeakingTimerProps {
  initialSeconds?: number;
  onTimerEnd?: () => void;
  className?: string;
}

export default function SpeakingTimer({ 
  initialSeconds = 45, 
  onTimerEnd,
  className = ''
}: SpeakingTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Maintain consistent hook order by using useCallback for timer functions
  const startTimer = useCallback(() => {
    setIsActive(true);
    setIsPaused(false);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeTimer = useCallback(() => {
    setIsPaused(false);
  }, []);

  const resetTimer = useCallback(() => {
    setSeconds(initialSeconds);
    setIsActive(false);
    setIsPaused(false);
  }, [initialSeconds]);

  // Timer effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isActive && !isPaused) {
      intervalId = setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds <= 1) {
            clearInterval(intervalId);
            setIsActive(false);
            if (onTimerEnd) onTimerEnd();
            return 0;
          }
          return prevSeconds - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, isPaused, onTimerEnd]);

  // Format time as MM:SS
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Determine color based on remaining time
  const getColorClass = (): string => {
    if (seconds <= 10) return 'text-red-600'; 
    if (seconds <= 20) return 'text-orange-500';
    return 'text-blue-600';
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`text-2xl font-semibold mb-2 ${getColorClass()}`}>
        {formatTime(seconds)}
      </div>
      <div className="flex space-x-2">
        {!isActive && !isPaused && (
          <button 
            onClick={startTimer}
            className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Start
          </button>
        )}
        {isActive && !isPaused && (
          <button 
            onClick={pauseTimer}
            className="px-3 py-1 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
          >
            Pause
          </button>
        )}
        {isActive && isPaused && (
          <button 
            onClick={resumeTimer}
            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
          >
            Resume
          </button>
        )}
        <button 
          onClick={resetTimer}
          className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
