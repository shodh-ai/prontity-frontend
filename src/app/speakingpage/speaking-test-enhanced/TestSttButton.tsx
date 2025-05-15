'use client';

import React from 'react';
import { TiptapEditorHandle } from '@/components/TiptapEditor';

interface TestSttButtonProps {
  editorRef: React.RefObject<TiptapEditorHandle>;
  socket: any;
  isConnected: boolean;
  className?: string;
}

/**
 * A button component specifically for testing STT functionality
 * that prevents duplicate text issues by clearing the editor first
 */
const TestSttButton: React.FC<TestSttButtonProps> = ({
  editorRef,
  socket,
  isConnected,
  className
}) => {
  
  // Test STT function that first clears the editor
  const testSpeechToText = () => {
    console.log('Testing STT functionality...');
    
    // First, clear the editor to avoid duplicate content
    if (editorRef.current?.editor) {
      editorRef.current.editor.commands.setContent('');
    }
    
    // Create a more comprehensive test transcription to simulate real speech
    const testContent = 'This is a test of the speech-to-text system. The microphone appears to be working but Deepgram is returning empty transcripts. This simulates what should appear when you speak into the microphone.';
    
    // Simulate incremental updates like a real transcription would
    const segments = testContent.split('. ');
    let currentContent = '';
    
    // Function to update editor with incremental content
    const updateWithSegment = (index) => {
      if (index >= segments.length) return;
      
      // Add the next segment
      currentContent += segments[index] + (index < segments.length - 1 ? '. ' : '');
      
      // Update the editor
      if (editorRef.current?.editor) {
        editorRef.current.editor.commands.setContent(`<p>${currentContent}</p>`);
        console.log('Updated editor with test segment:', segments[index]);
      }
      
      // Schedule the next segment update
      if (index < segments.length - 1) {
        setTimeout(() => updateWithSegment(index + 1), 600);
      }
    };
    
    // Start the incremental updates
    updateWithSegment(0);
    
    // Also test server connectivity
    if (socket && isConnected) {
      // Send a test ping
      socket.emit('ping_server', { timestamp: Date.now() });
      
      // Send a test STT request
      socket.emit('test_stt', { 
        test: true, 
        timestamp: Date.now(),
        message: 'Testing STT socket connection'
      });
      console.log('Sent test requests to server');
    }
  };
  
  return (
    <button
      onClick={testSpeechToText}
      className={className || "inline-flex justify-center py-2 px-4 border border-orange-500 rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none"}
    >
      Test Speech-to-Text
    </button>
  );
};

export default TestSttButton;
