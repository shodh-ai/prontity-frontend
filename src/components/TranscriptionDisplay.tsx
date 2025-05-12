'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRoom } from '@livekit/components-react';

interface Transcript {
  id: string;
  text: string;
  isFinal: boolean;
}

interface TranscriptionDisplayProps {
  maxTranscripts?: number;
}

export default function TranscriptionDisplay({ maxTranscripts = 10 }: TranscriptionDisplayProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const room = useRoom();

  // Scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  // Listen for STT events from the LiveKit agent
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (data: Uint8Array, topic: string) => {
      try {
        const decodedData = new TextDecoder().decode(data);
        const parsedData = JSON.parse(decodedData);
        
        if (parsedData.type === 'stt_result') {
          const { text, is_final } = parsedData.data;
          
          setTranscripts(prev => {
            // For final transcripts, add a new entry
            if (is_final) {
              const newTranscripts = [...prev, { 
                id: Date.now().toString(), 
                text, 
                isFinal: true 
              }];
              
              // Limit the number of transcripts
              if (newTranscripts.length > maxTranscripts) {
                return newTranscripts.slice(newTranscripts.length - maxTranscripts);
              }
              return newTranscripts;
            } 
            // For interim results, update the last non-final transcript or add new one
            else {
              const lastNonFinalIndex = prev.findIndex(t => !t.isFinal);
              if (lastNonFinalIndex >= 0) {
                const updated = [...prev];
                updated[lastNonFinalIndex] = { 
                  ...updated[lastNonFinalIndex], 
                  text 
                };
                return updated;
              } else {
                return [...prev, { 
                  id: Date.now().toString(), 
                  text, 
                  isFinal: false 
                }];
              }
            }
          });
        }
      } catch (err) {
        console.error('Error handling data received:', err);
      }
    };

    // Register data received handler
    room.on('data', handleDataReceived);
    
    // Also listen for custom agent events
    room.on('agent_event', (event: any) => {
      if (event.type === 'stt_result') {
        const { text, is_final } = event.data;
        
        setTranscripts(prev => {
          if (is_final) {
            const newTranscripts = [...prev, { 
              id: Date.now().toString(), 
              text, 
              isFinal: true 
            }];
            
            if (newTranscripts.length > maxTranscripts) {
              return newTranscripts.slice(newTranscripts.length - maxTranscripts);
            }
            return newTranscripts;
          } else {
            const lastNonFinalIndex = prev.findIndex(t => !t.isFinal);
            if (lastNonFinalIndex >= 0) {
              const updated = [...prev];
              updated[lastNonFinalIndex] = { 
                ...updated[lastNonFinalIndex], 
                text 
              };
              return updated;
            } else {
              return [...prev, { 
                id: Date.now().toString(), 
                text, 
                isFinal: false 
              }];
            }
          }
        });
      }
    });

    return () => {
      room.off('data', handleDataReceived);
    };
  }, [room, maxTranscripts]);

  const clearTranscripts = () => {
    setTranscripts([]);
  };

  return (
    <div className="transcription-container bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Real-time Transcription</h3>
        <button 
          onClick={clearTranscripts}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Clear
        </button>
      </div>
      
      <div className="transcripts-list max-h-[400px] overflow-y-auto p-2 border border-gray-200 rounded bg-gray-50">
        {transcripts.length === 0 ? (
          <p className="text-gray-500 italic p-2">Start speaking to see transcription...</p>
        ) : (
          transcripts.map(transcript => (
            <div 
              key={transcript.id} 
              className={`p-2 my-1 rounded ${
                transcript.isFinal 
                  ? 'bg-white border border-gray-200' 
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <p className="text-gray-800">{transcript.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                {transcript.isFinal ? 'Final' : 'Interim'}
              </p>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}
