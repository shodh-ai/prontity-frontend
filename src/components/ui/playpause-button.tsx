// src/components/PlayPauseButton.tsx

"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface PlayPauseButtonProps {
  /**
   * Determines if the button should be visible.
   */
  isVisible: boolean;
  /**
   * The current state. `true` if paused, `false` if playing.
   * This determines which icon to show and which function to call on click.
   */
  isPaused: boolean;
  /**
   * A callback function to trigger the "play" or "resume" action.
   */
  onPlay: () => void;
  /**
   * A callback function to trigger the "pause" action.
   */
  onPause: () => void;
}

export function PlayPauseButton({
  isVisible,
  isPaused,
  onPlay,
  onPause,
}: PlayPauseButtonProps): JSX.Element | null {
  if (!isVisible) {
    return null;
  }

  // This handler decides whether to call onPlay or onPause based on the current state.
  const handleClick = () => {
    if (isPaused) {
      // If the explanation is paused, the user's intent is to play it.
      onPlay();
    } else {
      // If the explanation is playing, the user's intent is to pause it.
      onPause();
    }
  };

  // Determine which icon and alt text to display based on the `isPaused` prop.
  // When it's playing (isPaused = false), show the PAUSE icon.
  // When it's paused (isPaused = true), show the PLAY/ACTIVE icon.
  const iconSrc = isPaused ? "/active.svg" : "/pause.svg";
  const altText = isPaused ? "Play Explanation" : "Pause Explanation";

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size="icon"
      className="w-14 h-14 bg-[#566fe91a] rounded-[36px] border-none hover:bg-[#566fe930] transition-colors"
      aria-label={altText} // For better accessibility
    >
      <img src={iconSrc} alt={altText} className="w-full h-full" />
    </Button>
  );
}