"""
Socket.IO Speech-to-Text (STT) Handlers for TOEFL Speaking Test

This module extends the existing socket_io_server.py with handlers for real-time 
speech-to-text processing for the TOEFL speaking test page.

Usage:
    Import these handlers into your socket_io_server.py file.
"""

import asyncio
import base64
import json
import logging
import os
import random
import time
import uuid
from typing import Dict, List, Any, Optional, Union

import httpx
from deepgram import Deepgram

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('stt_handlers')

# --- Constants ---
AI_SERVICE_URL = "http://127.0.0.1:8000/analyze"  # URL for AI grammar analysis

# Configuration for STT
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    logger.warning("DEEPGRAM_API_KEY not found in environment variables. Using mock STT.")
    USE_MOCK_STT = True
else:
    # Initialize Deepgram client
    try:
        deepgram_client = Deepgram(DEEPGRAM_API_KEY)
        USE_MOCK_STT = False
        logger.info("Deepgram client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Deepgram client: {e}")
        USE_MOCK_STT = True

# Map to store active speaking tests by SID
active_tests: Dict[str, Dict[str, Any]] = {}

# --- Mock STT Responses ---
# These will be used when USE_MOCK_STT is True for development
MOCK_STT_RESPONSES = [
    "Hello, ", "my name is ", "Jane Smith. ", "I am taking ", "the TOEFL test ",
    "today. ", "I would like ", "to discuss ", "a challenging ", "experience ",
    "that I ", "faced recently. ", "Last year, ", "I had to ", "give a presentation ",
    "in front of ", "a large audience. ", "It was ", "very intimidating ", "because ",
    "I had never ", "spoken in public ", "before. ", "I was ", "extremely nervous ",
    "and worried ", "that I would ", "forget my ", "speech. ", "To overcome ", 
    "this challenge, ", "I practiced ", "extensively ", "for several ", "weeks. ",
    "I rehearsed ", "in front of ", "my friends ", "and family. ", "They gave me ",
    "helpful feedback ", "which I ", "incorporated into ", "my presentation. ",
    "When the ", "day arrived, ", "I was still ", "nervous, but ", "much more ",
    "prepared. ", "The presentation ", "went well ", "and I received ", "positive comments. ",
    "This experience ", "taught me ", "that preparation ", "is key ", "to overcoming ",
    "difficult situations. ", "It also ", "boosted my ", "confidence ", "significantly. ",
    "Now I feel ", "more comfortable ", "speaking in ", "public settings. "
]

# --- Async Functions for Socket.IO Server ---

async def handle_ping_server(sio, sid: str, data: Dict[str, Any]) -> None:
    """
    Handle ping requests from the client for testing connectivity.
    
    Args:
        sio: The Socket.IO server instance
        sid: The session ID of the client
        data: The ping data containing timestamp
    """
    logger.info(f"Received ping from {sid} with data: {data}")
    # Send pong response back to the client
    await sio.emit('pong_client', {
        'originalTimestamp': data.get('timestamp', 0),
        'serverTimestamp': time.time() * 1000,  # to milliseconds
        'message': 'Server ping response'
    }, room=sid)

async def handle_test_stt(sio, sid: str, data: Dict[str, Any]) -> None:
    """
    Handle test STT requests from the client.
    
    Args:
        sio: The Socket.IO server instance
        sid: The session ID of the client
        data: The test data
    """
    logger.info(f"Received test_stt from {sid} with data: {data}")
    # Send test response back to the client
    await sio.emit('test_stt_response', {
        'success': True,
        'message': 'Server received test STT request',
        'originalData': data
    }, room=sid)
    
    # Also send a mock transcription result
    await sio.emit('live_stt_result', {
        'transcript_segment': 'Test server transcription. ',
        'is_test': True
    }, room=sid)

