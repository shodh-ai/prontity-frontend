'use client';

import React, { useState, useEffect } from 'react';

interface TimerSectionProps {
  onTimerEnd?: () => void;
  initialSeconds?: number;
  duration?: number;
}

const TimerSection = ({ onTimerEnd, initialSeconds = 600, duration }: TimerSectionProps) => {
  // Use duration if provided, otherwise use initialSeconds
  const secondsToUse = duration ? duration : initialSeconds;
  
  // Convert seconds to minutes and seconds
  const initialMinutes = Math.floor(secondsToUse / 60);
  const initialRemainingSeconds = secondsToUse % 60;
  const [time, setTime] = useState({ minutes: initialMinutes, seconds: initialRemainingSeconds });
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive) {
      interval = setInterval(() => {
        setTime(prevTime => {
          const newSeconds = prevTime.seconds - 1;
          
          if (newSeconds < 0) {
            // If seconds go below 0, decrement minutes and set seconds to 59
            if (time.minutes === 0 && time.seconds === 0) {
              // Timer completed
              setIsActive(false);
              if (onTimerEnd) {
                onTimerEnd();
              }
              return time;
            }
            return { minutes: prevTime.minutes - 1, seconds: 59 };
          }
          
          return { ...prevTime, seconds: newSeconds };
        });
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  const startTimer = () => {
    setIsActive(true);
  };

  const formatTime = (num: number) => {
    return num.toString().padStart(2, '0');
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-[#00000099]">Think time</h2>
      <div 
        className="mt-4 w-[126px] h-12 border border-[#566fe9] rounded-md flex items-center justify-center"
        onClick={startTimer}
      >
        <span className="text-xl font-semibold text-[#566fe9]">
          {time.minutes}m : {formatTime(time.seconds)}s
        </span>
      </div>
    </div>
  );
};

export default TimerSection;