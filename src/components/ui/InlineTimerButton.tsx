// @/components/ui/InlineTimerButton.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Timer, { TimerHandle } from './timer';
import { Clock } from 'lucide-react'; // We still need this for the active state

interface InlineTimerButtonProps {
  initialDuration?: number;
  onTimerComplete?: () => void;
  className?: string;
}

const InlineTimerButton: React.FC<InlineTimerButtonProps> = ({
  initialDuration = 60,
  onTimerComplete,
  className = '',
}) => {
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<TimerHandle>(null);

  useEffect(() => {
    if (isTimerActive) {
      timerRef.current?.startTimer(initialDuration);
    }
  }, [isTimerActive, initialDuration]);

  const handleStartClick = () => {
    if (!isTimerActive) {
      setIsTimerActive(true);
    }
  };

  const handleAddTime = () => {
    timerRef.current?.addTime(5);
  };

  const handleTimerEnds = () => {
    setIsTimerActive(false);
    if (onTimerComplete) {
      onTimerComplete();
    }
  };

  // --- DYNAMIC STYLING ---
  const containerClasses = isTimerActive
    ? 'h-14 px-3 rounded-full border border-gray-300 bg-white shadow-sm'
    // For the inactive state, we remove justify-center as it's not needed when the child fills the space.
    : 'w-14 h-14 rounded-[36px] bg-[#566fe91a] border-none cursor-pointer hover:bg-[#566fe930]';

  return (
    <div
      onClick={handleStartClick}
      // Note: We adjust the flex properties on the container for the inactive state
      className={`inline-flex items-center ${!isTimerActive ? 'justify-center' : ''} transition-all duration-300 ease-in-out ${containerClasses} ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStartClick()}
    >
      {isTimerActive ? (
        // --- TIMER VIEW (ACTIVE) ---
        <div className="flex items-center animate-fade-in">
          <Clock className="h-5 w-5 text-gray-600 mr-2" />
          <Timer
            ref={timerRef}
            variant="inline"
            onTimerEnds={handleTimerEnds}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddTime();
            }}
            className="ml-2 text-gray-500 hover:text-green-600"
            aria-label="Add 5 seconds"
          >
            <img src="/plus.svg" alt="Add 5 seconds" className="h-10 w-10" />
          </button>
        </div>
      ) : (
        // --- ICON VIEW (INACTIVE) ---
        <img
          src="/prep.svg"
          alt="Start Timer"
          // This is the key change: h-full and w-full make the image fill its parent container.
          className="h-full w-full animate-fade-in"
        />
      )}
    </div>
  );
};

export default InlineTimerButton;