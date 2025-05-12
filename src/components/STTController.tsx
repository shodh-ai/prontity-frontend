'use client';

import React, { useEffect, useState } from 'react';
import { useRoom } from '@livekit/components-react';

interface STTControllerProps {
  enabled?: boolean;
  language?: string;
  onStatusChange?: (status: { enabled: boolean, error?: string }) => void;
}

export default function STTController({ 
  enabled = true, 
  language = 'en-US',
  onStatusChange 
}: STTControllerProps) {
  const room = useRoom();
  const [isSTTEnabled, setIsSTTEnabled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Send a message to enable/disable STT in the LiveKit Agent
  useEffect(() => {
    if (!room) return;

    // Don't do anything if the requested state matches current state
    if (enabled === isSTTEnabled) return;

    const enableSTT = async () => {
      try {
        // Check if room has agents
        const agents = Array.from(room.participants.values()).filter(p => {
          try {
            return p.metadata && JSON.parse(p.metadata).isAgent;
          } catch (e) {
            return false;
          }
        });

        if (agents.length === 0) {
          console.log('No agents found in room, waiting for agent to connect...');
          // We'll rely on the participant connected event to retry
          return;
        }

        // Create the STT command message
        const message = {
          type: enabled ? 'enable_stt' : 'disable_stt',
          data: enabled ? {
            language: language,
            interim_results: true
          } : {}
        };

        // Send the message to the room
        console.log(`Sending ${enabled ? 'enable' : 'disable'} STT message to agent`);
        const encoded = new TextEncoder().encode(JSON.stringify(message));
        room.localParticipant.publishData(encoded, { reliable: true });
        
        // Update state
        setIsSTTEnabled(enabled);
        setError(null);
        
        if (onStatusChange) {
          onStatusChange({ enabled });
        }
      } catch (err) {
        console.error('Error toggling STT:', err);
        setError(`Failed to ${enabled ? 'enable' : 'disable'} speech-to-text: ${err instanceof Error ? err.message : String(err)}`);
        
        if (onStatusChange) {
          onStatusChange({ 
            enabled: isSTTEnabled, 
            error: `Failed to ${enabled ? 'enable' : 'disable'} speech-to-text` 
          });
        }
      }
    };

    enableSTT();

    // Handle agent connections to retry enabling STT
    const handleParticipantConnected = (participant: any) => {
      try {
        // Check if new participant is an agent
        if (participant.metadata) {
          const metadata = JSON.parse(participant.metadata);
          if (metadata.isAgent) {
            console.log('Agent connected, attempting to enable STT...');
            enableSTT();
          }
        }
      } catch (e) {
        console.error('Error handling participant connected:', e);
      }
    };

    room.on('participantConnected', handleParticipantConnected);

    return () => {
      room.off('participantConnected', handleParticipantConnected);
    };
  }, [room, enabled, isSTTEnabled, language, onStatusChange]);

  // When component unmounts, try to disable STT if it was enabled
  useEffect(() => {
    return () => {
      if (room && isSTTEnabled) {
        try {
          const message = {
            type: 'disable_stt',
            data: {}
          };
          const encoded = new TextEncoder().encode(JSON.stringify(message));
          room.localParticipant.publishData(encoded, { reliable: true });
          console.log('Disabled STT on component unmount');
        } catch (err) {
          console.error('Error disabling STT on unmount:', err);
        }
      }
    };
  }, [room, isSTTEnabled]);

  // This component doesn't render anything visible
  return null;
}
