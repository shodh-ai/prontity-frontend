// src/components/RecordButton.tsx

"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface RecordButtonProps {
  /**
   * A callback function that receives the recorded audio as a Blob
   * once the recording is stopped.
   */
  onRecordingComplete: (audioBlob: Blob) => void;
  /**
   * An optional callback for handling errors, e.g., permission denied.
   */
  onError?: (error: Error) => void;
}

export function RecordButton({
  onRecordingComplete,
  onError,
}: RecordButtonProps): JSX.Element {
  // State to track whether we are currently recording.
  const [isRecording, setIsRecording] = useState(false);

  // useRef to hold the MediaRecorder instance.
  // Using useRef is ideal because it persists across re-renders
  // without causing them, and we need a stable reference to the recorder instance.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // useRef to store the audio chunks as they are recorded.
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // The 'onstop' event listener (defined in handleStartRecording)
      // will handle the rest of the logic.
    }
  };

  const handleStartRecording = async () => {
    // Clear any previous audio chunks.
    audioChunksRef.current = [];

    try {
      // Request access to the user's microphone.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create a new MediaRecorder instance with the stream.
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Event listener for when data is available from the recorder.
      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunksRef.current.push(event.data);
      });

      // Event listener for when the recording is stopped.
      mediaRecorder.addEventListener("stop", () => {
        // Combine all the recorded chunks into a single Blob.
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // Log the blob to the console as requested.
        console.log("Recording stopped. Audio Blob:", audioBlob);

        // For easy testing, create a URL to play the audio.
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log("You can play the recording here:", audioUrl);

        // Pass the final Blob to the parent component via the callback.
        onRecordingComplete(audioBlob);

        // Clean up the stream tracks to release the microphone.
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
      });

      // Start recording.
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      if (onError) {
        // Let the parent component know an error occurred.
        onError(error as Error);
      }
    }
  };

  // This handler decides whether to start or stop recording.
  const handleClick = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  // Determine which icon and alt text to display based on the `isRecording` state.
  const iconSrc = isRecording ? "/stop.svg" : "/mic.svg";
  const altText = isRecording ? "Stop Recording" : "Start Recording";

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size="icon"
      // Apply a different background color when recording for better user feedback.
      className={`w-14 h-14 rounded-[36px] border-none transition-colors ${
        isRecording
          ? "bg-[#e9565630] hover:bg-[#e9565640]"
          : "bg-[#566fe91a] hover:bg-[#566fe930]"
      }`}
      aria-label={altText} // For better accessibility
    >
      <img src={iconSrc} alt={altText} className="w-7 h-7" />
    </Button>
  );
}