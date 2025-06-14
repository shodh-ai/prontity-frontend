import React, { useState } from "react";

interface MessageButtonProps {
  isVisible: boolean;
  className?: string;
}

export const MessageButton = ({ isVisible, className }: MessageButtonProps): JSX.Element | null => {
  const [showBar, setShowBar] = useState(false);
  const staticMessage = "Can you tell me about my course summary and course insights till now?";

  const handleToggleBar = () => {
    setShowBar(prev => !prev);
  };

  const handleSend = () => {
    console.log("Message Sent:", staticMessage);
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
        aria-label="Toggle chat message"
        type="button"
        // The button is disabled when not visible to prevent any phantom interactions
        disabled={showBar}
      >
        <img className="w-5 h-5 sm:w-6 sm:h-6 bg-[100%_100%]" alt="Message" src="/message.svg" />
      </button>

      {/* Horizontal bar with static text and send button - positioned absolutely */}
      {showBar && (
        <div 
          // The bar is positioned relative to the root container, whose size is maintained by the now-invisible button.
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20 flex items-center gap-2 w-auto p-2 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-gray-200/80 min-w-[300px] sm:min-w-[350px] md:min-w-[400px] h-12"
        >
          <span
            className="flex-grow bg-transparent px-2 text-black text-sm whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {staticMessage}
          </span>
          <button
            onClick={handleSend}
            className="flex-shrink-0 bg-[#566fe9] hover:bg-[#4a5fcf] rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-colors duration-200"
            aria-label="Send message"
            type="button"
          >
            <img className="w-4 h-4 sm:w-5 sm:h-5" alt="Send" src="/send.svg" />
          </button>
        </div>
      )}
    </div>
  );
};