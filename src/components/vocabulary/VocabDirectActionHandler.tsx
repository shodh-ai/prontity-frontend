'use client';

import { useEffect, useState, useRef } from 'react';
import { useCanvasStore } from '@/state/canvasStore';
import { usePathname } from 'next/navigation';

// Define interfaces for the vocab agent response
interface VocabAgentPayload {
  prompt: string;
  word: string;
  action_type: string;
  api_endpoint: string;
  api_method: string;
  api_data: {
    prompt: string;
    context: string;
  };
}

interface VocabAgentResponse {
  action: string;
  payload: VocabAgentPayload;
  response: string;
}

/**
 * Direct action handler for vocabulary agent
 * This component automatically polls the vocab agent and processes image generation
 * actions without requiring user interaction through UI buttons
 */
const VocabDirectActionHandler = () => {
  // State for polling and processing
  const [polling, setPolling] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastProcessedTime, setLastProcessedTime] = useState(Date.now());
  const [debug, setDebug] = useState<string[]>([]);
  const [debugVisible, setDebugVisible] = useState(true); // Always show debug panel for troubleshooting
  const [exampleWords] = useState<string[]>(['ephemeral', 'ubiquitous', 'serendipity', 'resilience', 'paradigm']);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Canvas store actions
  const setIsGeneratingAI = useCanvasStore(state => state.setIsGeneratingAI);
  const handleAIImageCommand = useCanvasStore(state => state.handleAIImageCommand);
  const isGeneratingAI = useCanvasStore(state => state.isGeneratingAI);
  const setViewport = useCanvasStore(state => state.setViewport);
  
  // Debug logging
  const addDebug = (message: string) => {
    console.log(`[VocabDirectAction] ${message}`);
    setDebug(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };
  
  // Get reference to the vocabpage's handlePromptSubmit function
  const pathname = usePathname();
  const isVocabPage = pathname === '/vocabpage';
  const [pageHandlePromptSubmit, setPageHandlePromptSubmit] = useState<((prompt: string) => void) | null>(null);
  
  // Find the TextInput component and its onSubmit handler
  useEffect(() => {
    if (isVocabPage && typeof window !== 'undefined') {
      // Try to find the function reference in the global scope (added by vocabpage)
      if ((window as any).__vocabpage_handlePromptSubmit) {
        setPageHandlePromptSubmit((window as any).__vocabpage_handlePromptSubmit);
        addDebug('Found vocabpage handlePromptSubmit function');
      } else {
        addDebug('Warning: Could not find vocabpage handlePromptSubmit function');
      }
    }
  }, [isVocabPage]);
  
  // Process a vocabulary word by sending a request to the agent
  const processVocabWord = async (word: string) => {
    if (processing || isGeneratingAI) return;
    
    try {
      setProcessing(true);
      addDebug(`Processing word: ${word}`);
      
      // Send request to the vocab agent
      const response = await fetch('http://localhost:5005/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          transcript: `Can you help me visualize the word ${word} with an image?` 
        }),
      });
      
      if (!response.ok) {
        addDebug(`Agent error: ${response.status}`);
        return;
      }
      
      const data: VocabAgentResponse = await response.json();
      addDebug(`Agent response: ${data.action}`);
      
      // If it's an image generation action, get the prompt and use the page's submit handler
      if (data.action === 'generate_image' && data.payload) {
        const { prompt } = data.payload;
        
        if (pageHandlePromptSubmit) {
          // Use the vocabpage's existing handler which we know works
          addDebug(`Using vocabpage handler with prompt: ${prompt.substring(0, 30)}...`);
          pageHandlePromptSubmit(prompt);
        } else {
          // Fallback to our direct implementation
          addDebug('Using fallback direct implementation');
          await generateImage(data.payload);
        }
      }
    } catch (error) {
      addDebug(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProcessing(false);
      setLastProcessedTime(Date.now());
    }
  };
  
  // Generate an image based on agent payload
  const generateImage = async (payload: VocabAgentPayload) => {
    try {
      const { prompt, word } = payload;
      addDebug(`Generating image for "${word}": ${prompt.substring(0, 30)}...`);
      setIsGeneratingAI(true);
      
      // Get the current canvas content as an image (same as vocabpage implementation)
      const stageElement = document.querySelector('canvas');
      let imageData;
      
      if (stageElement) {
        // Capture the current canvas as a data URL
        addDebug('Capturing current canvas content');
        const dataUrl = stageElement.toDataURL('image/png');
        // Remove the data URL prefix for the API
        imageData = dataUrl.split(',')[1];
      } else {
        addDebug('No canvas element found');
      }
      
      // Call the image generation API
      const response = await fetch('/api/ai/gemini-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageData, // Include captured canvas image data
          context: word
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        addDebug(`Error response: ${errorText.substring(0, 100)}...`);
        throw new Error(`Image API error: ${response.status}`);
      }
      
      const data = await response.json();
      addDebug(`API response received: ${JSON.stringify(data).substring(0, 50)}...`);
      
      if (data.imageData) {
        // Convert base64 to image URL
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        addDebug('Image generated successfully');
        
        // DIRECT IMAGE DISPLAY: Dispatch event for VocabImageOverlay to catch and display
        try {
          // Create and dispatch a custom event with the image URL
          addDebug('Dispatching image event for overlay display');
          const imageEvent = new CustomEvent('vocab-image-generated', {
            detail: {
              imageUrl,
              word,
              prompt
            }
          });
          window.dispatchEvent(imageEvent);
          addDebug('Image event dispatched successfully');
        } catch (eventError) {
          addDebug(`Error dispatching image event: ${eventError}`);
        }
        
        // Continue with canvas integration as well (dual approach)
        const img = new Image();
        
        img.onload = () => {
          // Once image is loaded, add it to the canvas
          const timestamp = Date.now();
          const imageId = `vocab-${timestamp}`;
          const width = img.width || 400;
          const height = img.height || 300;
          
          addDebug(`Adding image to canvas: ${imageId}`);
          
          // Simplified approach for canvas
          handleAIImageCommand({
            imageId,
            imageUrl,
            width: Math.min(width, 400),
            height: Math.min(height, 300),
            placementHint: 'center'
          });
          
          // Reset viewport scale to show more content
          setTimeout(() => {
            setViewport({
              scale: 0.7,
              x: 0,
              y: 0
            });
            setIsGeneratingAI(false);
          }, 200);
        };
        
        img.onerror = () => {
          addDebug('Error loading generated image');
          setIsGeneratingAI(false);
        };
        
        // Start loading the image
        img.src = imageUrl;
      } else {
        addDebug('No image data in response');
        setIsGeneratingAI(false);
      }
    } catch (error) {
      addDebug(`Error generating image: ${error instanceof Error ? error.message : String(error)}`);
      setIsGeneratingAI(false);
    }
  };
  
  // Process the next example word
  const processNextWord = () => {
    if (exampleWords.length === 0) return;
    
    const word = exampleWords[currentWordIndex];
    processVocabWord(word);
    
    // Move to the next word for next time
    setCurrentWordIndex((prevIndex) => (prevIndex + 1) % exampleWords.length);
  };
  
  // Set up automatic polling or handle manual triggering
  useEffect(() => {
    if (polling && !pollingIntervalRef.current) {
      addDebug('VocabDirectActionHandler initialized');
      
      // Process a word immediately
      processNextWord();
      
      // Set up polling interval (much longer - 30 seconds)
      pollingIntervalRef.current = setInterval(() => {
        // Only process if not already processing and enough time has passed
        const timeElapsed = Date.now() - lastProcessedTime;
        if (!processing && !isGeneratingAI && timeElapsed > 30000) {
          processNextWord();
        }
      }, 10000); // Check less frequently
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [polling]);
  
  // Debug panel style
  const debugStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '70px',  // Move up to avoid overlapping with canvas controls
    right: '10px',
    background: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '10px',
    borderRadius: '5px',
    zIndex: 9999,
    width: '300px',
    maxHeight: '300px',
    overflow: 'auto',
    display: debugVisible ? 'block' : 'none'
  };
  
  // Button style
  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    margin: '5px',
    borderRadius: '4px',
    border: 'none',
    background: '#4CAF50',
    color: 'white',
    cursor: 'pointer'
  };
  
  return (
    <div style={debugStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Vocab Agent Direct Handler</span>
        <span 
          style={{ cursor: 'pointer', fontSize: '12px' }}
          onClick={() => setPolling(prev => !prev)}
        >
          {polling ? '⏸️ Pause' : '▶️ Resume'}
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
        <button 
          style={{
            ...buttonStyle,
            padding: '10px 20px',
            fontSize: '16px',
            background: '#FF5722',
            width: '100%'
          }}
          onClick={() => processVocabWord(exampleWords[currentWordIndex])}
          disabled={processing || isGeneratingAI}
        >
          ✨ Generate Image for "{exampleWords[currentWordIndex]}" ✨
        </button>
        
        <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Status: {processing ? '⏳ Processing...' : isGeneratingAI ? '🎨 Generating...' : '✅ Ready'}</span>
          <span>Word: <b>{exampleWords[currentWordIndex]}</b></span>
        </div>
      </div>
      
      <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '10px' }}>
        {debug.map((msg, i) => (
          <div key={i} style={{ fontSize: '10px', marginBottom: '2px' }}>
            {msg}
          </div>
        ))}
        
        {/* Add an empty element at the bottom to facilitate scrolling */}
        <div ref={(el) => { el?.scrollIntoView() }}></div>
      </div>
    </div>
  );
};

export default VocabDirectActionHandler;
