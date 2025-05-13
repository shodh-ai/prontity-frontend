import argparse
import asyncio
import html
import httpx  # For async HTTP requests to AI service
import json
import logging
import random
import re
import socketio
import sys
import time
import uuid
import hashlib
import uvicorn
from html.parser import HTMLParser
from typing import Dict, List, Any, Set, Tuple, Optional

# --- Configuration for AI Service ---
AI_SERVICE_URL = "http://127.0.0.1:8000/analyze"  # URL for the real AI service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('socket_io_server')

# Create a Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # For development; restrict in production
    ping_interval=25,
    ping_timeout=10
)

# Create an ASGI app to wrap the Socket.IO server
app = socketio.ASGIApp(sio)

# --- Connection Management ---
MAX_CONNECTIONS = 50
active_clients: Set[str] = set()
connection_attempts: Dict[str, List[float]] = {}

# Track suggestions for each client to maintain them across edits
client_suggestions: Dict[str, List[Dict[str, Any]]] = {}

# --- HTML Handling ---
class HTMLStripper(HTMLParser):
    """Enhanced HTML parser to convert HTML to plain text and track positions for Tiptap"""
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = []
        # Mapping of plain text indices to HTML indices
        self.index_map = []
        self.current_pos = 0
        # Keep track of current context
        self.in_paragraph = False
        self.debug_info = []

    def handle_data(self, data):
        logger.debug(f"Handling data: '{data}' at HTML pos {self.current_pos}")
        # For each character in the data, add a mapping
        start_plain_idx = len(self.text)
        start_html_idx = self.current_pos
        
        for char in data:
            self.text.append(char)
            self.index_map.append(self.current_pos)
            self.current_pos += 1
        
        # Add detailed debug info
        logger.debug(f"Text '{data}' mapped from plain text positions {start_plain_idx}-{len(self.text)} to HTML pos {start_html_idx}-{self.current_pos}")
        self.debug_info.append({
            'type': 'data',
            'text': data,
            'html_start': start_html_idx,
            'html_end': self.current_pos,
            'plain_start': start_plain_idx,
            'plain_end': len(self.text)
        })

    def handle_starttag(self, tag, attrs):
        # For Tiptap, paragraph tags are important for position calculation
        if tag == 'p':
            self.in_paragraph = True
            
        # Skip the tag in the text but advance HTML position counter
        tag_text = self.get_starttag_text()
        if tag_text:
            self.current_pos += len(tag_text)
            self.debug_info.append({
                'type': 'start_tag',
                'tag': tag,
                'text': tag_text,
                'pos': self.current_pos
            })

    def handle_endtag(self, tag):
        # Update paragraph tracking
        if tag == 'p':
            self.in_paragraph = False
            
        # Skip the end tag in text but advance HTML position counter
        end_tag = f"</{tag}>"
        self.current_pos += len(end_tag)
        self.debug_info.append({
            'type': 'end_tag',
            'tag': tag,
            'text': end_tag,
            'pos': self.current_pos
        })

    def get_text(self) -> str:
        return ''.join(self.text)

def html_to_text_with_mapping(html_content: str) -> Tuple[str, List[int], List[Dict]]:
    """Convert HTML to plain text and create a mapping of indices"""
    stripper = HTMLStripper()
    stripper.feed(html_content)
    return stripper.get_text(), stripper.index_map, stripper.debug_info

