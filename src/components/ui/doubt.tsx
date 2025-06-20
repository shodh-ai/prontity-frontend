
import React, { useState } from "react";

interface DoubtButtonProps {
  isVisible: boolean;
  className?: string;
  onClick?: () => void;
}

export const DoubtButton = ({ isVisible, className, onClick }: DoubtButtonProps): JSX.Element | null => {
  const [showBar, setShowBar] = useState(false);
  // Updated static message for asking a doubt
  const staticMessage = "Can you help me with this concept?";

  const handleToggleBar = () => {
    setShowBar(prev => !prev);
    if (onClick) {
      onClick(); // Call the parent's onClick handler
    }
  };

  const handleSend = () => {
    console.log("Doubt Sent:", staticMessage);
    setShowBar(false); // Hide bar after sending, which makes the button reappear
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`relative flex items-center h-12 ${className || ''}`}> {/* Root container for relative positioning */}
      {/* Icon button - becomes invisible when the bar is shown */}
      <button
        onClick={handleToggleBar}
        // Conditionally apply 'invisible' to hide the button while preserving its space for alignment
        className={`p-3 sm:p-4 bg-[#566fe91a] hover:bg-[#566fe930] rounded-full h-14 w-14 flex items-center justify-center transition-colors duration-200 backdrop-blur-sm z-10 text-black ${showBar ? 'invisible' : ''}`}
        aria-label="Toggle doubt input" // Updated ARIA label
        type="button"
        // The button is disabled when not visible to prevent any phantom interactions
        disabled={showBar}
      >
        {/* Updated icon for "Doubt" */}
        <img className="w-5 h-5 sm:w-6 sm:h-6 bg-[100%_100%]" alt="Doubt" src="/doubt.svg" />
      </button>

      {/* Horizontal bar with static text and send button - positioned absolutely */}
      {showBar && (
        <div 
          // The bar is positioned relative to the root container, whose size is maintained by the now-invisible button.
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 w-auto p-2 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-gray-200/80 min-w-[300px] sm:min-w-[350px] md:min-w-[400px] h-12"
        >
          <span
            className="flex-grow bg-transparent px-2 text-black text-sm whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {staticMessage}
          </span>
          <button
            onClick={handleSend}
            className="flex-shrink-0 bg-[#566fe9] hover:bg-[#4a5fcf] rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors duration-200"
            aria-label="Send doubt" // Updated ARIA label
            type="button"
          >
            <img className="w-4 h-4 sm:w-5 sm:h-5" alt="Send" src="/send.svg" />
          </button>
        </div>
      )}
    </div>
  );
};