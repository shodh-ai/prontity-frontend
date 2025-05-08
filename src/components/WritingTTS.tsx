import { useState, useCallback, useRef, useEffect } from 'react';
import { Highlight as HighlightType } from './TiptapEditor/highlightInterface';

// Add type declarations for window properties
declare global {
  interface Window {
    setActiveHighlightId?: (id: string | number | null) => void;
    scrollToHighlight?: (id: string | number) => void;
    ttsControls?: {
      speakSuggestionById: (id: string | number) => void;
      speakAllSuggestions: () => void;
      stopSpeaking: () => void;
    }
  }
}
import { highlightContentElement } from './highlightContentElement';

interface WritingTTSProps {
  suggestions: HighlightType[];
  onSpeakingStateChange?: (speaking: boolean) => void;
  onHighlightChange?: (highlightId: string | number | null) => void;
}

/**
 * Enhanced hook to handle text-to-speech for writing suggestions with synchronized highlighting
 */
export default function useWritingTTS({ 
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

  // Update highlight state and sync with UI - simplified approach
  const updateHighlightState = useCallback((highlightId: string | number | null) => {
    console.log(`💬 TTS: Setting active highlight ID to ${highlightId}`);
    setCurrentSuggestionId(highlightId);
    onHighlightChange(highlightId);
    
    // Clear previous highlights
    document.querySelectorAll('.tts-active-highlight').forEach(el => {
      el.classList.remove('tts-active-highlight');
    });
    
    // Synchronize with UI highlight
    if (highlightId) {
      // Direct DOM approach for more reliable highlighting
      const elementId = `suggestion-${highlightId}`;
      const element = document.getElementById(elementId);
      
      if (element) {
        console.log(`Found and highlighting element with ID: ${elementId}`);
        // Add highlight class
        element.classList.add('tts-active-highlight');
        
        // Scroll into view if needed
        const rect = element.getBoundingClientRect();
        const isInViewport = (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        
        if (!isInViewport) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        console.warn(`Could not find element with ID: ${elementId}`);
        
        // Try with just the ID as fallback
        const fallbackElement = document.getElementById(String(highlightId));
        if (fallbackElement) {
          console.log(`Found element with ID: ${highlightId}`);
          fallbackElement.classList.add('tts-active-highlight');
          fallbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [onHighlightChange]);

  // Enhanced scroll to the highlighted suggestion with more flexibility
  const scrollToHighlight = useCallback((highlightId: string | number) => {
    // Try different possible element IDs
    const possibleIds = [
      `suggestion-${highlightId}`,
      String(highlightId),
      `highlight-${highlightId}`,
      `ai-suggestion-${highlightId}`
    ];
    
    let element = null;
    for (const id of possibleIds) {
      const el = document.getElementById(id);
      if (el) {
        element = el;
        break;
      }
    }
    
    if (element) {
      console.log(`Scrolling to element with ID: ${element.id}`);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      console.warn(`Could not find element to scroll to with IDs: ${possibleIds.join(', ')}`);
    }
  }, []);

  // Function to generate an explanation for a suggestion
  const generateExplanation = useCallback((suggestion: HighlightType): string => {
    // Create a more natural sounding explanation with emphasis on the specific issue
    switch (suggestion.type.toLowerCase()) {
      case 'grammar':
        return `${suggestion.message}`;
      case 'spelling':
        return `${suggestion.message}`;
      case 'style':
        return `${suggestion.message}`;
      case 'clarity':
        return `${suggestion.message}`;
      case 'coherence':
        return `${suggestion.message}`;
      default:
        return suggestion.message || 'No explanation available';
    }
  }, []);

  // Function to request TTS audio from the server
  const fetchTTSAudio = useCallback(async (text: string): Promise<string | null> => {
    try {
      console.log('💬 TTS: Sending TTS request with text:', text);
      
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

  // Function to speak a suggestion with better highlighting synchronization
  const speakSuggestion = useCallback(async (suggestion: HighlightType) => {
    if (!suggestion) return;
    
    const explanationText = generateExplanation(suggestion);
    console.log(`💬 TTS: Speaking suggestion: ${suggestion.id}`);
    console.log(`💬 TTS: Text: ${explanationText}`);
    
    // First update state and highlight before audio starts
    updateHighlightState(suggestion.id);
    updateSpeakingState(true);
    
    // Set a CSS class on the document body to indicate speaking status
    document.body.classList.add('tts-is-speaking');
    
    try {
      // Get audio URL
      const audioUrl = await fetchTTSAudio(explanationText);
      
      if (audioUrl && audioRef.current) {
        // Apply highlight again right before playing (in case of delay)
        updateHighlightState(suggestion.id);
        
        // Play audio
        audioRef.current.src = audioUrl;
        
        // Return a promise that resolves when audio starts playing
        const playPromise = audioRef.current.play();
        
        // Wait for play to start
        await playPromise;
        
        // Ensure highlight is active during audio playback
        // Re-apply highlight after a short delay to make sure it's visible
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        
        highlightTimeoutRef.current = setTimeout(() => {
          updateHighlightState(suggestion.id);
        }, 300);
      } else {
        throw new Error('Failed to get audio URL or audio element not available');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      updateSpeakingState(false);
      updateHighlightState(null);
      document.body.classList.remove('tts-is-speaking');
      
      // Process next item in queue if any
      setTimeout(() => {
        if (queue.length > 0) {
          const nextSuggestion = queue[0];
          setQueue(prevQueue => prevQueue.slice(1));
          speakSuggestion(nextSuggestion);
        }
      }, 500);
    }
  }, [generateExplanation, fetchTTSAudio, queue, updateSpeakingState, updateHighlightState]);

  // Create audio element and setup queue processing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    
    // Make functions available globally (for the OpenAI function)
    if (typeof window !== 'undefined') {
      window.setActiveHighlightId = updateHighlightState;
      window.scrollToHighlight = scrollToHighlight;
    }
    
    // Add a debug listener for highlight events
    const highlightListener = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('💬 TTS: Highlight applied event:', customEvent.detail);
    };
    window.addEventListener('highlight-applied', highlightListener);
    
    // Handle audio ended event
    const onEndedHandler = () => {
      console.log('💬 TTS: Audio playback ended');
      
      // Remove speaking class from body
      document.body.classList.remove('tts-is-speaking');
      
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
    };
    
    // Handle audio error
    const onErrorHandler = (error: Event) => {
      console.error('Audio playback error:', error);
      
      // Remove speaking class from body
      document.body.classList.remove('tts-is-speaking');
      
      updateSpeakingState(false);
      updateHighlightState(null);
      
      // Try next item despite error
      setTimeout(() => {
        if (queue.length > 0) {
          const nextSuggestion = queue[0];
          setQueue(prevQueue => prevQueue.slice(1));
          speakSuggestion(nextSuggestion);
        }
      }, 500);
    };
    
    // Set up event listeners
    audioRef.current.addEventListener('ended', onEndedHandler);
    audioRef.current.addEventListener('error', onErrorHandler);
    
    // Clean up event listeners when component unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', onEndedHandler);
        audioRef.current.removeEventListener('error', onErrorHandler);
        audioRef.current.pause();
      }
      
      window.removeEventListener('highlight-applied', highlightListener);
      
      // Remove global setters
      if (typeof window !== 'undefined') {
        delete window.setActiveHighlightId;
        delete window.scrollToHighlight;
      }
      
      // Remove any classes we added
      document.body.classList.remove('tts-is-speaking');
    };
  }, [queue, speakSuggestion, updateHighlightState, updateSpeakingState, scrollToHighlight]);

  // Function to speak a specific suggestion by ID
  const speakSuggestionById = useCallback((suggestionId: string | number) => {
    console.log(`💬 TTS: Request to speak suggestion with ID: ${suggestionId}`);
    
    if (isSpeaking) {
      // If already speaking, stop current speech and clear queue
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setQueue([]);
      updateSpeakingState(false);
      updateHighlightState(null);
      document.body.classList.remove('tts-is-speaking');
      
      // Small delay to ensure audio is properly stopped
      setTimeout(() => {
        const suggestion = suggestions.find(s => s.id === suggestionId);
        if (suggestion) {
          speakSuggestion(suggestion);
        } else {
          console.warn(`Suggestion with ID ${suggestionId} not found`);
        }
      }, 100);
    } else {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (suggestion) {
        speakSuggestion(suggestion);
      } else {
        console.warn(`Suggestion with ID ${suggestionId} not found`);
      }
    }
  }, [suggestions, isSpeaking, updateSpeakingState, updateHighlightState, speakSuggestion]);

  // Function to speak all suggestions
  const speakAllSuggestions = useCallback(() => {
    if (isSpeaking || !suggestions.length) return;
    
    console.log(`💬 TTS: Speaking all suggestions (${suggestions.length} total)`);
    
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
  }, [suggestions, isSpeaking, speakSuggestion]);

  // Function to stop speaking
  const stopSpeaking = useCallback(() => {
    console.log('💬 TTS: Stopping all speech');
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Remove speaking class from body
    document.body.classList.remove('tts-is-speaking');
    
    setQueue([]);
    updateSpeakingState(false);
    updateHighlightState(null);
    
    // Clear any pending highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, [updateSpeakingState, updateHighlightState]);
  
  // Return functions to control speech
  return {
    isSpeaking,
    currentSuggestionId,
    speakSuggestionById,
    speakAllSuggestions,
    stopSpeaking,
    highlightSuggestionById: (id: string | number) => updateHighlightState(id)
  };
}