# Deepgram Live Transcription Integration

This document explains how to set up and use Deepgram for live speech-to-text transcription in the web-speech-enhanced feature.

## Overview

We've replaced the Web Speech API with Deepgram's more accurate and reliable speech recognition service. Deepgram offers:

- Better accuracy for speech recognition
- Support for various languages and dialects
- More reliable performance across different browsers
- Advanced features like speaker diarization and custom vocabulary

## Setup Instructions

### 1. Get a Deepgram API Key

1. Sign up for a free account at [Deepgram](https://deepgram.com/signup)
2. Create a new project in the Deepgram Console
3. Generate an API key with appropriate permissions

### 2. Configure Your API Key

Add your Deepgram API key to the configuration file at:
```
src/config/deepgram.ts
```

Replace the empty string with your actual API key:
```typescript
export const DEEPGRAM_CONFIG = {
  API_KEY: 'your-deepgram-api-key-here',
  
  DEFAULT_OPTIONS: {
    language: 'en-US',
    model: 'nova-2',
    punctuate: true,
    smart_format: true,
    interim_results: true,
  }
};
```

For production deployment, use environment variables:
```typescript
export const DEEPGRAM_CONFIG = {
  API_KEY: process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || '',
  // ...other options
};
```

### 3. Testing the Integration

After adding your API key, the web-speech-enhanced page should now use Deepgram for live transcription. You can test it by:

1. Navigate to the web-speech-enhanced page
2. Click "Start Speaking" to begin the test
3. Allow microphone access when prompted
4. Begin speaking and observe the live transcription

## Customization

You can customize the Deepgram transcription options in the configuration file:

- `language`: The language for transcription (e.g., 'en-US', 'es', 'fr')
- `model`: The Deepgram model to use ('nova-2' is recommended for best results)
- `punctuate`: Whether to add punctuation automatically
- `smart_format`: Formats numbers, dates, and other entities intelligently
- `interim_results`: Provides real-time partial results while speaking

## Troubleshooting

If you encounter issues with the transcription:

1. **Verify API Key**: Ensure your Deepgram API key is correct and has proper permissions
2. **Check Console**: Look for errors in the browser console
3. **Microphone Access**: Make sure your browser has permission to access the microphone
4. **Network Connectivity**: Deepgram requires an internet connection to work

## Resources

- [Deepgram Documentation](https://developers.deepgram.com/docs/)
- [Live Streaming Guide](https://developers.deepgram.com/docs/live-streaming-audio)
- [Deepgram JavaScript SDK](https://github.com/deepgram/deepgram-js-sdk)
