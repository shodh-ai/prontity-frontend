'use client';

import React, { useState, useEffect, useRef } from 'react';

interface TimerProps {
  initialSeconds?: number;
  onComplete?: () => void;
  timerLabel?: string;
  isActive?: boolean;
  mode?: 'preparation' | 'speaking';
}

const Timer: React.FC<TimerProps> = ({
  initialSeconds = 45,
  onComplete,
  timerLabel = 'Time Remaining',
  isActive = false,
  mode = 'speaking'
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(isActive);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [label, setLabel] = useState(timerLabel);

  // Style variations based on mode
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

  // Format seconds into MM:SS
  const formatTime = (secs: number): string => {
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Effects to handle timer start/stop
  useEffect(() => {
    setIsRunning(isActive);
  }, [isActive]);

  useEffect(() => {
    setSeconds(initialSeconds);
    setLabel(timerLabel);
  }, [initialSeconds, timerLabel]);

  // Main timer logic
  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds <= 1) {
            // Timer finished
            if (onComplete) onComplete();
            clearInterval(intervalRef.current as NodeJS.Timeout);
            setIsRunning(false);
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
  }, [isRunning, seconds, onComplete]);

  // Skip rendering if timer is not active and has never been started
  if (!isRunning && seconds === initialSeconds) {
    return null;
  }

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
};

export default Timer;
