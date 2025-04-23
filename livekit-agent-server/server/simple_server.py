#!/usr/bin/env python3
"""
Simple HTTP server to simulate LiveKit Agent endpoints.
This uses only Python standard library - no dependencies required.
"""

import http.server
import socketserver
import json
import time
from urllib.parse import urlparse, parse_qs

# Store simulated agent sessions
active_sessions = {}

class AgentHandler(http.server.SimpleHTTPRequestHandler):
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
        
        # Root endpoint - server health check
        if path == '/':
            self._send_response(200, {"status": "LiveKit Agent Server is running"})
            return
            
        # Status endpoint - check agent status
        if path.startswith('/status/'):
            room_name = path.split('/')[-1]
            if room_name in active_sessions:
                self._send_response(200, {"status": active_sessions[room_name]["status"]})
            else:
                self._send_response(200, {"status": "not_connected"})
            return
            
        # Handle 404 for any other path
        self._send_response(404, {"error": "Not found"})
    
    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # Get request body for POST requests
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        try:
            if post_data:
                body = json.loads(post_data)
            else:
                body = {}
        except json.JSONDecodeError:
            self._send_response(400, {"error": "Invalid JSON"})
            return
        
        # Connect agent endpoint
        if path == '/connect-agent':
            room_name = body.get('room_name')
            if not room_name:
                self._send_response(400, {"error": "Missing room_name parameter"})
                return
                
            # If agent already connected, return existing status
            if room_name in active_sessions:
                self._send_response(200, {"status": "Agent already connected to this room"})
                return
                
            # Simulate agent connection
            agent_identity = f"ai-assistant-{room_name}"
            active_sessions[room_name] = {
                "status": "initializing",
                "identity": agent_identity,
                "connected_at": time.time()
            }
            
            # Simulate the connection process (will update to "connected" after a delay)
            def update_status():
                # In a separate thread, this would update the status
                # For simulation, the frontend will poll the status endpoint
                pass
                
            print(f"Agent connecting to room: {room_name}")
            
            # After 2 seconds, simulate successful connection
            active_sessions[room_name]["status"] = "connected"
            
            self._send_response(200, {
                "status": "Agent connecting to room",
                "room": room_name,
                "identity": agent_identity
            })
            return
            
        # Disconnect agent endpoint
        if path.startswith('/disconnect-agent/'):
            room_name = path.split('/')[-1]
            if room_name in active_sessions:
                agent_identity = active_sessions[room_name].get("identity", "unknown")
                del active_sessions[room_name]
                print(f"Agent disconnected from room: {room_name}")
                self._send_response(200, {
                    "status": "Agent disconnected from room",
                    "agent_identity": agent_identity
                })
            else:
                self._send_response(200, {"status": "Agent not connected to this room"})
            return
            
        # Handle 404 for any other path
        self._send_response(404, {"error": "Not found"})


def run_server(port=8080):
    """Run the server on the specified port"""
    handler = AgentHandler
    
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Server running at http://localhost:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Server stopped.")


if __name__ == "__main__":
    run_server()
