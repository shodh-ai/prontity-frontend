#!/usr/bin/env python3
"""
Simple HTTP server to handle LiveKit room joining and token generation.
"""

import http.server
import socketserver
import json
import os
import time
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
import jwt  # For token creation

# Load environment variables
load_dotenv()

# Get LiveKit configuration
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
LIVEKIT_URL = os.getenv('LIVEKIT_URL')

# Store active room sessions
active_rooms = {}

class RoomHandler(http.server.SimpleHTTPRequestHandler):
    def _send_response(self, status_code, content):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')  # Enable CORS for local testing
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(content).encode('utf-8'))
    
    def do_OPTIONS(self):
        # Handle preflight CORS requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)
        
        # Root endpoint - server health check
        if path == '/':
            self._send_response(200, {"status": "LiveKit Room Server is running"})
            return
            
        # Token endpoint - generate a token for a room
        if path == '/token':
            room_name = query_params.get('room', [''])[0]
            username = query_params.get('username', ['user'])[0]
            
            if not room_name:
                self._send_response(400, {"error": "Missing room parameter"})
                return
                
            try:
                # Create a token using JWT
                now = int(time.time())
                exp = now + 3600  # Token valid for 1 hour
                
                payload = {
                    "iss": LIVEKIT_API_KEY,
                    "sub": username,
                    "exp": exp,
                    "nbf": now,
                    "video": {
                        "roomJoin": True,
                        "room": room_name,
                        "canPublish": True,
                        "canSubscribe": True
                    }
                }
                
                token = jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")
                
                # Keep track of the room
                active_rooms[room_name] = {
                    "created_at": now,
                    "participants": active_rooms.get(room_name, {}).get("participants", []) + [username]
                }
                
                print(f"Generated token for user {username} in room {room_name}")
                
                self._send_response(200, {
                    "token": token,
                    "wsUrl": LIVEKIT_URL
                })
            except Exception as e:
                print(f"Error generating token: {str(e)}")
                self._send_response(500, {"error": f"Error generating token: {str(e)}"})
            
            return
            
        # Room status endpoint
        if path.startswith('/room-status/'):
            room_name = path.split('/')[-1]
            if room_name in active_rooms:
                participants = active_rooms[room_name].get("participants", [])
                self._send_response(200, {
                    "status": "active",
                    "participants": participants,
                    "participant_count": len(participants)
                })
            else:
                self._send_response(200, {"status": "not_active"})
            return
            
        # List rooms endpoint
        if path == '/list-rooms':
            room_list = [{
                "name": room,
                "participants": info.get("participants", []),
                "created_at": info.get("created_at")
            } for room, info in active_rooms.items()]
            
            self._send_response(200, {"rooms": room_list})
            return
            
        # Handle 404 for any other path
        self._send_response(404, {"error": "Not found"})


def run_server(port=8080):
    """Run the server on the specified port"""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or not LIVEKIT_URL:
        print("ERROR: Missing LiveKit configuration. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL in your .env file")
        return
    
    handler = RoomHandler
    
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Room Server running at http://localhost:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Server stopped.")


if __name__ == "__main__":
    run_server()
