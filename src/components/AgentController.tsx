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
      await fetch(`/api/agent?room=${roomName}`, { method: 'DELETE' });
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
      
      const response = await fetch('/api/agent', {
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
          // Direct API call
          const response = await fetch(`/api/agent?room=${roomName}`);
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
                  await fetch(`/api/agent?room=${roomName}`, { method: 'DELETE' });
                  console.log('Cleaned up failed agent connection before retry');
                  // Small delay before retry
                  setTimeout(() => connectAgent(), 1000);
                } catch (e) {
                  console.error('Error during retry preparation:', e);
                }
              } else {
                console.log('Agent connection failed after max retries');
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
        // Direct API call
        const response = await fetch(`/api/agent?room=${roomName}`);
        
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
      // Direct API call
      const response = await fetch(`/api/agent?room=${roomName}`, {
        method: 'DELETE',
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

  return (
    <div className="p-4 bg-gray-100 rounded-lg mb-4">
      <h3 className="text-lg font-medium mb-2">AI Assistant</h3>
      
      <div className="mb-4">
        <p>Status: 
          <span className={`ml-2 font-medium ${
            agentStatus === 'connected' ? 'text-green-600' : 
            agentStatus === 'connecting' ? 'text-yellow-600' : 
            agentStatus === 'error' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {agentStatus === 'connected' ? 'Connected' : 
             agentStatus === 'connecting' ? 'Connecting...' : 
             agentStatus === 'error' ? 'Connection Error' : 'Not Connected'}
          </span>
        </p>
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="flex space-x-2">
        {/* Buttons can be removed entirely if UI is never shown, but leaving for potential debug */}
        {agentStatus !== 'connected' && agentStatus !== 'connecting' && (
          <button
            onClick={connectAgent}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Connecting...' : 'Connect AI Assistant'}
          </button>
        )}
        
        {(agentStatus === 'connected' || agentStatus === 'connecting') && (
          <button
            onClick={disconnectAgent}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Disconnecting...' : 'Disconnect AI Assistant'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentController;