async def handle_audio_chunk(sio, sid: str, data: Dict[str, Any]) -> None:
    """
    Handle incoming audio chunks from the client.
    
    Args:
        sio: The Socket.IO server instance
        sid: The session ID of the client
        data: The message data containing the audio chunk
    """
    try:
        # Log receipt of audio chunk with detailed info
        logger.info(f"Received audio_chunk from {sid}, mime_type: {data.get('mime_type', 'unknown')}, topic_id: {data.get('topic_id', 'unknown')}")
        
        if sid not in active_tests:
            # Initialize test state for this client
            active_tests[sid] = {
                "start_time": time.time(),
                "audio_chunks": [],
                "transcript": "",
                "topic_id": data.get("topic_id", "unknown"),
                "last_chunk_time": time.time()
            }
            logger.info(f"Initialized new test state for client {sid}")
        
        # Store audio data for later processing if needed
        audio_data = data.get("audio_data")
        if audio_data:
            # Log the size of the audio data
            data_size = len(audio_data) if isinstance(audio_data, str) else 0
            logger.info(f"Received audio data of size {data_size} bytes from {sid}")
            
            active_tests[sid]["audio_chunks"].append(audio_data)
            active_tests[sid]["last_chunk_time"] = time.time()
        
        # --- PROCESS AUDIO WITH STT ---
        transcript_segment = None
        
        if USE_MOCK_STT:
            # Use mock STT for development
            await asyncio.sleep(0.3)  # Simulate processing delay
            transcript_segment = random.choice(MOCK_STT_RESPONSES)
            logger.info(f"Using mock STT, generated: '{transcript_segment}'")
        else:
            # Use Deepgram for real-time STT
            try:
                transcript_segment = await process_with_deepgram(audio_data)
                logger.info(f"Deepgram processing successful")
            except Exception as e:
                logger.error(f"Error processing with Deepgram: {e}")
                # Fallback to mock if Deepgram fails
                transcript_segment = random.choice(MOCK_STT_RESPONSES)
                logger.info(f"Falling back to mock STT: '{transcript_segment}'")
        
        if transcript_segment:
            logger.info(f"Final STT result for {sid}: '{transcript_segment}'")
            
            # Update accumulated transcript
            active_tests[sid]["transcript"] += transcript_segment
            current_transcript = active_tests[sid]["transcript"]
            
            # Send the new segment to the client
            try:
                await sio.emit('live_stt_result', {
                    'transcript_segment': transcript_segment
                }, room=sid)
                logger.info(f"Emitted 'live_stt_result' event to client {sid}")
                
                # Also send a direct confirmation that we processed the audio
                await sio.emit('audio_processed', {
                    'success': True,
                    'timestamp': time.time(),
                    'message': 'Audio chunk processed successfully'
                }, room=sid)
            except Exception as e:
                logger.error(f"Error sending transcription to client {sid}: {e}")
        else:
            logger.warning(f"No transcript segment generated for audio from {sid}")
            
            # Send a notification that processing occurred but no transcript was generated
            await sio.emit('audio_processed', {
                'success': False,
                'timestamp': time.time(),
                'message': 'Audio processed but no transcription generated'
            }, room=sid)
            
            # Periodically check for grammar issues using the AI service
            # We don't want to do this for every tiny chunk
            if len(transcript_segment.split()) >= 3:  # If segment has at least 3 words
                try:
                    # Prepare payload for AI service
                    ai_request_payload = {
                        "transcripts": [{
                            "topic": active_tests[sid].get("topic_id", "Speaking Test"),
                            "paragraph": current_transcript
                        }]
                    }
                    
                    # Send to AI service for grammar analysis
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            AI_SERVICE_URL, 
                            json=ai_request_payload,
                            timeout=3.0  # Short timeout for real-time
                        )
                        
                        if response.status_code == 200:
                            ai_results = response.json()
                            
                            # Transform AI results to highlight format
                            highlights = []
                            
                            if "results" in ai_results and len(ai_results["results"]) > 0:
                                result = ai_results["results"][0]
                                
                                for error in result.get("errors", []):
                                    highlight = {
                                        "id": str(uuid.uuid4()),
                                        "start": error.get("start", 0),
                                        "end": error.get("end", 0),
                                        "type": "grammar",
                                        "message": f"Grammar error: {error.get('wrong_version', '')}",
                                        "wrongVersion": error.get("wrong_version", ""),
                                        "correctVersion": error.get("correct_version", "")
                                    }
                                    highlights.append(highlight)
                            
                            # Send grammar highlights to client if we found any
                            if highlights:
                                await sio.emit('live_grammar_highlight', highlights, room=sid)
                                logger.info(f"Sent {len(highlights)} grammar highlights to {sid}")
                    
                except Exception as e:
                    logger.error(f"Error processing grammar for {sid}: {e}", exc_info=True)
        
    except Exception as e:
        logger.error(f"Error processing audio_chunk for {sid}: {e}", exc_info=True)
        await sio.emit('error', {
            'message': f"Error processing audio: {str(e)}"
        }, room=sid)

async def handle_start_speaking_test(sio, sid: str, data: Dict[str, Any]) -> None:
    """
    Handle the start of a speaking test.
    
    Args:
        sio: The Socket.IO server instance
        sid: The session ID of the client
        data: Data about the test being started
    """
    logger.info(f"Speaking test started for {sid}, data: {data}")
    
    # Initialize test state for this client
    active_tests[sid] = {
        "start_time": time.time(),
        "audio_chunks": [],
        "transcript": "",
        "topic_id": data.get("topic_id", "unknown"),
        "last_chunk_time": time.time()
    }
    
    # Acknowledge test start
    await sio.emit('test_started', {
        'status': 'recording',
        'message': 'Speaking test has started'
    }, room=sid)

