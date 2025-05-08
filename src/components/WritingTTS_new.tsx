import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Highlight as HighlightType } from './TiptapEditor/highlightInterface';
import { highlightContentElement } from './highlightContentElement';

interface WritingTTSProps {
  suggestions: HighlightType[];
  onSpeakingStateChange?: (speaking: boolean) => void;
  onHighlightChange?: (highlightId: string | number | null) => void;
}

/**
 * Enhanced component to handle text-to-speech for writing suggestions with synchronized highlighting
 */
export default function WritingTTS({ 
  suggestions, 
  onSpeakingStateChange = () => {},
  onHighlightChange = () => {} 
}: WritingTTSProps) {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [queue, setQueue] = useState<HighlightType[]>([]);
  const [currentSuggestionId, setCurrentSuggestionId] = useState<string | number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update speaking state when it changes
  const updateSpeakingState = useCallback((speaking: boolean) => {
    setIsSpeaking(speaking);
    onSpeakingStateChange(speaking);
    
    // Update body class to reflect speaking state for CSS animations
    if (speaking) {
      document.body.classList.add('tts-is-speaking');
    } else {
      document.body.classList.remove('tts-is-speaking');
    }
    
    // If we're stopping speech, also clear any highlight timeouts
    if (!speaking && highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, [onSpeakingStateChange]);

  // Update highlight state and sync with UI
  const updateHighlightState = useCallback((highlightId: string | number | null) => {
    console.log(`TTS: Setting active highlight ID to ${highlightId}`);
    setCurrentSuggestionId(highlightId);
    onHighlightChange(highlightId);
    
    // Clear previous highlights
    document.querySelectorAll('.tts-active-highlight').forEach(el => {
      el.classList.remove('tts-active-highlight');
    });
    
    // Synchronize with UI highlight
    if (highlightId) {
      // Target the element with the suggestion ID
      const elementId = `suggestion-${highlightId}`;
      highlightContentElement(elementId);
    }
  }, [onHighlightChange]);

  // Function to generate an explanation for a suggestion
  const generateExplanation = useCallback((suggestion: HighlightType): string => {
    return suggestion.message || 'No explanation available';
  }, []);

  // Function to request TTS audio from the server
  const fetchTTSAudio = useCallback(async (text: string): Promise<string | null> => {
    try {
      console.log('TTS: Sending TTS request with text:', text);
      
      // Create payload with text and voice
      const payload = { 
        text,
        voice: 'aura-professional' // Deepgram voice
      };
      
      // Add a retry mechanism
      let retries = 3;
      let response = null;
      
      while (retries > 0) {
        response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        if (response.ok) break;
        
        console.warn(`TTS request failed (${retries} retries left). Status: ${response.status}`);
        retries--;
        
        if (retries > 0) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(`TTS request failed: ${response?.status} ${response?.statusText}`);
      }
      
      // Convert the response to a blob
      const audioBlob = await response.blob();
      
      // Create a URL for the blob
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Error fetching TTS audio:', error);
      return null;
    }
  }, []);

  // Function to speak a suggestion with highlighting
  const speakSuggestion = useCallback(async (suggestion: HighlightType) => {
    if (!suggestion) return;
    
    const explanationText = generateExplanation(suggestion);
    console.log(`TTS: Speaking suggestion: ${suggestion.id}`);
    
    try {
      // First update state and highlight before audio starts
      updateHighlightState(suggestion.id);
      updateSpeakingState(true);
      
      // Get audio URL
      const audioUrl = await fetchTTSAudio(explanationText);
      
      if (!audioUrl) {
        throw new Error('Failed to get audio URL');
      }
      
      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      // Set up event handlers
      audioRef.current.onended = () => {
        console.log('Audio playback ended');
        updateSpeakingState(false);
        
        // Process next item in queue
        setTimeout(() => {
          if (queue.length > 0) {
            const nextSuggestion = queue[0];
            setQueue(prevQueue => prevQueue.slice(1));
            speakSuggestion(nextSuggestion);
          } else {
            updateHighlightState(null);
          }
        }, 500);
      };
      
      audioRef.current.onerror = () => {
        console.error('Audio playback error');
        updateSpeakingState(false);
        updateHighlightState(null);
      };
      
      // Play audio
      audioRef.current.src = audioUrl;
      await audioRef.current.play();
      
      // Ensure highlight is active during playback
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      highlightTimeoutRef.current = setTimeout(() => {
        updateHighlightState(suggestion.id);
      }, 300);
    } catch (error) {
      console.error('Error playing audio:', error);
      updateSpeakingState(false);
      updateHighlightState(null);
      
      // Process next item in queue if any
      setTimeout(() => {
        if (queue.length > 0) {
          const nextSuggestion = queue[0];
          setQueue(prevQueue => prevQueue.slice(1));
          speakSuggestion(nextSuggestion);
        }
      }, 500);
    }
  }, [generateExplanation, fetchTTSAudio, updateSpeakingState, updateHighlightState, queue]);

  // Function to speak a suggestion by ID
  const speakSuggestionById = useCallback((suggestionId: string | number) => {
    console.log(`TTS: Request to speak suggestion with ID: ${suggestionId}`);
    
    // Find the suggestion in the list
    const suggestion = suggestions.find(s => s.id === suggestionId);
    
    if (suggestion) {
      // If already speaking, stop current speech
      if (isSpeaking && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setQueue([]);
      }
      
      // Speak this suggestion
      speakSuggestion(suggestion);
    } else {
      console.warn(`Suggestion with ID ${suggestionId} not found`);
    }
  }, [suggestions, isSpeaking, speakSuggestion]);

  // Function to speak all suggestions
  const speakAllSuggestions = useCallback(() => {
    if (!suggestions.length) return;
    
    console.log(`TTS: Speaking all suggestions (${suggestions.length} total)`);
    
    // Make a copy of the suggestions array
    const suggestionsCopy = [...suggestions];
    
    // Start with the first suggestion
    const firstSuggestion = suggestionsCopy.shift();
    
    // Queue the rest
    setQueue(suggestionsCopy);
    
    // Speak the first one
    if (firstSuggestion) {
      speakSuggestion(firstSuggestion);
    }
  }, [suggestions, speakSuggestion]);

  // Function to stop speaking
  const stopSpeaking = useCallback(() => {
    console.log('TTS: Stopping all speech');
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Clear queue
    setQueue([]);
    
    // Update state
    updateSpeakingState(false);
    updateHighlightState(null);
  }, [updateSpeakingState, updateHighlightState]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Stop any ongoing speech
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Clear any timeouts
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      
      // Reset body class
      document.body.classList.remove('tts-is-speaking');
    };
  }, []);

  // Expose TTS controls to parent
  useEffect(() => {
    // Make our component functions available to the parent component
    if (typeof window !== 'undefined') {
      (window as any).ttsControls = {
        speakSuggestionById,
        speakAllSuggestions,
        stopSpeaking
      };
    }
    
    return () => {
      // Clean up
      if (typeof window !== 'undefined') {
        delete (window as any).ttsControls;
      }
    };
  }, [speakSuggestionById, speakAllSuggestions, stopSpeaking]);

  // Return a React component (JSX)
  return (
    <div className="writing-tts" style={{ display: 'none' }}>
      {/* Audio element will be created dynamically */}
      {/* We expose the functions through the window object */}
    </div>
  );
}
