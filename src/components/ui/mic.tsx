import React, { useState, useEffect } from "react";

interface MicButtonProps {
  isVisible: boolean;
  onClick?: (isNowActive: boolean) => void;
  // Callback to pass the active MediaStream to the parent, e.g., for recording or visualization.
  onStreamChange?: (stream: MediaStream | null) => void;
  className?: string;
}

export const MicButton = ({
  isVisible,
  onClick,
  onStreamChange,
  className,
}: MicButtonProps): JSX.Element | null => {
  // 1. Mic is now muted by default. The state is initialized to 'true'.
  const [isMuted, setIsMuted] = useState(true);
  // State to hold the actual MediaStream object from the microphone.
  const [stream, setStream] = useState<MediaStream | null>(null);

  // This effect handles the cleanup of the media stream when the component unmounts.
  // It's crucial to release the microphone to prevent the browser from showing it's "in use".
  useEffect(() => {
    // Return a cleanup function.
    return () => {
      if (stream) {
        console.log("Component unmounting, stopping all media tracks.");
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]); // The dependency array ensures this effect is aware of the current stream.

  // The main function to toggle the microphone on and off.
  // It is now an async function to handle the promise from getUserMedia.
  const handleMicToggle = async () => {
    // If the mic is currently muted, we want to turn it ON.
    if (isMuted) {
      try {
        // Request microphone access.
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        console.log("Microphone access granted.");
        setStream(newStream); // Save the stream
        setIsMuted(false);    // Update the button's state
        onClick?.(true);      // Inform parent that mic is now active
        onStreamChange?.(newStream); // Pass the stream to the parent
      } catch (err) {
        // The user denied permission or an error occurred.
        console.error("Error accessing the microphone:", err);
        // We could add user feedback here, like an alert.
        // Ensure the state remains muted if we fail.
        setIsMuted(true);
      }
    } else {
      // If the mic is currently ON, we want to turn it OFF.
      if (stream) {
        console.log("Stopping all media tracks.");
        // Stop every track in the stream, which releases the microphone.
        stream.getTracks().forEach(track => track.stop());
      }
      setStream(null);      // Clear the stream from state
      setIsMuted(true);     // Update the button's state
      onClick?.(false);     // Inform parent that mic is now inactive
      onStreamChange?.(null); // Inform parent the stream is gone
    }
  };

  if (!isVisible) {
    return null;
  }

  // 2. The muted state color is reverted to the original blue style.
  const buttonStyle = isMuted
    ? "bg-blue-200 hover:bg-blue-300" // Muted state with the original blueish background
    : "bg-[#566fe91a] hover:bg-[#566fe930]"; // Unmuted (active) state

  const iconSrc = isMuted ? "/mic-off.svg" : "/mic-on.svg";
  const ariaLabel = isMuted ? "Turn on microphone" : "Turn off microphone";
  const iconAlt = isMuted ? "Microphone is off" : "Microphone is on";

  return (
    <div className={`flex items-center h-12 ${className || ''}`}>
      <button
        onClick={handleMicToggle}
        className={`p-3 sm:p-4 rounded-full h-14 w-14 flex items-center justify-center transition-colors duration-200 backdrop-blur-sm z-10 text-black ${buttonStyle}`}
        aria-label={ariaLabel}
        type="button"
      >
        <img
          className="w-5 h-5 sm:w-6 sm:h-6 bg-[100%_100%]"
          alt={iconAlt}
          src={iconSrc}
        />
      </button>
    </div>
  );
};