/**
 * DeepgramUtils.ts
 * Utility functions for Deepgram live transcription in the browser
 */

// Types for Deepgram responses
export interface DeepgramTranscription {
  type?: string;
  channel?: {
    alternatives?: {
      transcript?: string;
    }[];
  };
  // For final results
  is_final?: boolean;
  // For error responses
  error?: string;
  message?: string;
  // For metadata
  metadata?: {
    request_id: string;
    model_info: {
      name: string;
      version: string;
    };
  };
}

export interface DeepgramStreamOptions {
  language?: string;
  model?: string;
  tier?: string;
  version?: string;
  keywords?: string[];
  punctuate?: boolean;
  profanity_filter?: boolean;
  redact?: string[];
  diarize?: boolean;
  multichannel?: boolean;
  alternatives?: number;
  numerals?: boolean;
  smart_format?: boolean;
  interim_results?: boolean;
  endpointing?: number;
  utterance_end_ms?: number;
  vad_events?: boolean;
  encoding?: string;
  channels?: number;
  sample_rate?: number;
  replace?: Record<string, string>;
  callback_url?: string;
  keywords_threshold?: number;
  ner?: boolean;
  detect_language?: boolean;
  paragraphs?: boolean;
  summarize?: string;
}

export class DeepgramLiveTranscription {
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private apiKey: string;
  private options: DeepgramStreamOptions;
  private onTranscriptCallback: (transcript: string, isFinal: boolean) => void;
  private isListening: boolean = false;

  constructor(
    apiKey: string,
    options: DeepgramStreamOptions = {},
    onTranscript: (transcript: string, isFinal: boolean) => void
  ) {
    this.apiKey = apiKey;
    this.options = {
      language: 'en-US',
      model: 'nova-2',
      punctuate: true,
      smart_format: true,
      interim_results: true,
      ...options,
    };
    this.onTranscriptCallback = onTranscript;
  }

  /**
   * Starts the live transcription process
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.warn('Deepgram transcription is already active');
      return;
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('Creating Deepgram WebSocket connection...');

      // For browsers, we'll use the URL query parameter approach instead
      // Add API key to URL as a query parameter
      const url = `wss://api.deepgram.com/v1/listen?key=${encodeURIComponent(this.apiKey)}`;
      this.socket = new WebSocket(url);
      
      // Log masked API key for debugging
      const maskedKey = this.apiKey.substring(0, 4) + '...' + this.apiKey.substring(this.apiKey.length - 4);
      console.log(`Using Deepgram API key (masked): ${maskedKey}`);
      
      // Set up event handlers
      this.socket.onopen = this.handleSocketOpen.bind(this);
      this.socket.onmessage = this.handleSocketMessage.bind(this);
      this.socket.onerror = this.handleSocketError.bind(this);
      this.socket.onclose = this.handleSocketClose.bind(this);
      
      // Set up a connection timeout
      setTimeout(() => {
        if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
          console.error('Deepgram connection timed out');
          this.isListening = false;
          throw new Error('Connection to Deepgram timed out');
        }
      }, 15000);
      
    } catch (error) {
      console.error('Error starting Deepgram transcription:', error);
      throw error;
    }
  }

  /**
   * Stops the live transcription process
   */
  stop(): void {
    this.isListening = false;
    
    // Stop media recorder if active
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // Close WebSocket connection
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // Stop and release the microphone stream
    if (this.stream) {
      this.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      this.stream = null;
    }
    
    console.log('Deepgram transcription stopped');
  }

  /**
   * Handles WebSocket open event
   */
  private handleSocketOpen(event: Event): void {
    console.log('Deepgram WebSocket connection established');
    this.isListening = true;
    
    // Send configuration to Deepgram
    const configMessage = {
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      model: 'nova-2',
      language: 'en-US',
      punctuate: true,
      interim_results: true,
      ...this.options
    };
    
    console.log('Sending configuration to Deepgram:', configMessage);
    if (this.socket) {
      this.socket.send(JSON.stringify(configMessage));
    }
    
    // Set up MediaRecorder to capture audio
    this.setupMediaRecorder();
  }

  /**
   * Sets up the MediaRecorder to capture audio and send it to Deepgram
   */
  private setupMediaRecorder(): void {
    if (!this.stream) {
      console.error('No audio stream available for recording');
      return;
    }
    
    try {
      console.log('Setting up MediaRecorder for Deepgram audio capture');
      
      // Find the best supported audio format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
        
      console.log(`Using media recorder with mime type: ${mimeType}`);
      
      // Create the MediaRecorder with optimal settings
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      // Send audio data to Deepgram when available
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && event.data.size > 0) {
          this.socket.send(event.data);
        }
      };
      
      // Start the recorder with small time slices for low latency
      this.mediaRecorder.start(100);
      console.log('Started recording audio for Deepgram transcription');
    } catch (error) {
      console.error('Error setting up MediaRecorder:', error);
    }
  }

  /**
   * Handles WebSocket message event (transcription results)
   */
  private handleSocketMessage(event: MessageEvent): void {
    try {
      // Log raw message for debugging
      console.log('Received Deepgram message:', event.data);
      
      // Handle different message types
      if (typeof event.data === 'string') {
        // Parse the JSON response
        const response = JSON.parse(event.data) as DeepgramTranscription;
        
        // Check for error messages
        if (response.type === 'Error' || response.error) {
          console.error('Deepgram API error:', response);
          return;
        }
        
        // Handle speech transcript
        if (response.channel?.alternatives?.[0]) {
          const transcript = response.channel.alternatives[0].transcript;
          const isFinal = response.is_final || false;
          
          console.log(`Deepgram transcript (${isFinal ? 'final' : 'interim'}):", ${transcript}`);
          
          if (transcript) {
            // Call the callback with the transcript and final status
            this.onTranscriptCallback(transcript, isFinal);
          }
        }
      } else {
        // Handle binary or other message types
        console.log('Received non-text message from Deepgram');
      }
    } catch (error) {
      console.error('Error processing Deepgram message:', error);
      console.log('Raw event data:', event.data);
    }
  }

  /**
   * Handles WebSocket error event
   */
  private handleSocketError(event: Event): void {
    console.error('Deepgram WebSocket error:', event);
    this.isListening = false;
  }

  /**
   * Handles WebSocket close event
   */
  private handleSocketClose(event: CloseEvent): void {
    console.log(`Deepgram WebSocket connection closed: ${event.code} ${event.reason}`);
    this.isListening = false;
    
    // Clean up resources
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
  }
}

// Helper function to create a Deepgram transcription instance
export function createDeepgramTranscription(
  apiKey: string,
  options: DeepgramStreamOptions = {},
  onTranscript: (transcript: string, isFinal: boolean) => void
): DeepgramLiveTranscription {
  return new DeepgramLiveTranscription(apiKey, options, onTranscript);
}
