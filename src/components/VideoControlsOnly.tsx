'use client';

import React from 'react';
import VideoControlsUI from './VideoControlsUI';

interface VideoControlsOnlyProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  toggleAudio: () => void;
  toggleCamera: () => void;
  handleLeave: () => void;
  hideAudio?: boolean;
  hideVideo?: boolean;
  customControls?: React.ReactNode;
}

/**
 * A simplified component that only shows video controls
 * This is used when we want to separate the LiveKit controls from video display
 */
export default function VideoControlsOnly({
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleCamera,
  handleLeave,
  hideAudio = false,
  hideVideo = false,
  customControls
}: VideoControlsOnlyProps) {
  return (
    <div className="video-controls-wrapper">
      <VideoControlsUI
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        toggleAudio={toggleAudio}
        toggleCamera={toggleCamera}
        handleLeave={handleLeave}
        hideAudio={hideAudio}
        hideVideo={hideVideo}
        customControls={customControls}
      />
    </div>
  );
}
