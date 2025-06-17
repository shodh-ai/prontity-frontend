'use client';

import React, { useState, useEffect } from 'react';
import { Room } from 'livekit-client'; // Import Room type
import Timer from './Timer';

interface TimerControllerProps {
  visible?: boolean;
  room: Room | null;
  initialDuration?: number; // Added initialDuration
  onTimerStarts?: () => void; // Callback for when timer starts
  onTimerEnds?: () => void;   // Callback for when timer ends
}

const TimerController: React.FC<TimerControllerProps> = ({ visible = true, room, initialDuration, onTimerStarts, onTimerEnds }) => {
  const [timerActive, setTimerActive] = useState(false);
  const [timerDuration, setTimerDuration] = useState(initialDuration || 45);
  const [timerLabel, setTimerLabel] = useState('Time Remaining');
  const [timerMode, setTimerMode] = useState<'preparation' | 'speaking'>('speaking');

  // Handle completion of the timer
  const handleTimerComplete = () => {
    console.log('Timer completed');
    onTimerEnds?.(); // Call the reconnect callback
    setTimerActive(false);
  };

  // Listen for data messages from the agent
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array, participant: any, kind: any) => {
      try {
        // Try to parse the payload as JSON
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(payload);
        const data = JSON.parse(text);

        // Look for timer commands
        if (data.type === 'timer') {
          console.log('Received timer command:', data);

          if (data.action === 'start') {
            setTimerDuration(data.duration || 45);
            setTimerLabel(data.message || 'Time Remaining');
            setTimerMode(data.mode || 'speaking');
            onTimerStarts?.(); // Call the disconnect callback
            setTimerActive(true);
          } else if (data.action === 'stop') {
            setTimerActive(false);
          }
        }
      } catch (error) {
        console.error('Error handling data message:', error);
      }
    };

    // Register listener for data messages - using correct LiveKit event name
    if (room) {
      room.on('dataReceived', handleData);
    }

    return () => {
      // Clean up listener
      if (room) {
        room.off('dataReceived', handleData);
      }
    };
  }, [room]);

  // Skip rendering if not visible
  if (!visible) return null;

  return (
    <Timer
      initialSeconds={timerDuration}
      onTimerEnds={handleTimerComplete}
      timerLabel={timerLabel}
      mode={timerMode}
    />
  );
};

export default TimerController;
