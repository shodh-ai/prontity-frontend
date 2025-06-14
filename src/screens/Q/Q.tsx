import React, { useState, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useSocketIO } from "../../hooks/useSocketIO";

// TypeScript interfaces for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  error: any;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}

export const Q = (): JSX.Element => {
  // WebSocket integration using the useSocketIO hook
  const { socket, isConnected, sendMessage } = useSocketIO();
  
  // State for messages and UI
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [inputText, setInputText] = useState("Can you tell me about my course summary and course insights till now?");
  const [messages, setMessages] = useState<{type: 'user'|'ai', content: string}[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  
  // Reference for scrolling to the latest message
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Audio element for playing AI responses
  const audioElement = useRef<HTMLAudioElement | null>(null);
  
  // Speech recognition setup
  const speechRecognition = useRef<SpeechRecognition | null>(null);
  
  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      speechRecognition.current = new SpeechRecognitionAPI();
      if (speechRecognition.current) {
        speechRecognition.current.continuous = true;
        speechRecognition.current.interimResults = true;
        speechRecognition.current.lang = 'en-US';
      }
      
      if (speechRecognition.current) {
        speechRecognition.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0] as SpeechRecognitionAlternative)
          .map(result => result.transcript)
          .join('');
        
        setInputText(transcript);
        };
      }
      
      if (speechRecognition.current) {
        speechRecognition.current.onerror = (event: SpeechRecognitionEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        };
      }
      
      if (speechRecognition.current) {
        speechRecognition.current.onend = () => {
          setIsListening(false);
        };
      }
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
    
    return () => {
      if (speechRecognition.current) {
        speechRecognition.current.stop();
      }
    };
  }, []);
  
  // Initialize audio element
  useEffect(() => {
    audioElement.current = new Audio();
    
    // Set up audio event handlers
    if (audioElement.current) {
      audioElement.current.onended = handleAudioEnded;
      audioElement.current.onerror = () => {
        console.error('Audio playback error');
        handleAudioEnded();
      };
    }
    
    return () => {
      if (audioElement.current) {
        audioElement.current.onended = null;
        audioElement.current.onerror = null;
      }
    };
  }, []);

  // Handle audio queue
  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying) {
      playNextAudio();
    }
  }, [audioQueue, isPlaying]);

  // WebSocket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Listen for AI responses
    socket.on('ai_response', (data) => {
      console.log('Received AI response:', data);
      setLoading(false);
      setMessages(prevMessages => [...prevMessages, { type: 'ai', content: data.response }]);
    });
    
    // Listen for audio responses
    socket.on('ai_audio', (data) => {
      console.log('Received AI audio data');
      if (data.audio) {
        // Add to audio queue
        setAudioQueue(prevQueue => [...prevQueue, data.audio]);
      }
    });
    
    socket.on('welcome', (data) => {
      console.log('Received welcome message:', data);
      // Optionally add the welcome message to messages state
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setLoading(false);
    });
    
    // Cleanup listeners on unmount
    return () => {
      socket.off('ai_response');
      socket.off('ai_audio');
      socket.off('welcome');
      socket.off('error');
    };
  }, [socket, isConnected]);
  
  // Function to play the next audio in queue
  const playNextAudio = () => {
    if (audioQueue.length === 0 || !audioElement.current) {
      return;
    }
    
    const audioData = audioQueue[0];
    setAudioQueue(prevQueue => prevQueue.slice(1));
    
    try {
      setIsPlaying(true);
      audioElement.current.src = audioData;
      audioElement.current.play()
        .catch(err => {
          console.error('Failed to play audio:', err);
          setIsPlaying(false);
        });
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsPlaying(false);
    }
  };
  
  // Audio ended handler
  const handleAudioEnded = () => {
    setIsPlaying(false);
    // The useEffect for audioQueue will trigger the next audio if available
  };
  
  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Function to send messages
  const handleSendMessage = (customMessage?: string) => {
    const messageToSend = customMessage || inputText;
    if (!messageToSend.trim() || !isConnected) return;
    
    // Add user message to the chat
    setMessages(prevMessages => [...prevMessages, { type: 'user', content: messageToSend }]);
    
    // Send message to the server
    if (socket) {
      console.log('Sending message:', messageToSend);
      socket.emit('send_message', { 
        message: messageToSend,
        audio_response_requested: true // Request audio response
      });
      setLoading(true);
    }
    
    setInputText('');
    setIsPopupVisible(false);
  };
  
  // Function to handle card click
  const handleCardClick = (title: string, description: string) => {
    const message = `${title}: ${description}`;
    setInputText(message);
    setIsPopupVisible(true);
    
    // Auto-send after a short delay if desired
    // setTimeout(() => handleSendMessage(message), 500);
  };
  
  // Function to send a specific message
  const handleSendSpecificMessage = (message: string) => {
    if (!message.trim() || !isConnected) return;
    
    // Add user message to the chat
    setMessages(prevMessages => [...prevMessages, { type: 'user', content: message }]);
    
    // Send message to the server
    if (socket) {
      console.log('Sending message:', message);
      socket.emit('send_message', { message, audio_response_requested: true });
      setLoading(true);
    }
    
    setInputText('');
    setIsPopupVisible(false);
  };
  
  // Toggle microphone listening
  const toggleListening = () => {
    if (!speechRecognition.current) {
      console.warn('Speech recognition not initialized');
      return;
    }
    
    if (isListening) {
      speechRecognition.current?.stop();
      setIsListening(false);
    } else {
      setIsPopupVisible(true);
      setInputText('');
      speechRecognition.current?.start();
      setIsListening(true);
    }
  };

  // Data for suggestion cards
  const suggestionCards = [
    {
      title: "Summarize my learning",
      description: "so far, what have I covered and how well?",
    },
    {
      title: "Improve my speaking skills",
      description: "where am I lacking and how to fix it?",
    },
    {
      title: "Show me my mistakes",
      description: "and how I can improve them.",
    },
  ];

  // Data for navigation items
  const navItems = [
    {
      active: true,
      icon: "/dashboard.svg",
      bgClass: "bg-[url(/dashboard.svg)]",
    },
    { active: false, icon: "/frame-3.svg" },
    { active: false, icon: "/frame-2.svg" },
    {
      active: false,
      icon: "/reference-material.svg",
      bgClass: "bg-[url(/reference-material.svg)]",
    },
    { active: false, icon: "/frame.svg" },
  ];

  return (
    <div className="w-full min-h-screen bg-white overflow-hidden relative">
      <div className="relative w-full min-h-screen">
        {/* Background elements */}
        <div className="absolute w-[40vw] h-[40vw] max-w-[753px] max-h-[753px] top-[-20vh] right-[-30vw] bg-[#566fe9] rounded-full" />
        <div className="absolute w-[25vw] h-[25vw] max-w-[353px] max-h-[353px] bottom-[-25vh] left-[-10vw] bg-[#336de6] rounded-full" />

        {/* Main content container with backdrop blur */}
        <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]">
          <img
            className="absolute w-full  max-w-[1336px] h-[90vh] top-6 left-1/2 -translate-x-1/2 opacity-50 "
            alt="Union"
            src="/union.svg"
          />
        </div>

        {/* Left sidebar navigation */}
        <nav className="flex flex-col h-full items-center justify-between px-1.5 py-3.5 absolute left-0 top-0 z-10">
          {/* Logo */}
          <div className="flex w-[28.1px] h-7 items-start gap-[0.47px] px-[2.38px] py-0">
            <img className="w-[23.29px] h-7" alt="Logo" src="/final-logo.png" />
          </div>

          {/* Navigation icons */}
          <div className="flex flex-col items-start gap-3">
            {navItems.map((item, index) => (
              <Button
                key={index}
                variant={item.active ? "default" : "ghost"}
                size="icon"
                className={`p-2.5 ${
                  item.active ? "bg-[#566fe9]" : ""
                } rounded-[100px] w-12 h-12`}
              >
                {item.bgClass ? (
                  <div className={`${item.bgClass} w-6 h-6 bg-[100%_100%]`} />
                ) : (
                  <img
                    className="w-6 h-6"
                    alt="Navigation icon"
                    src={item.icon}
                  />
                )}
              </Button>
            ))}
          </div>

          {/* Spacer element */}
          <div className="w-[28.1px] h-7 opacity-0">
            <img
              className="w-[23.29px] h-7"
              alt="Logo"
              src="/final-logo-1.png"
            />
          </div>
        </nav>

        {/* Suggestion cards */}
        <div className="absolute top-[25vh] sm:top-[30vh] left-1/2 -translate-x-1/2 w-full max-w-[90vw] px-4">
          <div className="flex items-center justify-center gap-3 lg:gap-[11px]">
            {suggestionCards.map((card, index) => (
              <Card
                key={index}
                onClick={() => handleSendSpecificMessage(`${card.title}: ${card.description}`)}
                className="flex-col items-start gap-2.5 pt-3 pb-4 px-4 rounded-2xl border-none [background:linear-gradient(357deg,rgba(255,255,255,0)_0%,rgba(86,111,233,0.2)_100%)] 
                           w-[200px] sm:w-[220px] lg:w-[240px] 
                           h-[120px] sm:h-[130px] lg:h-[150px]
                           flex-shrink-0 cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardContent className="flex flex-col items-start gap-2 p-0 h-full justify-between">
                  <h3 className="font-label-large font-[number:var(--label-large-font-weight)] text-black text-[length:var(--label-large-font-size)] tracking-[var(--label-large-letter-spacing)] leading-[var(--label-large-line-height)]">
                    {card.title}
                  </h3>
                  <p className="font-normal text-black text-xs sm:text-sm tracking-[0] leading-normal font-['Plus_Jakarta_Sans',Helvetica] flex-1">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* AI Assistant message - Only showing status, not messages */}
        <div className="absolute bottom-[10rem] sm:bottom-[10rem] lg:bottom-[10rem] left-1/2 -translate-x-1/2 inline-flex items-center justify-center gap-2.5 px-4 sm:px-5 py-2.5 bg-[#566fe91a] rounded-[50px] max-w-[90vw] backdrop-blur-sm">
          <p className="font-paragraph-extra-large font-[number:var(--paragraph-extra-large-font-weight)] text-black text-[length:var(--paragraph-extra-large-font-size)] text-center tracking-[var(--paragraph-extra-large-letter-spacing)] leading-[var(--paragraph-extra-large-line-height)] text-sm sm:text-base">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                Rox is thinking...
              </span>
            ) : isPlaying ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 bg-[#566fe9] rounded-full animate-pulse" />
                Rox is speaking...
              </span>
            ) : (
              "Hello. I am Rox, your AI Assistant!"
            )}
          </p>
          <div ref={messagesEndRef} style={{ display: 'none' }} />
        </div>
        
        {/* Avatar/Logo element */}
        <div className="absolute bottom-[5rem] sm:bottom-[5rem] lg:bottom-[ 5rem] left-1/2 -translate-x-1/2 w-16 h-16 sm:w-20 sm:h-20 lg:w-[90px] lg:h-[90px] z-20">
          <div className="relative w-full h-full">
            <div className="absolute w-[70%] h-[70%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#566fe9] rounded-full blur-[30px] sm:blur-[40px] lg:blur-[50px]" />
            <img
              className="absolute w-full h-full top-0 left-0 object-contain"
              alt="Rox AI Assistant"
              src="/screenshot-2025-06-09-at-2-47-05-pm-2.png"
            />
          </div>
        </div>

        {/* 
          MODIFICATION: 
          The control buttons and the chat input are now in a single container.
          A conditional check on `isPopupVisible` swaps between the two UIs.
          This makes the chat input appear in the same central location as the controls.
        */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-20">
          {!isPopupVisible ? (
            // Initial controls view
            <div className="flex items-center justify-between w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px] mx-auto">
              <Button
                size="icon"
                onClick={toggleListening}
                className={`p-3 sm:p-4 ${isListening ? 'bg-[#566fe9]' : 'bg-[#566fe91a] hover:bg-[#566fe930]'} rounded-full h-auto w-auto transition-colors duration-200 backdrop-blur-sm`}
              >
                <div className={`bg-[url(/mic-on.svg)] w-5 h-5 sm:w-6 sm:h-6 bg-[100%_100%] ${isListening ? 'animate-pulse' : ''}`} />
              </Button>
              <div className="w-16 sm:w-20 lg:w-[90px]"></div> {/* Spacer for the avatar */}
              <Button
                size="icon"
                className="p-3 sm:p-4 bg-[#566fe91a] hover:bg-[#566fe930] rounded-full h-auto w-auto transition-colors duration-200 backdrop-blur-sm"
                onClick={() => setIsPopupVisible(true)}
              >
                <img
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  alt="Message"
                  src="/frame-1.svg"
                />
              </Button>
            </div>
          ) : (
            // Chat input view (replaces the controls)
            <div className="flex items-center gap-2 w-full p-2 rounded-full bg-white/80 backdrop-blur-lg shadow-md border border-gray-200/80">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 px-4 text-black text-sm"
                placeholder="Type your message..."
                autoFocus
              />
              <Button
                size="icon"
                className="flex-shrink-0 bg-[#566fe9] hover:bg-[#4a5fcf] rounded-full w-9 h-9"
                onClick={() => handleSendMessage()}
                disabled={!isConnected || !inputText.trim()}
              >
                <img className="w-5 h-5" alt="Send" src="/send.svg" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};