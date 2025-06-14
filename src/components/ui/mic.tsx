import React, { useState } from "react";

interface MicButtonProps {
  isVisible: boolean;
  isActive: boolean;
  onClick?: () => void;
  className?: string;
}

export const MicButton = ({ isVisible, isActive, onClick, className }: MicButtonProps): JSX.Element | null => {
  // State to track if the microphone is muted. Let's default to muted.
  const [isMuted, setIsMuted] = useState(!isActive);

  // Function to toggle the mute state
  const handleToggleMute = () => {
    setIsMuted(prev => !prev);
    onClick?.(); // Call the parent's onClick handler if provided
    // Log the action for demonstration purposes
    // Note: isMuted state here is the state *before* the update due to closure
    // For correct logging based on new state, check !isMuted
    if (!isMuted) { // If it *was* muted (isMuted was true), it's now unmuted
      console.log("Microphone Unmuted");
    } else { // If it *was* unmuted (isMuted was false), it's now muted
      console.log("Microphone Muted");
    }
  };

  if (!isVisible) {
    return null;
  }

  // Define styles for muted and unmuted states to keep the JSX clean
  const buttonStyle = isMuted
    ? "bg-blue-200 hover:bg-blue-300" // Muted state has a reddish background
    : "bg-[#566fe91a] hover:bg-[#566fe930]"; // Unmuted state has the original blueish background

  const iconSrc = isMuted ? "/mic-off.svg" : "/mic-on.svg";
  const ariaLabel = isMuted ? "Unmute microphone" : "Mute microphone";
  const iconAlt = isMuted ? "Microphone is muted" : "Microphone is on";


  return (
    <div className={`flex items-center h-12 ${className || ''}`}>
      {/* The button's appearance changes based on the 'isMuted' state */}
      <button
        onClick={handleToggleMute}
        // Apply styles conditionally
        className={`p-3 sm:p-4 rounded-full h-14 w-14 flex items-center justify-center transition-colors duration-200 backdrop-blur-sm z-10 text-black ${buttonStyle}`}
        aria-label={ariaLabel}
        type="button"
      >
        <img
          className="w-5 h-5 sm:w-6 sm:h-6 bg-[100%_100%]"
          alt={iconAlt}
          // Change the icon based on the mute state
          src={iconSrc}
        />
      </button>
    </div>
  );
};