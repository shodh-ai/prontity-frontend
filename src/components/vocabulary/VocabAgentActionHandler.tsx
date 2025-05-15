'use client';

import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/state/canvasStore';

// Debug style for visual indicator
const debugStyle = {
  position: 'fixed',
  bottom: '10px',
  right: '10px',
  background: 'rgba(0,0,0,0.8)',
  color: 'white',
  padding: '10px',
  borderRadius: '5px',
  zIndex: 9999,
  fontSize: '12px',
  maxWidth: '300px',
  maxHeight: '200px',
  overflow: 'auto'
} as React.CSSProperties;

/**
 * This component listens for special action messages from the LiveKit agent
 * and performs the corresponding actions, such as image generation.
 */
const VocabAgentActionHandler = () => {
  const [lastActionId, setLastActionId] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<{messages: string[], actionDetected: boolean}>({ 
    messages: [], 
    actionDetected: false 
  });
  
  // Access the isGeneratingAI state and setIsGeneratingAI action from the store
  const setIsGeneratingAI = useCanvasStore(state => state.setIsGeneratingAI);
  const isGeneratingAI = useCanvasStore(state => state.isGeneratingAI);
  
  // Helper function to add debug messages
  const addDebugMessage = (message: string) => {
    // Re-enable debug messages
    console.log(`[VocabAgentActionHandler] ${message}`);
    setDebugInfo(prev => ({
      ...prev,
      messages: [...prev.messages.slice(-9), message] // Keep last 10 messages
    }));
  };
  
  useEffect(() => {
    // Function to scan the DOM for action messages from LiveKit
    const processActionMessages = () => {
      // Debug checkpoint 1: Starting scan
      addDebugMessage(`Scanning for action messages (${new Date().toLocaleTimeString()})`);
      
      // Look for action metadata in LiveKit transcript messages
      const transcriptElements = document.querySelectorAll('.lk-transcript-message');
      addDebugMessage(`Found ${transcriptElements.length} transcript elements`);
      
      // DEBUG: Log some transcript elements to see their structure
      if (transcriptElements.length > 0) {
        const lastElement = transcriptElements[transcriptElements.length - 1];
        addDebugMessage(`Last element HTML: ${lastElement.outerHTML.substring(0, 200)}...`);
        // Convert attributes to array properly
        const attributesArray = Array.from(lastElement.attributes);
        addDebugMessage(`Last element attributes: ${attributesArray.map(attr => `${attr.name}=${attr.value}`).join(', ')}`);
      }
      
      transcriptElements.forEach(element => {
        try {
          // Check for metadata in the data attributes
          // Check for metadata in different possible attributes
          const metadataStr = element.getAttribute('data-metadata') || element.getAttribute('data-meta');
          if (!metadataStr) {
            addDebugMessage('No metadata found in element');
            return;
          }
          
          // Debug checkpoint 2: Found metadata
          addDebugMessage(`Found metadata string: ${metadataStr.substring(0, 50)}...`);
          
          // Try to parse the metadata
          let metadata;
          try {
            metadata = JSON.parse(metadataStr);
            addDebugMessage(`Parsed metadata object: ${JSON.stringify(metadata).substring(0, 100)}...`);
          } catch (error) {
            addDebugMessage(`Error parsing metadata JSON: ${error}`);
            return;
          }
          
          if (!metadata) {
            addDebugMessage('Metadata parsed as null or undefined');
            return;
          }
          
          // Look for dom_actions in different possible structures
          let domActions = null;
          if (metadata.dom_actions) {
            domActions = metadata.dom_actions;
            addDebugMessage('Found dom_actions directly in metadata');
          } else if (metadata.metadata && metadata.metadata.dom_actions) {
            domActions = metadata.metadata.dom_actions;
            addDebugMessage('Found dom_actions nested in metadata.metadata');
          }
          
          if (!domActions) {
            addDebugMessage('No dom_actions found in metadata structure');
            return;
          }
          
          addDebugMessage(`Found dom_actions: ${JSON.stringify(domActions).substring(0, 50)}...`);
          
          domActions.forEach((actionData: any) => {
            if (actionData.action === 'generate_image' && actionData.payload) {
              // Debug checkpoint 3: Found generate_image action
              addDebugMessage(`⭐ FOUND GENERATE_IMAGE ACTION: ${JSON.stringify(actionData.action)}`);
              setDebugInfo(prev => ({ ...prev, actionDetected: true }));
              
              // Create a unique ID for this action to avoid duplicate processing
              const actionId = `${actionData.payload.word}-${Date.now()}`;
              
              // Skip if we've already processed this action
              if (actionId === lastActionId) {
                addDebugMessage(`Action already processed: ${actionId}`);
                return;
              }
              setLastActionId(actionId);
              
              addDebugMessage(`Processing action ID: ${actionId}`);
              console.log('VocabAgentActionHandler: Processing generate_image action', actionData);
              
              // Extract prompt and other necessary data
              const { prompt, word } = actionData.payload;
              
              if (prompt) {
                // Call the Gemini API endpoint directly to generate the image
                console.log(`VocabAgentActionHandler: Generating image for "${word}" with prompt: ${prompt}`);
                
                // Set generating state to true
                setIsGeneratingAI(true);
                
                // Send the request to the API endpoint
                fetch('/api/ai/gemini-generate', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    prompt: prompt,
                    context: word
                  }),
                })
                .then(response => {
                  if (!response.ok) {
                    throw new Error(`Error: ${response.status} ${response.statusText}`);
                  }
                  return response.json();
                })
                .then(data => {
                  if (data.imageData) {
                    // Convert the base64 image data to a data URL
                    const imageUrl = `data:image/png;base64,${data.imageData}`;
                    
                    console.log('Generated image URL from agent action:', imageUrl.substring(0, 50) + '...');
                    
                    // Pre-load the image to get dimensions
                    const img = document.createElement('img');
                    img.onload = () => {
                      // Dispatch custom event for the new page layout
                      const imageEvent = new CustomEvent('ai-image-generated', {
                        detail: {
                          imageUrl: imageUrl,
                          imageId: `agent-${Date.now()}`,
                          width: img.width || 400,
                          height: img.height || 300
                        }
                      });
                      window.dispatchEvent(imageEvent);
                      
                      // Reset the generating state
                      setTimeout(() => setIsGeneratingAI(false), 500);
                    };
                    
                    img.onerror = () => {
                      console.error('Failed to load generated image');
                      setIsGeneratingAI(false);
                    };
                    
                    // Start loading the image
                    img.src = imageUrl;
                  } else {
                    console.error('No image data in response');
                    setIsGeneratingAI(false);
                  }
                })
                .catch(error => {
                  console.error('Error generating image:', error);
                  setIsGeneratingAI(false);
                });
              }
            }
          });
        } catch (error) {
          console.error('Error processing action message:', error);
        }
      });
    };
    
    // Run the processor on component mount and set up an interval
    processActionMessages();
    const intervalId = setInterval(processActionMessages, 2000); // Check every 2 seconds
    
    return () => clearInterval(intervalId);
  }, [lastActionId, setIsGeneratingAI]);
  
  // Show debug UI to help troubleshoot
  return debugInfo.actionDetected || debugInfo.messages.length > 0 ? (
    <div style={debugStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
        VocabAgentActionHandler Debug
        {debugInfo.actionDetected && <span style={{ color: '#4CAF50' }}> - Action Detected! ✅</span>}
      </div>
      <div>
        {debugInfo.messages.map((msg, i) => (
          <div key={i} style={{ fontSize: '10px', marginBottom: '2px' }}>
            {msg}
          </div>
        ))}
      </div>
    </div>
  ) : null;
};

export default VocabAgentActionHandler;
