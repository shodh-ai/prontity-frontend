# Integrating STT Handlers with Socket.IO Server

This guide explains how to integrate the Speech-to-Text (STT) handlers with your existing socket_io_server.py file.

## Step 1: Import the STT Handlers

Add these import statements to your socket_io_server.py file:

```python
# Import STT handlers
from socket_io_stt_handlers import register_stt_handlers, cleanup_inactive_tests
```

## Step 2: Register the STT Handlers

Find the main server startup function in socket_io_server.py (usually a function like `start_server()`) and add the following code after the Socket.IO server instance is created:

```python
# Register STT handlers
register_stt_handlers(sio)

# Start background task for cleanup
sio.start_background_task(cleanup_inactive_tests, sio)
```

## Step 3: Update Socket.IO Server Dependencies

Make sure you have all required dependencies:

```bash
pip install -r socket_requirements.txt
```

## Step 4: Run the Server

Run your socket_io_server.py as usual:

```bash
python3 socket_io_server.py
```

## Testing the Integration

1. Open the speaking test page: http://localhost:3000/speakingpage/speaking-test
2. Start a test and speak into your microphone
3. Check the server logs for STT processing events
4. Observe the live transcript updating in the editor

## Socket.IO Events

The STT integration adds these new Socket.IO events:

| Event | Direction | Description |
|-------|-----------|-------------|
| `audio_chunk` | Client → Server | Audio data sent from client to server |
| `start_speaking_test` | Client → Server | Signals the start of a speaking test |
| `end_speaking_test` | Client → Server | Signals the end of a speaking test |
| `live_stt_result` | Server → Client | Transcription result from audio chunk |
| `live_grammar_highlight` | Server → Client | Grammar highlights for transcription |
| `test_completed_summary` | Server → Client | Final summary when test is completed |
| `test_expired` | Server → Client | Notification when test times out |

## Integration with Real STT Service

To use a real STT service instead of the mock implementation:

1. Set `USE_MOCK_STT = False` in socket_io_stt_handlers.py
2. Set your STT API key as an environment variable:
   ```bash
   export DEEPGRAM_API_KEY="your-api-key"
   ```
3. Implement the `process_with_deepgram()` function with actual API calls to Deepgram or your chosen STT service.

For Deepgram, you'll need:
```bash
pip install deepgram-sdk
```

The implementation details for Deepgram are commented in the socket_io_stt_handlers.py file.
