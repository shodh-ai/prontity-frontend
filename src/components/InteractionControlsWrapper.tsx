import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, LocalParticipant } from 'livekit-client';
import { useDoubtHandler } from './DoubtHandlerProvider';
import InteractionControlsWithRpc from './ui/InteractionControlsWithRpc';
import { AgentInteractionClientImpl } from '@/generated/protos/interaction';

// LiveKit RPC adapter implementation
class LiveKitRpcAdapter {
  constructor(
    private localParticipant: LocalParticipant,
    private agentIdentity: string,
    private timeout: number = 10000, 
  ) {}

  async request(service: string, method: string, data: Uint8Array): Promise<Uint8Array> {
    // Create a promise that will resolve with the RPC response
    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`RPC call to ${service}.${method} timed out after ${this.timeout}ms`));
      }, this.timeout);

      // Handle the data received event with proper LiveKit types
      const handler = (payload: Uint8Array, kind: any) => {
        // Since we can't directly get the sender identity, we'll parse the payload
        // and check if it's a response to our RPC call
        try {
          const responseStr = new TextDecoder().decode(payload);
          const responseData = JSON.parse(responseStr);
          
          // If it's a response to our RPC call (service and method match)
          if (responseData.service === service && responseData.method === method) {
            clearTimeout(timeout);
            this.localParticipant.off(RoomEvent.DataReceived, handler);
            
            // Convert the data array back to Uint8Array
            if (responseData.data && Array.isArray(responseData.data)) {
              resolve(new Uint8Array(responseData.data));
            } else {
              reject(new Error('Invalid RPC response format'));
            }
          }
        } catch (e) {
          // Not our response or not in the expected format, ignore
        }
      };

      // Subscribe to data messages
      this.localParticipant.on(RoomEvent.DataReceived, handler);

      // Send the RPC request
      const rpcRequestData = {
        service,
        method,
        data: Array.from(data),
      };

      // Send as reliable data channel message to the agent
      try {
        this.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(rpcRequestData)),
          { destinationIdentities: [this.agentIdentity], topic: "rpc" }
        );
      } catch (e) {
        clearTimeout(timeout);
        this.localParticipant.off(RoomEvent.DataReceived, handler);
        reject(e);
      }
    });
  }
}

interface InteractionControlsWrapperProps {
  roomName: string;
  userName: string;
  className?: string;
}

const InteractionControlsWrapper: React.FC<InteractionControlsWrapperProps> = ({
  roomName,
  userName,
  className = ''
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [agentClient, setAgentClient] = useState<AgentInteractionClientImpl | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const doubtHandler = useDoubtHandler();

  // Initialize room and LiveKit connection
  useEffect(() => {
    const initRoom = async () => {
      try {
        // Create a new Room instance
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // Get token from your token service
        const tokenEndpoint = `/api/livekit?room=${roomName}&username=${userName}`;
        const response = await fetch(tokenEndpoint);
        const { token } = await response.json();

        if (!token) {
          console.error('Failed to get token');
          return;
        }

        // Connect to the room
        await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://localhost:7880', token);
        console.log('Connected to LiveKit room:', roomName);

        // Find the agent participant
        const agentIdentity = [...newRoom.remoteParticipants.values()]
          .find(p => p.identity.startsWith('agent-'))?.identity;

        if (!agentIdentity) {
          console.warn('No agent participant found in the room');
          setRoom(newRoom);
          return;
        }

        // Create the RPC adapter
        const rpcAdapter = new LiveKitRpcAdapter(
          newRoom.localParticipant,
          agentIdentity
        );

        // Create the AgentInteractionClient
        const client = new AgentInteractionClientImpl(rpcAdapter);
        
        setRoom(newRoom);
        setAgentClient(client);
        setIsConnected(true);

        // Cleanup on unmount
        return () => {
          newRoom.disconnect();
        };
      } catch (error) {
        console.error('Error connecting to LiveKit:', error);
      }
    };

    if (roomName && userName) {
      initRoom();
    }

    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [roomName, userName]);

  // For testing purposes, create a mock agent client if the real one isn't available
  const mockAgentClient = {
    HandleFrontendButton: async (request: any) => {
      console.log('Mock agent client received request:', request);
      // Return mock response
      return {
        dataPayload: JSON.stringify({
          message: "This is a mock response. The system is not connected to a live agent.",
          ui_actions: []
        })
      };
    }
  };
  
  // Show connection status
  const connectionStatus = !isConnected ? 
    <div className="text-xs text-amber-600 mb-2">⚠️ Not connected to doubt service (demo mode)</div> : null;
    
  // Always render controls, using mock client as fallback
  const clientToUse = agentClient || mockAgentClient as any;

  return (
    <div className={`interaction-controls-wrapper ${className}`}>
      {connectionStatus}
      
      <InteractionControlsWithRpc
        room={room || new Room()} // Provide an empty Room instance if null
        userName={userName}
        agentServiceClient={clientToUse}
        onDoubtResponse={(response) => {
          doubtHandler.handleDoubtResponse(response);
        }}
      />
    </div>
  );
};

export default InteractionControlsWrapper;
