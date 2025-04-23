'use client';

import { useState, useEffect } from 'react';

interface AgentControllerProps {
  roomName: string;
}

export default function AgentController({ roomName }: AgentControllerProps) {
  const [agentStatus, setAgentStatus] = useState<string>('not_connected');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for agent status
  useEffect(() => {
    if (agentStatus === 'connecting') {
      const intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/agent?room=${roomName}`);
          const data = await response.json();
          setAgentStatus(data.status);
          
          if (data.status === 'connected' || data.status === 'error') {
            clearInterval(intervalId);
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Error polling agent status:', err);
          setError('Failed to check agent status');
          clearInterval(intervalId);
          setIsLoading(false);
        }
      }, 2000);
      
      return () => clearInterval(intervalId);
    }
  }, [agentStatus, roomName]);
  
  // Check initial status on component mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/agent?room=${roomName}`);
        const data = await response.json();
        setAgentStatus(data.status);
      } catch (err) {
        console.error('Error checking agent status:', err);
      }
    };
    
    checkStatus();
  }, [roomName]);

  const connectAgent = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: roomName,
          identity: 'ai-assistant',
          instructions: 'You are a TOEFL speaking practice assistant.'
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAgentStatus('connecting');
      } else {
        setError(data.message || 'Failed to connect agent');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error connecting agent:', err);
      setError('Failed to connect agent');
      setIsLoading(false);
    }
  };

  const disconnectAgent = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/agent?room=${roomName}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAgentStatus('not_connected');
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
}
