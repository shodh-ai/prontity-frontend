'use client';

import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, LocalParticipant, RemoteParticipant, RoomOptions, VideoPresets } from 'livekit-client';
import { 
  AudioRenderer, 
  ConnectionState, 
  useConnectionState, 
  useLocalParticipant,
  useRoom
} from '@livekit/components-react';
import '@livekit/components-styles';

interface LiveKitSTTClientProps {
  token: string;
  wsUrl: string;
  roomName: string;
  username: string;
}

export function LiveKitSTTClient({ token, wsUrl, roomName, username }: LiveKitSTTClientProps) {
  const [transcripts, setTranscripts] = useState<Array<{ id: string, text: string, isFinal: boolean }>>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const [agentData, setAgentData] = useState<{id: string, connected: boolean} | null>(null);

  // Connect to room and set up STT
  useEffect(() => {
    if (!token || !wsUrl) return;
    
    const connectToRoom = async () => {
      try {
        const roomOptions: RoomOptions = {
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            simulcast: true,
            videoSimulcastLayers: [VideoPresets.h90, VideoPresets.h180],
          },
          // For connecting to LiveKit Agent
          agentEvents: true
        };

        const room = new Room(roomOptions);
        roomRef.current = room;

        // Set up room event listeners
        room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
        room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        room.on(RoomEvent.DataReceived, handleDataReceived);
        
        // Custom event listener for STT data from the agent
        room.on('agent_event', (event: any) => {
          if (event.type === 'stt_result') {
            handleTranscript(event.data);
          }
        });

        // Connect to LiveKit room
        await room.connect(wsUrl, token);
        console.log('Connected to room:', room.name);

        // Check if room has agents with STT capability
        const agents = room.participants.filter(p => p.metadata && JSON.parse(p.metadata).isAgent);
        if (agents.length > 0) {
          const agent = agents[0];
          console.log('Found agent:', agent.identity);
          setAgentData({
            id: agent.identity,
            connected: true
          });
        }

        // Enable audio
        await startListening();
      } catch (err) {
        console.error('Error connecting to LiveKit room:', err);
        setError(`Error connecting to room: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    connectToRoom();

    // Cleanup when component unmounts
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      stopListening();
    };
  }, [token, wsUrl]);

  const handleParticipantConnected = (participant: RemoteParticipant) => {
    console.log('Participant connected:', participant.identity);
    // Check if participant is an agent
    if (participant.metadata) {
      try {
        const metadata = JSON.parse(participant.metadata);
        if (metadata.isAgent) {
          console.log('Agent connected:', participant.identity);
          setAgentData({
            id: participant.identity,
            connected: true
          });
        }
      } catch (e) {
        console.error('Error parsing participant metadata:', e);
      }
    }
  };

  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    console.log('Participant disconnected:', participant.identity);
    if (agentData && agentData.id === participant.identity) {
      setAgentData(prev => prev ? {...prev, connected: false} : null);
    }
  };

  const handleDataReceived = (data: Uint8Array, participant?: RemoteParticipant) => {
    try {
      const decodedData = new TextDecoder().decode(data);
      const parsedData = JSON.parse(decodedData);
      
      if (parsedData.type === 'stt_result') {
        handleTranscript(parsedData.data);
      }
    } catch (err) {
      console.error('Error handling data received:', err);
    }
  };

  const handleTranscript = (data: { text: string, isFinal: boolean }) => {
    setTranscripts(prev => {
      // If this is a new transcript or an update to the last non-final one
      if (data.isFinal) {
        return [...prev, { id: Date.now().toString(), text: data.text, isFinal: true }];
      } else {
        // For interim results, update the last non-final transcript or add a new one
        const lastNonFinal = prev.findIndex(t => !t.isFinal);
        if (lastNonFinal >= 0) {
          const updated = [...prev];
          updated[lastNonFinal] = { ...updated[lastNonFinal], text: data.text };
          return updated;
        } else {
          return [...prev, { id: Date.now().toString(), text: data.text, isFinal: false }];
        }
      }
    });
  };

  const startListening = async () => {
    try {
      if (!roomRef.current) return;

      // Request audio permissions
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRef.current = audioStream;

      // Publish audio track to the room
      await roomRef.current.localParticipant.publishTrack(audioStream.getAudioTracks()[0]);
      
      // Request the LiveKit Agent to enable STT
      if (roomRef.current && agentData?.connected) {
        // Send message to agent to enable STT
        const message = {
          type: 'enable_stt',
          data: {
            language: 'en-US',  // Default to English, could be made configurable
            interim_results: true
          }
        };
        
        roomRef.current.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(message)),
          { reliable: true }
        );
      }

      setIsListening(true);
    } catch (err) {
      console.error('Error starting microphone:', err);
      setError(`Microphone access error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const stopListening = () => {
    if (audioRef.current) {
      audioRef.current.getTracks().forEach(track => track.stop());
      audioRef.current = null;
    }
    
    if (roomRef.current) {
      // Send message to agent to disable STT
      const message = {
        type: 'disable_stt',
        data: {}
      };
      
      roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        { reliable: true }
      );
    }
    
    setIsListening(false);
  };

  const toggleListening = async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  };

  // Room and participant hooks from LiveKit Components
  const room = useRoom();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Room: {roomName}</h2>
          <p className="text-sm text-gray-600">User: {username}</p>
          <p className="text-sm text-gray-600">
            Connection Status: {
              connectionState === ConnectionState.Connected
                ? <span className="text-green-600">Connected</span>
                : connectionState === ConnectionState.Connecting
                  ? <span className="text-yellow-600">Connecting...</span>
                  : <span className="text-red-600">Disconnected</span>
            }
          </p>
          {agentData && (
            <p className="text-sm text-gray-600">
              Agent Status: {agentData.connected ? 
                <span className="text-green-600">Connected</span> : 
                <span className="text-red-600">Disconnected</span>}
            </p>
          )}
        </div>
        <button
          onClick={toggleListening}
          className={`px-4 py-2 rounded ${
            isListening 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isListening ? 'Stop Microphone' : 'Start Microphone'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-semibold mb-2">Instructions</h3>
        <p className="text-gray-700">Speak clearly into your microphone. Your speech will be transcribed in real-time below.</p>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg min-h-[300px] max-h-[500px] overflow-y-auto">
        <h3 className="font-semibold mb-2">Transcription</h3>
        {transcripts.length === 0 ? (
          <p className="text-gray-500 italic">Speech transcription will appear here when you start speaking...</p>
        ) : (
          <div className="space-y-2">
            {transcripts.map((transcript) => (
              <div 
                key={transcript.id} 
                className={`p-2 rounded ${
                  transcript.isFinal 
                    ? 'bg-white border border-gray-200' 
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                <p className="text-gray-800">{transcript.text}</p>
                <p className="text-xs text-gray-500">{transcript.isFinal ? 'Final' : 'Interim'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Audio renderer for connected participants */}
      <AudioRenderer />
    </div>
  );
}
