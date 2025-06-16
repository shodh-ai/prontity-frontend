import React from "react";

interface NotesButtonProps {
  // A boolean to indicate if the corresponding panel is currently open
  isActive: boolean;
  // The function to call when the button is clicked
  onClick: () => void;
  className?: string;
}

export const NotesButton = ({ isActive, onClick, className }: NotesButtonProps): JSX.Element => {
  // Change style based on whether the panel is active (open)
  const buttonStyle = isActive
    ? "bg-blue-500 text-white" // Active state: solid blue background
    : "bg-gray-200 hover:bg-gray-300 text-black"; // Inactive state

  return (
    <button
      onClick={onClick}
      // --- CHANGES FOR THE BUTTON ---
      // 1. Removed padding (p-3 sm:p-4)
      // 2. Removed flexbox alignment (flex items-center justify-center)
      // 3. Added overflow-hidden to ensure the image corners are clipped by the border-radius
      className={`rounded-full h-14 w-14 transition-colors duration-200 z-10 overflow-hidden ${buttonStyle} ${className || ''}`}
      aria-label={isActive ? "Hide notes" : "Show notes"}
      aria-pressed={isActive}
      type="button"
    >
      <img 
        src="/doubt.svg" 
        alt="Doubt icon" 
        // --- CHANGES FOR THE IMAGE ---
        // 1. Set width and height to 100% of the parent (the button)
        // 2. Added object-cover to maintain aspect ratio and fill the space
        // 3. Added rounded-full to match the button's shape perfectly
        className="w-full h-full object-cover rounded-full" 
      />
    </button>
  );
};