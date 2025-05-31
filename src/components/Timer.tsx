'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface TimerHandle {
  startTimer: (duration: number) => void;
  stopTimer: () => void;
  // resetTimer: (newInitialSeconds?: number) => void; // Optional: for future use
}

interface TimerProps {
  initialSeconds?: number;
  onTimerStarts?: () => void; // Called when timer explicitly starts
  onTimerEnds?: () => void;   // Called when timer completes or is stopped
  timerLabel?: string;
  // isActive prop is removed as control is now via startTimer/stopTimer
  mode?: 'preparation' | 'speaking';
}

const Timer = forwardRef<TimerHandle, TimerProps>(({ 
  initialSeconds = 45,
  onTimerStarts,
  onTimerEnds,
  timerLabel = 'Time Remaining',
  mode = 'speaking'
}, ref) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false); // Default to not running
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [label, setLabel] = useState(timerLabel);

  // Expose startTimer and stopTimer via ref
  useImperativeHandle(ref, () => ({
    startTimer: (duration: number) => {
      console.log(`[Timer] startTimer called with duration: ${duration}`);
      setSeconds(duration);
      setIsRunning(true);
      if (onTimerStarts) {
        onTimerStarts();
      }
    },
    stopTimer: () => {
      console.log('[Timer] stopTimer called');
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Optionally call onTimerEnds if stopping manually means "ending"
      // if (onTimerEnds) onTimerEnds(); 
    },
    // resetTimer: (newInitialSeconds?: number) => {
    //   setIsRunning(false);
    //   if (intervalRef.current) clearInterval(intervalRef.current);
    //   setSeconds(newInitialSeconds ?? initialSeconds);
    // }
  }));

  // Style variations
  const getBgColor = () => {
    if (!isRunning) return 'bg-gray-100';
    if (mode === 'preparation') return 'bg-blue-100';
    return seconds <= 10 ? 'bg-red-100' : 'bg-green-100';
  };

  const getTextColor = () => {
    if (!isRunning) return 'text-gray-700';
    if (mode === 'preparation') return 'text-blue-700';
    return seconds <= 10 ? 'text-red-700' : 'text-green-700';
  };

  const formatTime = (secs: number): string => {
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Update label when prop changes
  useEffect(() => {
    setLabel(timerLabel);
  }, [timerLabel]);
  
  // Reset seconds if initialSeconds prop changes AND timer is not running
  useEffect(() => {
    if (!isRunning) {
        setSeconds(initialSeconds);
    }
  }, [initialSeconds, isRunning]);


  // Main timer logic
  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds <= 1) {
            clearInterval(intervalRef.current as NodeJS.Timeout);
            setIsRunning(false);
            if (onTimerEnds) { // Use onTimerEnds
              onTimerEnds();
            }
            return 0;
          }
          return prevSeconds - 1;
        });
      }, 1000);
    } else if (!isRunning && intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, seconds, onTimerEnds]);

  return (
    <div className={`p-4 rounded-lg shadow mb-4 transition-all ${getBgColor()}`}>
      <div className="flex justify-between items-center">
        <div className="font-semibold">{label}</div>
        <div className={`text-xl font-bold ${getTextColor()}`}>
          {formatTime(seconds)}
        </div>
      </div>
      {mode === 'preparation' && isRunning && (
        <div className="mt-2 text-sm text-blue-600">
          Prepare your response...
        </div>
      )}
      {mode === 'speaking' && isRunning && seconds <= 10 && (
        <div className="mt-2 text-sm text-red-600">
          Wrap up your response!
        </div>
      )}
    </div>
  );
});

Timer.displayName = 'Timer'; // for better debugging in React DevTools
export default Timer;
