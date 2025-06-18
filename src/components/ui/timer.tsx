'use client';

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// 1. UPDATED: Add addTime to the handle
export interface TimerHandle {
  startTimer: (duration: number) => void;
  stopTimer: () => void;
  addTime: (secondsToAdd: number) => void; 
}

interface TimerProps {
  initialSeconds?: number;
  onTimerStarts?: () => void;
  onTimerEnds?: () => void;
  timerLabel?: string;
  mode?: 'preparation' | 'speaking';
  variant?: 'default' | 'inline'; // 2. NEW: Add a variant prop for styling
}

const Timer = forwardRef<TimerHandle, TimerProps>(({
  initialSeconds = 120,
  onTimerStarts,
  onTimerEnds,
  timerLabel = 'Time Remaining',
  mode = 'speaking',
  variant = 'default', // Default to the original style
}, ref) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [label, setLabel] = useState(timerLabel);

  useImperativeHandle(ref, () => ({
    startTimer: (duration: number) => {
      console.log(`[Timer] startTimer called with duration: ${duration}`);
      setSeconds(duration);
      setIsRunning(true);
      if (onTimerStarts) onTimerStarts();
    },
    stopTimer: () => {
      console.log('[Timer] stopTimer called');
      setIsRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (onTimerEnds) onTimerEnds();
    },
    // 3. NEW: Implement the addTime function
    addTime: (secondsToAdd: number) => {
      if (isRunning) {
        setSeconds(prevSeconds => Math.max(0, prevSeconds + secondsToAdd));
      }
    }
  }));

  // Style variations
  const getBgColor = () => {
    if (variant === 'inline') return 'bg-transparent';
    if (!isRunning) return 'bg-gray-100';
    if (mode === 'preparation') return 'bg-blue-100';
    return seconds <= 10 ? 'bg-red-100' : 'bg-[#566FE91A]';
  };

  const getTextColor = () => {
    if (!isRunning) return 'text-gray-700';
    if (mode === 'preparation') return 'text-blue-700';
    return seconds <= 10 ? 'text-red-700' : 'text-[#566FE9]';
  };
  
  // *** FIX: THE MAIN CHANGE IS HERE ***
  // For the 'inline' variant, we make the container a flexbox that justifies its
  // content to the end (the right side). This forces expansion to the left.
  const containerClasses = variant === 'default'
    ? 'p-4 rounded-lg shadow mb-4 transition-all w-64 h-20 flex flex-col justify-center items-center'
    : 'flex justify-end transition-all'; // This is the key change

  const formatTime = (secs: number): string => {
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  useEffect(() => {
    setLabel(timerLabel);
  }, [timerLabel]);
  
  useEffect(() => {
    if (!isRunning) {
        setSeconds(initialSeconds);
    }
  }, [initialSeconds, isRunning]);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds <= 1) {
            clearInterval(intervalRef.current as NodeJS.Timeout);
            setIsRunning(false);
            if (onTimerEnds) onTimerEnds();
            return 0;
          }
          return prevSeconds - 1;
        });
      }, 1000);
    } else if (!isRunning && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds, onTimerEnds]);

  return (
    <div className={`${containerClasses} ${getBgColor()}`}>
      {/* The inner content div no longer needs complex alignment classes,
          as the parent 'justify-end' handles the positioning. We can keep
          text-right for perfect digit alignment as a best practice. */}
      <div className="text-right">
        {/* Only show the label for the default variant */}
        {variant === 'default' && <div className="font-semibold">{label}</div>}
        {/* We no longer need padding-right (pr-5) here */}
        <div className={`text-xl tabular-nums ${getTextColor()}`}>
          {formatTime(seconds)}
        </div>
      </div>
    </div>
  );
});

Timer.displayName = 'Timer';
export default Timer;