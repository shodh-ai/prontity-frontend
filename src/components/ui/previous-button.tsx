import React from "react";

interface PreviousButtonProps {
  /** Determines if the button is visible at all. */
  isVisible: boolean;
  /** A callback function to execute when the button is clicked. */
  onPrevious: () => void;
  /** If true, the button is visible but not interactive. */
  isDisabled?: boolean;
  /** Optional custom class names for positioning or extra styling. */
  className?: string;
}

export const PreviousButton = ({
  isVisible,
  onPrevious,
  isDisabled = false,
  className,
}: PreviousButtonProps): JSX.Element | null => {
  // If the button shouldn't be visible, render nothing.
  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={onPrevious}
      disabled={isDisabled}
      // The button's style is now defined by its background image.
      className={`
        h-14 w-14
        rounded-full
        bg-cover bg-center
        bg-[url('/prev.svg')]
        transition-all duration-200
        ease-in-out
        
        // Interactive states for better UX
        hover:scale-105
        active:scale-95
        
        // Disabled state styles
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:scale-100
        
        ${className || ''}
      `}
      // The aria-label is crucial for accessibility as there is no visible text.
      aria-label="Go to previous point"
      type="button"
    >
      {/* The <img> tag is removed. The button IS the image now. */}
    </button>
  );
};