# --- Mock Data Generation ---
# NOTE: This function is no longer actively used and is kept for reference only.
# The actual implementation now uses the real AI service at http://127.0.0.1:8000/analyze
def generate_mock_feedback(text: str, parser=None) -> list:
    """
    Generate mock AI feedback based on text content.
    This simulates what an AI service would return.
    
    Args:
        text: The text content to analyze
        parser: Optional parser if text is already parsed
    """
    # If parser is provided, use its text and index_map directly
    if parser:
        plain_text = parser.text  # text is already plain text
        index_map = parser.index_map
        debug_info = getattr(parser, 'debug_info', {})
        logger.info(f"Using provided parser with text length: {len(plain_text)}")
    else:
        # Otherwise, convert HTML to plain text and establish position mapping
        plain_text, index_map, debug_info = html_to_text_with_mapping(text)
        logger.info(f"Converted HTML to plain text. Length: {len(plain_text)}")
    
    # Make sure plain_text is a string, not a list
    if isinstance(plain_text, list):
        plain_text = ''.join(plain_text)
        logger.info(f"Converted plain_text from list to string. Length: {len(plain_text)}")
    
    # EDGE CASE #9: Special Characters and Non-Latin Scripts
    # Check if the text contains non-Latin characters
    has_non_latin = any(ord(c) > 127 for c in plain_text) if isinstance(plain_text, str) else False
    if has_non_latin:
        logger.info(f"Text contains non-Latin characters, using special character handling")
        # In a real implementation, we would use a more sophisticated index mapping
        # that handles multi-byte characters and different encodings correctly
    
    # EDGE CASE #10: Batch Processing for very long documents
    # If the text is very long, process it in chunks to avoid performance issues
    CHUNK_SIZE = 5000  # Define a reasonable chunk size
    if len(plain_text) > CHUNK_SIZE:
        logger.info(f"Text is very long ({len(plain_text)} chars), processing in chunks")
        # Split into chunks while preserving word boundaries
        chunks = []
        start = 0
        while start < len(plain_text):
            # Find a good break point that doesn't split words
            end = min(start + CHUNK_SIZE, len(plain_text))
            if end < len(plain_text):
                # Try to find a space to break on
                while end > start and plain_text[end-1] != ' ':
                    end -= 1
                if end == start:  # No space found, just use the max size
                    end = min(start + CHUNK_SIZE, len(plain_text))
            
            chunks.append(plain_text[start:end])
            start = end
        
        logger.info(f"Split into {len(chunks)} chunks for processing")
        # Process each chunk separately and combine results
        # For now, we'll just use the first chunk for demonstration
        # In a real implementation, we would process all chunks and merge the results
        plain_text = chunks[0]  # Just use the first chunk for demonstration
        logger.info(f"Using first chunk for demonstration: {len(plain_text)} chars")
    
    logger.info(f"Converted HTML to plain text. Length: {len(plain_text)}")
    
    logger.info(f"Plain Text Preview: '{plain_text[:50]}...'")
    
    # Define common patterns for highlighting in all text
    common_patterns = [
        (r'\bimportant\b', 'coherence', 'Consider emphasizing this point further'),
        (r'\bhowever\b', 'grammar', 'Ensure this transition word is used correctly'),
        (r'\btherefore\b', 'suggestion', 'Consider alternative transition: consequently'),
        (r'\bsignificant\b', 'coherence', 'Provide supporting evidence for this claim')
    ]
    
    # Start with an empty payload
    feedback_payload = []
    
    # Always scan for these common patterns in all text
    for pattern, highlight_type, message in common_patterns:
        try:
            matches = list(re.finditer(pattern, plain_text, re.IGNORECASE))
            for match in matches:
                start_pos = match.start()
                end_pos = match.end()
                matched_text = match.group(0)
                
                # Create a unique highlight ID
                highlight_id = f"{highlight_type}-{uuid.uuid4().hex[:8]}"
                
                feedback_payload.append({
                    "id": highlight_id,
                    "start": start_pos,
                    "end": end_pos,
                    "type": highlight_type,
                    "message": message,
                    "wrongVersion": matched_text,
                    "correctVersion": matched_text.upper() if highlight_type == 'suggestion' else matched_text
                })
                
                logger.info(f"Found {highlight_type} pattern '{matched_text}' at position {start_pos}-{end_pos}")
        except Exception as e:
            logger.error(f"Error processing pattern '{pattern}': {e}")
    
    # If we found patterns, return those results
    if feedback_payload:
        logger.info(f"Found {len(feedback_payload)} pattern matches in text")
        return feedback_payload
    
    # Otherwise continue with specific test cases
    feedback_payload = []
    
    # 1. Test for the grammar test case (She have had...)
    test_phrase = "She have had one to many to drink"
    if test_phrase in plain_text:
        logger.info(f"Found test phrase in plain text: '{test_phrase}'")
        # Create fixed position highlights for this known phrase
        # These positions work well with TipTap/ProseMirror's position model
        feedback_payload = [
            {
                "id": f"grammar-{uuid.uuid4().hex[:8]}",
                "start": 5,  # Position of 'have'
                "end": 9,    # End of 'have'
                "type": "grammar",
                "message": "Change 'have' to 'has'",
                "wrongVersion": "have",
                "correctVersion": "has"
            },
            {
                "id": f"grammar-{uuid.uuid4().hex[:8]}",
                "start": 18,  # Position of first 'to'
                "end": 20,    # End of first 'to'
                "type": "grammar",
                "message": "Change 'to' to 'too'",
                "wrongVersion": "to",
                "correctVersion": "too"
            },
            {
                "id": f"grammar-{uuid.uuid4().hex[:8]}",
                "start": 21,  # Position of 'many'
                "end": 25,    # End of 'many'
                "type": "grammar",
                "message": "Change 'many' to 'many,'",
                "wrongVersion": "many",
                "correctVersion": "many,"
            }
        ]
    
    # 2. Test for overlapping highlights
    elif "overlapping highlights" in plain_text:
        logger.info("Found test case for overlapping highlights")
        
        # Find the target phrase and use index mapping to ensure accuracy
        word_pattern = re.compile(r'\boverlapping\b')  # Use word boundary for exact match
        phrase_pattern = re.compile(r'\boverlapping highlights\b')
        
        # Find the match positions in plain text
        word_match = word_pattern.search(plain_text)
        phrase_match = phrase_pattern.search(plain_text)
        
        # Initialize with default values
        word_start = -1
        word_end = -1
        phrase_start = -1
        phrase_end = -1
        
        if word_match:
            word_start = word_match.start()
            word_end = word_match.end()
            logger.info(f"Found 'overlapping' at positions {word_start}-{word_end}: '{plain_text[word_start:word_end]}'")
        
        if phrase_match:
            phrase_start = phrase_match.start()
            phrase_end = phrase_match.end()
            logger.info(f"Found 'overlapping highlights' at positions {phrase_start}-{phrase_end}: '{plain_text[phrase_start:phrase_end]}'")
            
        # Find sentence boundaries for coherence highlight
        # Start at beginning of text or after last period, whichever is closer
        if word_start >= 0:
            sentence_start = max(0, plain_text.rfind(".", 0, word_start) + 1)
            if sentence_start == 1:  # No period found or at the beginning
                sentence_start = 0
            
            # End at next period or end of text
            sentence_end = plain_text.find(".", word_end)
            if sentence_end == -1:  # No period found
                sentence_end = len(plain_text)
            else:
                sentence_end += 1  # Include the period
            
            logger.info(f"Found sentence at positions {sentence_start}-{sentence_end}: '{plain_text[sentence_start:sentence_end]}'")
        
            # Create overlapping highlights using regex-found positions
            feedback_payload = []
            
            # Only add highlights if we found the patterns
            if word_start >= 0:
                # Grammar highlight for just "overlapping"
                feedback_payload.append({
                    "id": f"grammar-{uuid.uuid4().hex[:8]}",
                    "start": word_start,
                    "end": word_end,
                    "type": "grammar",
                    "message": "Grammar highlight: 'overlapping' → 'overlapped'",
                    "wrongVersion": "overlapping",
                    "correctVersion": "overlapped"
                })
            
            if phrase_start >= 0:
                # Suggestion highlight for "overlapping highlights"
                feedback_payload.append({
                    "id": f"suggestion-{uuid.uuid4().hex[:8]}",
                    "start": phrase_start,
                    "end": phrase_end,
                    "type": "suggestion",
                    "message": "Suggestion highlight: Consider using 'intersecting markers'",
                    "wrongVersion": plain_text[phrase_start:phrase_end],
                    "correctVersion": "intersecting markers"
                })
            
            # Coherence highlight for the entire sentence
            feedback_payload.append({
                "id": f"coherence-{uuid.uuid4().hex[:8]}",
                "start": sentence_start,
                "end": sentence_end,
                "type": "coherence",
                "message": "Coherence highlight: Rewrite this entire phrase",
                "wrongVersion": plain_text[sentence_start:sentence_end].strip(),
                "correctVersion": "This sentence demonstrates multiple highlight types in the same region."
            })
            
            # Print final positions to verify correct highlighting
            for item in feedback_payload:
                try:
                    logger.info(f"{item['type']} highlight at positions {item['start']}-{item['end']}: '{plain_text[item['start']:item['end']]}'")
                except Exception as e:
                    logger.error(f"Error accessing text positions: {e}")
                    logger.error(f"Plain text length: {len(plain_text)}, Requested: {item['start']}:{item['end']}")
        else:
            logger.warning("Could not find 'overlapping' in the text")
            # Create empty feedback if pattern not found
            feedback_payload = []
    
    # 3. Test for persistence of highlights during edits
    elif "Edit this text" in plain_text:
        logger.info("Found test case for persistence of highlights during edits")
        
        # Use regex to find the phrase even if it has been partially edited
        edit_pattern = re.compile(r'\bEdit\s+this\s+text\b', re.IGNORECASE)
        edit_match = edit_pattern.search(plain_text)
        
        if edit_match:
            edit_start = edit_match.start()
            edit_end = edit_match.end()
            matched_text = edit_match.group(0)
            
            logger.info(f"Found edit test text at positions {edit_start}-{edit_end}: '{matched_text}'")
            
            # Create a unique ID that persists across edits by hashing a substring
            # This allows us to maintain the same highlight ID even as the text changes
            stable_id = hashlib.md5("edit_test_case".encode()).hexdigest()[:8]
            
            feedback_payload = [{
                "id": f"grammar-{stable_id}",  # Use stable ID to persist across edits
                "start": edit_start,
                "end": edit_end,
                "type": "grammar",
                "message": "Consider rewording: '{matched_text}' -> 'Modify this content'",
                "wrongVersion": matched_text,
                "correctVersion": "Modify this content"
            }]
            
            # Log what we're highlighting to verify
            logger.info(f"Created highlight at positions {edit_start}-{edit_end} with ID grammar-{stable_id}: '{plain_text[edit_start:edit_end]}'")
            
            # Client-side will maintain this highlight's position during edits
            # based on the stable ID and the ProseMirror position mapping
        else:
            feedback_payload = []
    
    # 4. Test for deleted content handling
    elif "Delete this part" in plain_text:
        logger.info("Found test case for deleted content handling")
        
        # Find the target phrase
        delete_pattern = re.compile(r'\bDelete\s+this\s+part\b')
        delete_match = delete_pattern.search(plain_text)
        
        if delete_match:
            delete_start = delete_match.start()
            delete_end = delete_match.end()
            delete_text = delete_match.group(0)
            
            logger.info(f"Found deletion test phrase at positions {delete_start}-{delete_end}: '{delete_text}'")
            
            # Track state of this suggestion with a stable ID
            stable_id = hashlib.md5("delete_test_case".encode()).hexdigest()[:8]
            
            # Create a suggestion to delete the text
            feedback_payload = [{
                "id": f"suggestion-{stable_id}",
                "start": delete_start,
                "end": delete_end,
                "type": "suggestion",
                "message": "This text should be removed. Delete it to test highlight removal.",
                "wrongVersion": delete_text,
                "correctVersion": ""
            }]
            
            logger.info(f"Created deletion highlight: '{plain_text[delete_start:delete_end]}'")
            
            # When the user deletes this text, the highlight should disappear
            # as it will have zero length, and our highlight logic skips zero-length highlights
        else:
            feedback_payload = []
    
    # 5. Test for long documents performance
    elif len(plain_text) > 500:
        logger.info(f"Found test case for long document performance: {len(plain_text)} characters")
        
        # For long documents, we want to create highlights at various positions
        # to test scrolling and performance
        feedback_payload = []
        
        # Find some interesting words to highlight throughout the document
        patterns = [
            (r'\bimportant\b', 'coherence', 'Consider emphasizing this point further'),
            (r'\bhowever\b', 'grammar', 'Ensure this transition word is used correctly'),
            (r'\btherefore\b', 'suggestion', 'Consider alternative transition: consequently'),
            (r'\bsignificant\b', 'coherence', 'Provide supporting evidence for this claim')
        ]
        
        # Create highlights throughout the document
        for pattern, highlight_type, message in patterns:
            matches = list(re.finditer(pattern, plain_text, re.IGNORECASE))
            for match in matches:
                start_pos = match.start()
                end_pos = match.end()
                matched_text = match.group(0)
                
                # Create a unique highlight ID
                highlight_id = f"{highlight_type}-{uuid.uuid4().hex[:8]}"
                
                feedback_payload.append({
                    "id": highlight_id,
                    "start": start_pos,
                    "end": end_pos,
                    "type": highlight_type,
                    "message": message,
                    "wrongVersion": matched_text,
                    "correctVersion": matched_text.upper() if highlight_type == 'suggestion' else matched_text
                })
                
                logger.info(f"Created {highlight_type} highlight in long document at position {start_pos}: '{matched_text}'")
    
    # 6. Test for HTML with complex formatting
    elif "<strong>" in text or "<em>" in text:
        logger.info("Found test case for complex HTML formatting")
        
        # For formatted text testing, we need to find text with HTML formatting tags
        # and ensure that our highlighting system works properly with it
        
        # Find words near formatting tags in the plain text
        formatted_text_pattern = re.compile(r'\b\w+\s*\w*\b', re.IGNORECASE)
        
        # First, find a few words that might have formatting
        test_words = []
        for match in formatted_text_pattern.finditer(plain_text):
            if len(test_words) < 3:  # Limit to 3 suggestions
                word = match.group(0).strip()
                if len(word) > 3:  # Only use substantial words
                    pos = match.start()
                    test_words.append((pos, pos + len(word), word))
        
        feedback_payload = []
        
        # Create highlights for these words
        for i, (start_pos, end_pos, word) in enumerate(test_words):
            highlight_type = 'grammar' if i == 0 else 'suggestion' if i == 1 else 'coherence'
            
            feedback_payload.append({
                "id": f"{highlight_type}-format-{uuid.uuid4().hex[:8]}",
                "start": start_pos,
                "end": end_pos,
                "type": highlight_type,
                "message": f"This formatted text could be improved - test for HTML and formatting",
                "wrongVersion": word,
                "correctVersion": word.upper() if highlight_type == 'suggestion' else word
            })
            
            logger.info(f"Created {highlight_type} highlight for formatted text at {start_pos}-{end_pos}: '{word}'")
        
        # If we didn't find any suitable words, fallback to a generic highlight
        if len(feedback_payload) == 0:
            # Find any substantial piece of text to highlight
            if len(plain_text) > 20:
                feedback_payload.append({
                    "id": f"coherence-format-{uuid.uuid4().hex[:8]}",
                    "start": 0,
                    "end": min(20, len(plain_text)),
                    "type": "coherence",
                    "message": "This formatted text should be tested with highlights",
                    "wrongVersion": plain_text[:20],
                    "correctVersion": plain_text[:20].upper()
                })
    
    # If none of the specific test cases matched, look for 'the' instances
    elif len(feedback_payload) == 0:
        logger.info("No test phrases found. Searching for 'the' in text.")
        pattern = re.compile(r'\bthe\b')
        for match in pattern.finditer(plain_text):
            start = match.start()
            end = match.end()
            
            # Map plain text positions to HTML positions
            if start < len(index_map) and end-1 < len(index_map):
                html_start = index_map[start]
                html_end = index_map[end-1] + 1
                
                feedback_payload.append({
                    "id": f"suggestion-{uuid.uuid4().hex[:8]}",
                    "start": html_start,
                    "end": html_end,
                    "type": "suggestion",
                    "message": "Consider replacing 'the' with a more specific word.",
                    "wrongVersion": "the",
                    "correctVersion": "this" if random.random() > 0.5 else "that"
                })
        
        # Also add a coherence suggestion if the text is long enough
        if len(plain_text) > 50:
            middle_idx = min(len(plain_text) // 2, len(index_map) - 1)
            start_idx = max(0, middle_idx - 15)
            end_idx = min(len(plain_text), middle_idx + 15)
            
            if start_idx < len(index_map) and end_idx-1 < len(index_map):
                html_start = index_map[start_idx]
                html_end = index_map[end_idx-1] + 1
                
                feedback_payload.append({
                    "id": f"coherence-{uuid.uuid4().hex[:8]}",
                    "start": html_start,
                    "end": html_end,
                    "type": "coherence",
                    "message": "Consider revising this section for clarity.",
                    "wrongVersion": plain_text[start_idx:end_idx],
                    "correctVersion": f"[Revised version of this text section]" 
                })
    
    # Log what we're returning
    for item in feedback_payload:
        logger.info(f"Prepared suggestion: {item['type']} at positions {item['start']}-{item['end']}")
    
    return feedback_payload

# --- Socket.IO Event Handlers ---

@sio.event
async def connect(sid, environ):
    """Handle new client connections"""
    client_ip = environ.get('REMOTE_ADDR', 'unknown')
    client_id = f"{client_ip}:{sid}"
    
    # Check if there are too many connections
    if len(active_clients) >= MAX_CONNECTIONS:
        logger.warning(f"Connection limit reached ({MAX_CONNECTIONS}). Rejecting connection from {client_id}")
        return False  # Reject the connection
    
    # Check for rate limiting
    current_time = time.time()
    if client_ip in connection_attempts:
        # Clean up old attempts (older than 10 seconds)
        connection_attempts[client_ip] = [t for t in connection_attempts[client_ip] if current_time - t < 10]
        # If more than 5 attempts in 10 seconds, reject
        if len(connection_attempts[client_ip]) > 5:
            logger.warning(f"Too many connection attempts from {client_ip}. Rejecting.")
            return False  # Reject the connection
        connection_attempts[client_ip].append(current_time)
    else:
        connection_attempts[client_ip] = [current_time]
    
    # Add to active clients
    active_clients.add(sid)
    logger.info(f"Client {client_id} connected. Active connections: {len(active_clients)}")
    
    # Send connection acknowledgment
    await sio.emit('connection_ack', {
        'type': 'connection_ack',
        'clientId': sid,
        'message': 'Connected to Socket.IO server'
    }, to=sid)
    
    return True  # Accept the connection

@sio.event
async def disconnect(sid):
    """Handle client disconnections"""
    if sid in active_clients:
        active_clients.remove(sid)
    logger.info(f"Client {sid} disconnected. Remaining connections: {len(active_clients)}")

@sio.event
async def message(sid, data):
    """Handle incoming messages from clients"""
    logger.info(f"Received message from {sid}: {str(data)[:100]}...")
    
    try:
        # Highlights update messages - broadcast to all clients
        if isinstance(data, dict) and data.get('type') == 'highlights_update':
            logger.info(f"Broadcasting highlights update from {sid} to all clients")
            highlights = data.get('highlights', [])
            logger.info(f"Broadcasting {len(highlights)} highlights")
            
            # Store highlights for this client
            client_suggestions[sid] = highlights
            
            # Broadcast to all connected clients
            await sio.emit('highlights_update', data)
            return
        
        # Text content updates from the editor
        elif isinstance(data, dict) and data.get('type') == 'text_update':
            received_text = data.get('content', '')
            timestamp = data.get('timestamp', 0)
            
            if not received_text:
                logger.warning(f"Received empty text from {sid}")
                await sio.emit('message', {
                    'type': 'error',
                    'code': 'empty_content',
                    'message': 'Empty content received'
                }, to=sid)
                return
            
            logger.info(f"Processing text_update (timestamp: {timestamp}): '{received_text[:50]}...'")
            
            # Initialize client suggestions dictionary if not already done
            if sid not in client_suggestions:
                client_suggestions[sid] = []
            
            # Simulate processing time
            await asyncio.sleep(0.5 + random.uniform(0, 0.5))  # 0.5-1s delay
            
            # Parse HTML to plain text with position tracking
            parser = HTMLStripper()
            parser.feed(received_text)
            plain_text = ''.join(parser.text)
            index_map = parser.index_map
            
            logger.info(f"Processed plain text: {plain_text[:100]}...")
            
            # Prepare payload for the real AI service
            ai_request_payload = {
                "transcripts": [
                    {
                        "topic": "User Input Analysis",
                        "paragraph": plain_text
                    }
                ]
            }
            
            # Call the real AI service
            feedback = []
            try:
                logger.info(f"Calling real AI service for SID {sid}...")
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(AI_SERVICE_URL, json=ai_request_payload)
                    response.raise_for_status()
                    ai_response_data = response.json()
                    logger.info(f"Received response from AI service: {str(ai_response_data)[:200]}...")
                    
                    # Transform AI response to frontend format
                    if ai_response_data and "results" in ai_response_data and ai_response_data["results"]:
                        first_result = ai_response_data["results"][0]
                        
                        # Process error items (corrections/suggestions)
                        if "errors" in first_result:
                            for error_item in first_result["errors"]:
                                if all(k in error_item for k in ["start", "end", "wrong_version", "correct_version"]):
                                    # Create a unique ID for this suggestion
                                    suggestion_id = f"suggestion-{uuid.uuid4().hex[:8]}"
                                    
                                    feedback.append({
                                        "id": suggestion_id,
                                        "start": error_item["start"],
                                        "end": error_item["end"],
                                        "type": "suggestion",  # Default to suggestion, can be refined based on AI response
                                        "message": f"Change '{error_item['wrong_version']}' to '{error_item['correct_version']}'.",
                                        "wrongVersion": error_item["wrong_version"],
                                        "correctVersion": error_item["correct_version"]
                                    })
                                    logger.info(f"Created suggestion at position {error_item['start']}-{error_item['end']}: '{error_item['wrong_version']}' -> '{error_item['correct_version']}'")
                        
                        # Process grammar feedback
                        if "grammar_feedback" in first_result and first_result["grammar_feedback"]:
                            feedback.append({
                                "id": f"grammar-{uuid.uuid4().hex[:8]}",
                                "start": 0,
                                "end": len(plain_text),
                                "type": "grammar",
                                "message": f"Grammar: {first_result['grammar_feedback']}"
                            })
                            logger.info(f"Added grammar feedback: {first_result['grammar_feedback'][:100]}...")
                        
                        # Process coherence feedback
                        if "coherence_feedback" in first_result and first_result["coherence_feedback"]:
                            feedback.append({
                                "id": f"coherence-{uuid.uuid4().hex[:8]}",
                                "start": 0,
                                "end": len(plain_text),
                                "type": "coherence",
                                "message": f"Coherence: {first_result['coherence_feedback']}"
                            })
                            logger.info(f"Added coherence feedback: {first_result['coherence_feedback'][:100]}...")
                    else:
                        logger.warning("AI service returned empty or invalid response")
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error calling AI service: {e.response.status_code} - {e.response.text}", exc_info=True)
            except httpx.RequestError as e:
                logger.error(f"Network error calling AI service: {e}", exc_info=True)
            except Exception as e:
                logger.error(f"Unexpected error processing AI response: {e}", exc_info=True)
            
            # If no feedback was generated (errors occurred), use fallback
            if not feedback:
                logger.warning("No feedback received from AI service, using fallback")
                # Simple fallback in case the AI service fails
                if len(plain_text) > 5:
                    # Find a word to highlight
                    word_match = re.search(r'\b\w{4,}\b', plain_text)
                    if word_match:
                        word = word_match.group(0)
                        start_pos = word_match.start()
                        end_pos = word_match.end()
                        feedback.append({
                            "id": f"fallback-{uuid.uuid4().hex[:8]}",
                            "start": start_pos,
                            "end": end_pos,
                            "type": "suggestion",
                            "message": f"Consider reviewing this word: {word}",
                            "wrongVersion": word,
                            "correctVersion": word.upper()  # Simple transformation for demo
                        })
                        logger.info(f"Created fallback suggestion at position {start_pos}-{end_pos}: '{word}'")
            
            # Convert plain text positions to HTML positions
            for item in feedback:
                if 'start' in item and item['start'] < len(index_map):
                    item['start'] = index_map[item['start']]
                if 'end' in item and item['end'] < len(index_map):
                    item['end'] = index_map[item['end']]
            
            # Ensure start and end are numbers, not strings
            for item in feedback:
                item['start'] = int(item['start']) if isinstance(item['start'], str) else item['start']
                item['end'] = int(item['end']) if isinstance(item['end'], str) else item['end']
                
                # Log each item's position information
                logger.info(f"Suggestion: {item['type']} at positions {item['start']}-{item['end']}")
                if "overlapping highlights" in plain_text:
                    logger.info(f"Text highlighted: '{plain_text[item['start']:item['end']]}'")
            
            # Save suggestions for this client
            client_suggestions[sid] = feedback
            
            # Send AI suggestions back to the client
            response = {
                'type': 'ai_suggestion',
                'suggestions': feedback
            }
            
            # Send the response to the client
            await sio.emit('ai_suggestion', response, to=sid)
            logger.info(f"Sent ai_suggestion with {len(feedback)} items to {sid}")
        else:
            logger.warning(f"Received unknown message format from {sid}: {data}")
            await sio.emit('message', {
                'type': 'error',
                'code': 'invalid_format',
                'message': 'Unknown message format'
            }, to=sid)
    except Exception as e:
        logger.error(f"Error processing message from {sid}: {e}", exc_info=True)
        await sio.emit('message', {
            'type': 'error',
            'code': 'server_error',
            'message': f'Server error: {str(e)}'
        }, to=sid)

# --- Server Startup ---

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Socket.IO Mock Server for AI Suggestions')
    parser.add_argument('--host', default='localhost', help='Host to bind the server to')
    parser.add_argument('--port', type=int, default=8001, help='Port to bind the server to')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    return parser.parse_args()

def start_server():
    """Start the Socket.IO server"""
    args = parse_args()
    
    # Set logging level based on debug flag
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.setLevel(logging.DEBUG)
    
    logger.info(f"Starting Socket.IO server on http://{args.host}:{args.port}")
    
    # Run the server
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info" if not args.debug else "debug"
    )

if __name__ == "__main__":
    try:
        start_server()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
