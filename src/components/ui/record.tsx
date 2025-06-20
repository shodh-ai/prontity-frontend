"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Timer, { TimerHandle } from "@/components/ui/timer";
import { Clock, RefreshCw, Plus, Square, Send } from "lucide-react";

// --- Icon Components (inlined for simplicity and portability) ---

const MicIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const TimerIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// Icon for the 'Restart' button
const RestartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M21 21v-5h-5" />
  </svg>
);

// Corresponds to the '+' button in the image, but uses better UX icons.
const PauseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
     <rect x="14" y="4" width="4" height="16" rx="1" />
     <rect x="6" y="4" width="4" height="16" rx="1" />
  </svg>
);

const PlayIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
);

// Icon for the 'Stop' button
const StopIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
);


// --- Main Component ---

interface VoiceRecorderProps {
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

type RecordingStatus = "idle" | "recording" | "paused";

interface RecordingBarProps {
  onStop: () => void;
}

// This component remains unchanged as the fix is in VoiceRecorder
export const RecordingBar: React.FC<RecordingBarProps> = ({ onStop }) => {
  const timerRef = useRef<TimerHandle>(null);
  const [isTimerFinished, setIsTimerFinished] = useState(false);

  useEffect(() => {
    if (timerRef.current) {
      timerRef.current.startTimer(5);
    }
  }, []);

  const handleAddTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) {
      timerRef.current.addTime(30);
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) {
      setIsTimerFinished(false);
      timerRef.current.startTimer(5);
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) {
      timerRef.current.stopTimer();
    }
    onStop();
  };

  const handleTimerEnd = () => {
    setIsTimerFinished(true);
  };

  const handleSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Here you would typically handle the recorded audio file
    onStop();
  };

  return (
    <div className="flex items-center justify-between w-full max-w-xs sm:max-w-sm h-16 px-3 sm:px-4 bg-white/90 backdrop-blur-lg rounded-full shadow-lg border border-gray-200/80 animate-fade-in">
      <div className="flex items-center text-[#566FE9] flex-shrink-0">
        <Clock className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
        <Timer
          ref={timerRef}
          initialSeconds={5}
          variant="inline"
          mode="speaking"
          onTimerEnds={handleTimerEnd}
        />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        {isTimerFinished ? (
          <Button
            variant="default"
            size="icon"
            className="w-10 h-10 rounded-full bg-[#566FE9] hover:bg-[#4a5fcf] text-white"
            onClick={handleSend}
          >
            <Send className="w-5 h-5" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full bg-gray-500/10 hover:bg-gray-500/20"
              onClick={handleReset}
            >
              <RefreshCw className="w-5 h-5 text-[#566FE9]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full bg-gray-500/10 hover:bg-gray-500/20"
              onClick={handleAddTime}
            >
              <Plus className="w-5 h-5 text-[#566FE9]" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="w-10 h-10 rounded-full bg-[#566FE9] hover:bg-[#4a5fcf] text-white"
              onClick={handleStop}
            >
              <Square className="w-5 h-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// --- REFACTORED VoiceRecorder Component ---
export function VoiceRecorder({ onRecordingComplete, onError }: VoiceRecorderProps): JSX.Element {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startTimer = () => {
    stopTimer(); // Ensure no existing timer is running
    timerIntervalRef.current = setInterval(() => {
      setRecordingTime((prevTime) => prevTime + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Utility to safely stop all media tracks
  const cleanupMedia = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const handleStart = async () => {
    // Reset state in case of a previous recording that wasn't cleaned up
    setRecordingTime(0);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.start();
      setStatus("recording");
      startTimer();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      if (onError) onError(err as Error);
      setStatus("idle");
    }
  };
  
  const handleStop = () => {
      if (mediaRecorderRef.current && status !== 'idle') {
          mediaRecorderRef.current.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
              onRecordingComplete(audioBlob);
              audioChunksRef.current = [];
              cleanupMedia();
          };
          mediaRecorderRef.current.stop();
          stopTimer();
          setRecordingTime(0);
          setStatus("idle");
      }
  };

  const handlePause = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");
      stopTimer();
    }
  };

  const handleResume = () => {
    if (mediaRecorderRef.current && status === "paused") {
      mediaRecorderRef.current.resume();
      setStatus("recording");
      startTimer();
    }
  };

  const handleRestart = async () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null; // Detach finalization logic
        mediaRecorderRef.current.stop();
      }
      cleanupMedia();
      stopTimer();
      setRecordingTime(0);
      audioChunksRef.current = [];
      // Immediately start a new recording
      await handleStart();
  };

  useEffect(() => {
    // Cleanup on unmount to release microphone
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      cleanupMedia();
    };
  }, []);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // The component now returns a single, persistent layout.
  // The buttons inside change based on the `status` state.
  return (
    <div className="flex items-center justify-between w-[350px] h-20 bg-slate-100/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-slate-200/60">
      <div className="flex items-center gap-3 text-2xl font-mono text-blue-700 pl-4">
        <TimerIcon className="w-7 h-7 stroke-2"/>
        <span>{formatTime(recordingTime)}</span>
      </div>
      
      <div className="flex items-center gap-1">
        {/* Restart Button: Disabled when idle */}
        <Button
          onClick={handleRestart}
          variant="ghost"
          size="icon"
          className="w-12 h-12 rounded-full text-blue-700 hover:bg-slate-200/80 disabled:text-slate-400 disabled:bg-transparent disabled:cursor-not-allowed"
          aria-label="Restart Recording"
          disabled={status === 'idle'}
        >
          <RestartIcon className="w-6 h-6" />
        </Button>
        
        {/* Primary Action Button: Switches between Start, Pause, and Resume */}
        <Button
          onClick={
            status === 'idle' ? handleStart :
            status === 'recording' ? handlePause :
            handleResume
          }
          variant="default"
          size="icon"
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          aria-label={
            status === 'idle' ? "Start Recording" :
            status === 'recording' ? "Pause Recording" :
            "Resume Recording"
          }
        >
          {status === 'idle' && <MicIcon className="w-8 h-8" />}
          {status === 'recording' && <PauseIcon className="w-8 h-8" />}
          {status === 'paused' && <PlayIcon className="w-8 h-8" />}
        </Button>
        
        {/* Stop Button: Disabled when idle */}
        <Button
          onClick={handleStop}
          variant="ghost"
          size="icon"
          className="w-12 h-12 rounded-full text-blue-700 hover:bg-slate-200/80 disabled:text-slate-400 disabled:bg-transparent disabled:cursor-not-allowed"
          aria-label="Stop Recording"
          disabled={status === 'idle'}
        >
          <StopIcon className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}