async def handle_end_speaking_test(sio, sid: str, data: Dict[str, Any]) -> None:
    """
    Handle the end of a speaking test.
    
    Args:
        sio: The Socket.IO server instance
        sid: The session ID of the client
        data: Data about the test being ended
    """
    logger.info(f"Speaking test ended for {sid}, data: {data}")
    
    if sid in active_tests:
        test_data = active_tests[sid]
        topic_id = test_data.get("topic_id", "unknown")
        
        # Get the full transcript from client data or our accumulated one
        full_transcript = data.get("transcript", test_data.get("transcript", ""))
        
        # Generate a unique report ID
        report_id = f"report-{uuid.uuid4()}"
        
        # Here we would normally:
        # 1. Process the full audio for a high-quality transcript
        # 2. Send the transcript to the AI service for full analysis
        # 3. Store the results in a database
        
        try:
            # For now, just simulate processing time
            await asyncio.sleep(1.0)
            
            # Send completion notification to client
            await sio.emit('test_completed_summary', {
                'reportId': report_id,
                'message': 'Your speaking test has been processed',
                'transcript_length': len(full_transcript),
                'word_count': len(full_transcript.split())
            }, room=sid)
            
            # Clean up
            if sid in active_tests:
                del active_tests[sid]
                
        except Exception as e:
            logger.error(f"Error finalizing test for {sid}: {e}", exc_info=True)
            await sio.emit('error', {
                'message': f"Error finalizing test: {str(e)}"
            }, room=sid)
    else:
        logger.warning(f"Received end_speaking_test for {sid} but no active test found")
        await sio.emit('error', {
            'message': 'No active speaking test found'
        }, room=sid)

# --- Functions to integrate with socket_io_server.py ---

def register_stt_handlers(sio):
    """
    Register STT event handlers with the Socket.IO server.
    
    Args:
        sio: The Socket.IO server instance
    """
    @sio.event
    async def audio_chunk(sid, data):
        await handle_audio_chunk(sio, sid, data)
    
    @sio.event
    async def start_speaking_test(sid, data):
        await handle_start_speaking_test(sio, sid, data)
    
    @sio.event
    async def end_speaking_test(sid, data):
        await handle_end_speaking_test(sio, sid, data)
    
    logger.info("Registered STT handlers with Socket.IO server")

# --- Deepgram STT Integration (Placeholder) ---

async def process_with_deepgram(audio_data: str) -> str:
    """
    Process audio data with Deepgram API.
    
    Args:
        audio_data: Base64-encoded audio data
        
    Returns:
        Transcribed text from the audio
    """
    try:
        # 1. Decode base64 audio data to binary
        try:
            binary_audio_data = base64.b64decode(audio_data)
        except Exception as e:
            logger.error(f"Error decoding base64 audio: {e}")
            return ""
        
        # 2. Configure Deepgram options for real-time transcription
        options = {
            "punctuate": True,  # Add punctuation
            "diarize": False,  # Don't identify speakers (only one speaker expected)
            "interim_results": False,  # We need final results for each chunk
            "language": "en",  # English language
            "model": "nova-2",  # Most accurate model as of 2023
            "smart_format": True,  # Format numbers, dates, etc.
            "endpointing": False,  # We're handling end of speech manually
        }
        
        # 3. Send request to Deepgram API
        response = await deepgram_client.transcription.prerecorded(
            {"buffer": binary_audio_data, "mimetype": "audio/webm"},  # Adjust mimetype based on your client settings
            options
        )
        
        # 4. Parse and extract transcript
        if response and "results" in response:
            # Get transcript from the response
            transcript = response["results"]["channels"][0]["alternatives"][0]["transcript"]
            # Log for debugging
            logger.info(f"Deepgram transcript: {transcript}")
            return transcript
        else:
            logger.warning("No transcript found in Deepgram response")
            return ""
            
    except Exception as e:
        logger.error(f"Error processing with Deepgram: {e}", exc_info=True)
        return ""

# --- Cleanup Function ---

async def cleanup_inactive_tests(sio):
    """
    Periodically clean up inactive tests.
    
    Args:
        sio: The Socket.IO server instance
    """
    while True:
        try:
            current_time = time.time()
            to_remove = []
            
            for sid, test_data in active_tests.items():
                # If no activity for more than 2 minutes, clean up
                if current_time - test_data["last_chunk_time"] > 120:
                    to_remove.append(sid)
            
            for sid in to_remove:
                logger.info(f"Cleaning up inactive test for {sid}")
                del active_tests[sid]
                
                # Notify client that session has expired
                try:
                    await sio.emit('test_expired', {
                        'message': 'Your speaking test session has expired due to inactivity'
                    }, room=sid)
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            
        await asyncio.sleep(30)  # Run every 30 seconds
