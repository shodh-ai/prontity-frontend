# speaking_agent.py - Speaking Report Agent with OpenAI Function Calling

import json
import logging
import os
import time
import requests
from typing import List, Dict, Any, Optional, Set
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from highlight_handler import HighlightHandler
from custom_llm import CustomBridge

# --- Setup ---
load_dotenv()  # Load environment variables from .env file
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# URL for the frontend API endpoints
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Initialize components ---
highlight_handler = HighlightHandler(FRONTEND_URL)
llm_bridge = CustomBridge()

class SpeakingReportAgent:
    """
    Agent that connects to LiveKit and explains speaking report highlights.
    Handles the sequential navigation through highlights and provides explanations.
    """
    def __init__(self, llm_bridge=None, highlight_handler=None):
        self.frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        
        # Use provided components or create new ones if not provided
        self.llm = llm_bridge if llm_bridge is not None else CustomBridge()
        self.highlight_handler = highlight_handler if highlight_handler is not None else HighlightHandler(self.frontend_url)
        
        logger.info("SpeakingReportAgent initialized with custom LLM bridge and highlight handler")
        
        # LiveKit connection properties
        self.room = None
        self.participant = None
        self.participant_name = os.environ.get("PARTICIPANT_NAME", "Speaking Coach")
        self.is_connected = False
        self.last_message_time = 0  # Rate limiting
        
        # State properties
        self.is_explaining = False
        self.last_explanation_time = 0
        self.paused = False
        
    async def connect_to_livekit(self, room_name: str, token: str):
        """
        Connect to the LiveKit room.
        
        Args:
            room_name: Name of the LiveKit room
            token: Authentication token for LiveKit
        """
        try:
            logger.info(f"Connecting to LiveKit room: {room_name}")
            
            # Create a new room and connect
            room_options = rtc.RoomOptions(
                adaptation_settings=rtc.AdaptationSettings(disabled=True)
            )
            
            self.room = rtc.Room(options=room_options)
            
            # Set up event handlers
            @self.room.on("data_received")
            def on_data_received(data: bytes, participant: rtc.RemoteParticipant, kind: rtc.DataPacketKind):
                try:
                    if kind == rtc.DataPacketKind.RELIABLE:
                        message = data.decode('utf-8')
                        asyncio.create_task(self.handle_data_received(message, participant))
                except Exception as e:
                    logger.error(f"Error in data_received handler: {str(e)}")
            
            @self.room.on("participant_connected")
            def on_participant_connected(participant: rtc.RemoteParticipant):
                logger.info(f"Participant connected: {participant.name}")
                asyncio.create_task(self.announce_agent_connected(participant))
                
            @self.room.on("participant_disconnected")
            def on_participant_disconnected(participant: rtc.RemoteParticipant):
                logger.info(f"Participant disconnected: {participant.name}")
            
            # Connect to the room
            await self.room.connect(token, self.participant_name)
            logger.info(f"Connected to room: {room_name}")
            
            # Store local participant
            self.participant = self.room.local_participant
            self.is_connected = True
            
            # Give a moment for connection to stabilize
            await asyncio.sleep(1)
            
            # Announce agent's presence
            await self.announce_agent_joined()
            
            # Start the highlight checking loop
            asyncio.create_task(self.highlight_check_loop())
            
        except Exception as e:
            logger.error(f"Error connecting to LiveKit: {str(e)}")
            self.is_connected = False
            
    async def handle_data_received(self, data: str, participant: rtc.RemoteParticipant):
        """
        Handle data received from LiveKit.
        
        Args:
            data: String data received
            participant: Participant who sent the data
        """
        try:
            # Parse the data if it's JSON
            try:
                parsed_data = json.loads(data)
                message_type = parsed_data.get('type', '')
                
                # Handle different message types
                if message_type == 'highlights_update':
                    logger.info(f"Received highlights update from {participant.name}")
                    highlights = parsed_data.get('highlights', [])
                    await self.handle_highlights_update(highlights)
                    
                elif message_type == 'command':
                    command = parsed_data.get('command', '')
                    if command == 'pause':
                        self.paused = True
                        await self.send_voice_message("I'll pause the explanations. Let me know when you want to continue.")
                    elif command == 'resume':
                        self.paused = False
                        await self.send_voice_message("I'll continue with the explanations.")
                        await self.explain_next_highlight()
                    elif command == 'restart':
                        # Clear explained highlights and start over
                        self.highlight_handler.explained_highlights.clear()
                        await self.send_voice_message("I'll start explaining the suggestions from the beginning.")
                        await self.explain_next_highlight()
                
            except json.JSONDecodeError:
                # If it's not JSON, treat as plain text
                if "hello" in data.lower():
                    await self.send_voice_message(f"Hello {participant.name}! I'm your speaking coach. I'll help analyze your speaking and provide suggestions.")
                # Add more plain text handlers as needed
            
        except Exception as e:
            logger.error(f"Error handling received data: {str(e)}")
            
    async def handle_highlights_update(self, highlights: List[Dict[str, Any]]):
        """
        Handle updated highlights.
        
        Args:
            highlights: List of highlight objects
        """
        if not highlights:
            logger.info("Received empty highlights update")
            return
            
        updated = await self.highlight_handler.update_highlights(highlights)
        
        if updated and not self.is_explaining and not self.paused:
            # If we received new highlights and aren't already explaining,
            # start the explanation process
            logger.info("Starting explanation process for new highlights")
            await self.explain_next_highlight()
            
    async def explain_next_highlight(self):
        """
        Explain the next highlight in the queue.
        """
        # Avoid multiple concurrent explanations
        if self.is_explaining or self.paused:
            return
            
        self.is_explaining = True
        
        try:
            # Get the next unexplained highlight
            next_highlight = self.highlight_handler.get_next_highlight()
            
            if not next_highlight:
                # All highlights have been explained
                if self.highlight_handler.all_highlights_explained() and self.highlight_handler.highlights:
                    # Generate a summary if we explained at least one highlight
                    logger.info("All highlights explained, generating summary")
                    summary = await self.llm.generate_summary(self.highlight_handler.highlights)
                    await self.send_voice_message(summary)
                else:
                    # No highlights to explain
                    await self.send_voice_message("I'm waiting for speaking content to analyze. Please begin speaking or writing.")
                
                self.is_explaining = False
                return
                
            # Select the highlight in the UI
            highlight_id = next_highlight.get('id')
            if not highlight_id:
                logger.warning("Highlight missing ID, skipping")
                self.is_explaining = False
                return
                
            # Select this highlight in the UI
            selection_result = self.highlight_handler.select_highlight(highlight_id)
            
            if not selection_result.get('success', False):
                logger.warning(f"Failed to select highlight: {selection_result.get('error')}")
                # Continue anyway
            
            # Give UI time to update
            await asyncio.sleep(0.5)
            
            # Generate explanation using LLM
            context = {
                "highlight_type": next_highlight.get('type', 'suggestion'),
                "message": next_highlight.get('message', 'No specific issue identified'),
                "wrong_version": next_highlight.get('wrongVersion', ''),
                "correct_version": next_highlight.get('correctVersion', '')
            }
            
            explanation = await self.llm.generate_explanation(context)
            
            # Send voice message with explanation
            await self.send_voice_message(explanation)
            
            # Mark as explained
            self.highlight_handler.mark_highlight_explained(highlight_id)
            
            # Show progress
            progress = self.highlight_handler.get_progress()
            logger.info(f"Progress: {progress['explained']}/{progress['total']} ({progress['percent_complete']}%)")
            
            # Wait a moment before moving to next highlight
            await asyncio.sleep(2)
            
            # Move to next highlight
            self.is_explaining = False
            await self.explain_next_highlight()
            
        except Exception as e:
            logger.error(f"Error explaining highlight: {str(e)}")
            self.is_explaining = False
    
    async def send_voice_message(self, message: str):
        """
        Send a voice message to the LiveKit room.
        
        Args:
            message: Text to be spoken
        """
        try:
            if not self.is_connected or not self.room:
                logger.warning("Cannot send message: not connected to LiveKit")
                return
                
            # Rate limiting to avoid too many messages
            current_time = time.time()
            if current_time - self.last_message_time < 1.0:  # At least 1 second between messages
                await asyncio.sleep(1.0)
                
            # Clean up the message
            message = message.strip()
            if not message:
                return
                
            # Send the data reliably to the room
            data_to_send = json.dumps({
                "type": "agent_message",
                "agentName": self.participant_name,
                "text": message,
                "timestamp": time.time()
            })
            
            await self.room.local_participant.publish_data(
                data_to_send.encode('utf-8'),
                rtc.DataPacketKind.RELIABLE
            )
            
            logger.info(f"Voice message sent: {message[:50]}{'...' if len(message) > 50 else ''}")
            self.last_message_time = time.time()
            
        except Exception as e:
            logger.error(f"Error sending voice message: {str(e)}")
    
    async def announce_agent_joined(self):
        """Announce when the agent joins the room."""
        greeting = (
            "Hello! I'm your speaking coach. I'll analyze your speaking and provide "
            "feedback on areas for improvement. As you speak or write, I'll highlight "
            "specific points and explain how you can enhance your delivery. Looking "
            "forward to helping you improve your speaking skills!"
        )
        await self.send_voice_message(greeting)
    
    async def announce_agent_connected(self, participant: rtc.RemoteParticipant):
        """Announce when a new participant joins the room."""
        welcome = f"Welcome, {participant.name}! I'm your speaking coach, and I'll provide feedback on your speaking."
        await asyncio.sleep(1)  # Give time for the connection to stabilize
        await self.send_voice_message(welcome)
        
    async def process_transcript(self, transcript: str, language: str = "en"):
        """
        Process a transcript received from the user.
        This can be used to handle voice input or commands.
        
        Args:
            transcript: The text transcript from the user
            language: The language code of the transcript
        """
        try:
            logger.info(f"Processing transcript: '{transcript}'")
            
            # Check for commands in the transcript
            lower_transcript = transcript.lower()
            
            # Command: Start or resume explaining
            if any(cmd in lower_transcript for cmd in ["start explain", "continue", "resume"]):
                if self.paused:
                    self.paused = False
                    await self.send_voice_message("Resuming explanations.")
                    if not self.is_explaining:
                        await self.explain_next_highlight()
                else:
                    await self.send_voice_message("I'll continue explaining the highlights.")
                return
                
            # Command: Pause explaining
            if any(cmd in lower_transcript for cmd in ["pause", "stop explain", "wait"]):
                self.paused = True
                await self.send_voice_message("Pausing explanations. Let me know when you'd like to continue.")
                return
                
            # Command: Next highlight
            if any(cmd in lower_transcript for cmd in ["next", "next highlight", "move on"]):
                if not self.is_explaining:
                    await self.explain_next_highlight()
                else:
                    await self.send_voice_message("I'll move to the next highlight once I finish the current one.")
                return
                
            # Command: Refresh highlights
            if any(cmd in lower_transcript for cmd in ["refresh", "update highlights", "get new highlights"]):
                await self.highlight_handler.get_current_highlights_from_api()
                count = len(self.highlight_handler.highlights) if self.highlight_handler.highlights else 0
                await self.send_voice_message(f"I've refreshed the highlights. Found {count} highlights to discuss.")
                return
                
            # If no command is recognized, provide a generic response
            await self.send_voice_message("I'm your speaking coach. I'll analyze your highlights and provide feedback. Say 'next' to move to the next highlight, or 'pause' to pause explanations.")
            
        except Exception as e:
            logger.error(f"Error processing transcript: {str(e)}")
            await self.send_voice_message("I'm sorry, I encountered an issue processing your request.")
    
    async def highlight_check_loop(self):
        """
        Periodically check for new highlights from the API.
        """
        while self.is_connected:
            try:
                # If we haven't received highlights via Socket.IO,
                # try to fetch them from the API
                if (time.time() - self.highlight_handler.last_highlights_update > 10 and 
                    not self.highlight_handler.highlights):
                    
                    await self.highlight_handler.get_current_highlights_from_api()
                    
                    # If we got highlights and aren't already explaining, start
                    if (self.highlight_handler.highlights and 
                        not self.is_explaining and 
                        not self.paused):
                        await self.explain_next_highlight()
                
            except Exception as e:
                logger.error(f"Error in highlight check loop: {str(e)}")
                
            await asyncio.sleep(5)  # Check every 5 seconds
