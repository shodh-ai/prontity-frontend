/**
 * Deepgram configuration
 * API key is loaded from environment variables for security
 */

export const DEEPGRAM_CONFIG = {
  // Load API key from environment variables
  // The NEXT_PUBLIC_ prefix is required for client-side access
  API_KEY: process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || '',
  
  // Default options for transcription
  DEFAULT_OPTIONS: {
    language: 'en-US',
    model: 'nova-2',
    punctuate: true,
    smart_format: true,
    interim_results: true,
  }
};
