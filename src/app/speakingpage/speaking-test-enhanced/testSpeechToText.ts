// testSpeechToText.ts - Helper functions for testing Speech-to-Text functionality

/**
 * Create a test function for STT functionality
 * 
 * @param options Configuration options
 * @returns A function that can be used to test STT
 */
export const createTestSTTFunction = (options: {
  editorRef: any; 
  setLiveTranscription: (value: string) => void;
  handleSTTResult?: (data: any) => void;
  socket?: any;
  isConnected?: boolean;
}) => {
  
  const { editorRef, setLiveTranscription, handleSTTResult, socket, isConnected } = options;
  
  return () => {
    console.log('Testing STT functionality...');
    
    // Reset the editor and transcription state first
    if (editorRef.current?.editor) {
      editorRef.current.editor.commands.setContent('');
    }
    
    // Clear live transcription
    setLiveTranscription('');
    
    // For testing: Use a mock STT result
    const testContent = 'This is a test of the speech-to-text system. ';
    
    // Process the test data
    if (handleSTTResult) {
      handleSTTResult({ transcript_segment: testContent });
      console.log('Processed test STT data locally');
    }
    
    // Also try to ping the server to check connection
    if (socket && isConnected) {
      console.log('Sending ping to server to test connection...');
      
      // Send a test ping
      socket.emit('ping_server', { timestamp: Date.now() });
      
      // Also try to send a test audio chunk
      socket.emit('test_stt', { test: true, timestamp: Date.now() });
      console.log('Sent test audio chunk to server');
    }
  };
};
