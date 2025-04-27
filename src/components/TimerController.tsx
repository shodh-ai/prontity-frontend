'use client';

import React, { useState, useEffect, useContext } from 'react';
import { RoomContext } from '@livekit/components-react';
import Timer from './Timer';

interface TimerControllerProps {
  visible?: boolean;
}

const TimerController: React.FC<TimerControllerProps> = ({ visible = true }) => {
  const room = useContext(RoomContext);
  const [timerActive, setTimerActive] = useState(false);
  const [timerDuration, setTimerDuration] = useState(45);
  const [timerLabel, setTimerLabel] = useState('Time Remaining');
  const [timerMode, setTimerMode] = useState<'preparation' | 'speaking'>('speaking');

  // Handle completion of the timer
  const handleTimerComplete = () => {
    console.log('Timer completed');
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
      room.on('dataReceived', handleData as any);
    }

    return () => {
      // Clean up listener
      if (room) {
        room.off('dataReceived', handleData as any);
      }
    };
  }, [room]);

  // Skip rendering if not visible
  if (!visible) return null;

  return (
    <Timer
      initialSeconds={timerDuration}
      onComplete={handleTimerComplete}
      timerLabel={timerLabel}
      isActive={timerActive}
      mode={timerMode}
    />
  );
};

export default TimerController;
