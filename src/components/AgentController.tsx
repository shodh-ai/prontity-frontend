'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface AgentControllerProps {
  roomName: string;
  pageType: string;
}

const AgentController: React.FC<AgentControllerProps> = ({ roomName, pageType }) => {
  // Agent status: 'idle', 'connecting', 'connected', 'error', 'disconnected'
  const [agentStatus, setAgentStatus] = useState<string>('idle');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Configure agent server URL
  const AGENT_SERVER_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'http://localhost:8080';
  
  // Define connectAgent with useCallback to avoid dependency cycle
  const connectAgent = useCallback(async () => {
    // Avoid concurrent connection attempts
    if (isLoading || agentStatus === 'connecting' || agentStatus === 'connected') {
      console.log('AgentController: Connection attempt skipped (already connecting or connected). Status:', agentStatus);
      return;
    }
    
    console.log('AgentController: Initiating agent connection...');
    setIsLoading(true);
    setError(null);
    
    // First ensure any previous agent is disconnected
    try {
      await fetch(`${AGENT_SERVER_URL}/disconnect-agent/${roomName}`, { method: 'POST' });
      console.log('AgentController: Cleaned up any previous agent connections');
    } catch (err) {
      // Ignore errors during cleanup
      console.log('AgentController: Cleanup before connect (non-critical):', err);
    }
    
    try {
      // Custom instructions based on page type
      let instructions = 'You are a helpful TOEFL practice assistant.';
      
      switch(pageType) {
        case 'speaking':
          instructions = 'You are a TOEFL speaking practice assistant. Listen to the student\'s response and provide helpful feedback on pronunciation, fluency, and content organization.';
          break;
        case 'writing':
          instructions = 'You are a TOEFL writing practice assistant. Provide guidance on essay structure, grammar, and vocabulary usage.';
          break;
        case 'vocab':
          instructions = 'You are a TOEFL vocabulary coach. Help the student learn and practice academic vocabulary.';
          break;
        default:
          // Use default instructions
      }
      
      console.log(`AgentController: Connecting agent for ${pageType} page`);
      
      // Connect agent using the agent server instead of the API route
      const response = await fetch(`${AGENT_SERVER_URL}/connect-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: roomName,
          identity: 'ai-assistant',
          instructions: instructions,
          pagePath: pageType,
          voice: 'Puck' // Ensure we're using a compatible voice
        }),
      });
      
      const data = await response.json();
      console.log('Agent connecting raw response:', data);
      
      if (response.ok) {
        setAgentStatus('connecting');
        console.log('Agent connecting response:', data);
      } else {
        setError(data.message || 'Failed to connect agent');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error connecting agent:', err);
      setError('Failed to connect agent');
      setIsLoading(false);
    }
  }, [roomName, pageType, agentStatus, isLoading]);

  // Poll for status if 'connecting' and implement retry logic
  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    if (agentStatus === 'connecting') {
      console.log('Starting agent status polling...');
      const intervalId = setInterval(async () => {
        try {
          // Use agent server endpoint instead of API route
          const response = await fetch(`${AGENT_SERVER_URL}/agent-status/${roomName}`);
          if (response.ok) {
            const data = await response.json();
            console.log('Agent polling result:', data);
            
            // Check for error status
            if (data.status === 'error') {
              if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.log(`Agent reported error, retry attempt ${retryCount}/${MAX_RETRIES}`);
                // Attempt to reconnect
                try {
                  await connectAgent();
                } catch (reconnectErr) {
                  console.error('Error during reconnect attempt:', reconnectErr);
                }
              } else {
                clearInterval(intervalId);
                setAgentStatus('error');
                setError('Agent connection failed after multiple attempts');
                setIsLoading(false);
              }
            } else {
              // Update status normally
              setAgentStatus(data.status || 'unknown');
              console.log('Agent polling status:', data.status);
              
              // Stop polling once connected
              if (data.status === 'connected') {
                console.log('Agent successfully connected!');
                setIsLoading(false);
              }
            }
          }
        } catch (err) {
          console.error('Error polling agent status:', err);
        }
      }, 2000);
      
      return () => {
        clearInterval(intervalId);
        console.log('Stopping agent status polling');
      };
    }
  }, [agentStatus, roomName, connectAgent]);
  
  // Fetch agent status on component mount
  useEffect(() => {
    const checkAgentStatus = async () => {
      try {
        // Use agent server endpoint instead of API route
        const response = await fetch(`${AGENT_SERVER_URL}/agent-status/${roomName}`);
        
        if (response.ok) {
          const data = await response.json();
          setAgentStatus(data.status || 'unknown');
          console.log('Agent status:', data.status);
        }
      } catch (err) {
        console.error('Error checking agent status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAgentStatus();
  }, [roomName]);

  const disconnectAgent = async () => {
    if (isLoading || agentStatus === 'disconnected' || agentStatus === 'error') {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use agent server endpoint instead of API route
      const response = await fetch(`${AGENT_SERVER_URL}/disconnect-agent/${roomName}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAgentStatus('disconnected');
        console.log('Agent disconnected response:', data);
      } else {
        setError(data.message || 'Failed to disconnect agent');
      }
    } catch (err) {
      console.error('Error disconnecting agent:', err);
      setError('Failed to disconnect agent');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-connect agent when component mounts if not already connected
  useEffect(() => {
    if (agentStatus !== 'connected' && agentStatus !== 'connecting') {
      connectAgent();
    }
  }, [agentStatus, connectAgent]);
  
  // Return null since this component now works silently in the background
  return null;
};

export default AgentController;
