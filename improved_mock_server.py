import asyncio
import json
import logging
import random
import time
import signal
from websockets.server import serve

logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')

# --- Mock Data Generation ---
def generate_mock_feedback(text: str) -> list:
    feedback_payload = []
    
    # Example 1: Simple hardcoded feedback for a specific phrase
    phrase = "She have had one to many to drink"
    if phrase in text:
        base_index = text.find(phrase)
        logging.info(f"'{phrase}' found at index {base_index}. Generating specific feedback.")
        mock_ai_output = [
            {"start": base_index + 4, "end": base_index + 8, "wrong_version": "have", "correct_version": "has"},
            {"start": base_index + 17, "end": base_index + 19, "wrong_version": "to", "correct_version": "too"},
            {"start": base_index + 20, "end": base_index + 24, "wrong_version": "many", "correct_version": "many,"},
        ]

        for i, item in enumerate(mock_ai_output):
            feedback_payload.append({
                "id": f"mock-specific-{i+1}-{time.time()}", 
                "start": item["start"],
                "end": item["end"],
                "type": "grammar",
                "message": f"Change '{item['wrong_version']}' to '{item['correct_version']}'",
            })
    else:
        # Example 2: Generic feedback based on text length
        if len(text) > 10:
            # Find "the" occurrences with a maximum of 3
            search_term = "the"
            count = 0
            start_index = 0
            
            while count < 3:
                index = text.find(search_term, start_index)
                if index == -1:
                    break
                    
                feedback_payload.append({
                    "id": f"mock-the-{count+1}-{time.time()}", 
                    "start": index,
                    "end": index + len(search_term),
                    "type": "suggestion",
                    "message": f"Consider replacing '{search_term}' with a more specific word.",
                })
                
                start_index = index + len(search_term)
                count += 1

    # Add a coherence suggestion if text is long enough
    if len(text) > 50:
        feedback_payload.append({
            "id": f"mock-coherence-{time.time()}", 
            "start": min(50, len(text) - 10),
            "end": min(80, len(text) - 1),
            "type": "coherence",
            "message": "This paragraph could be more cohesive with your main argument.",
        })

    return feedback_payload

# --- WebSocket Server ---
class WebsocketServer:
    def __init__(self, host='localhost', port=8000):
        self.host = host
        self.port = port
        self.active_connections = set()
        self.max_connections = 10
        self.connection_limits = {}
        self.shutdown_event = asyncio.Event()
        self.server = None

    async def handler(self, websocket, path):
        client_ip = websocket.remote_address[0]
        client_id = f"{client_ip}:{id(websocket)}"
        
        # Handle connection limits
        if len(self.active_connections) >= self.max_connections:
            logging.warning(f"Max connections ({self.max_connections}) reached. Rejecting {client_id}.")
            await websocket.close(1013, "Maximum connections reached")
            return
            
        # Check for rate limiting
        now = time.time()
        if client_ip in self.connection_limits:
            attempts = [t for t in self.connection_limits[client_ip] if now - t < 10]
            
            if len(attempts) > 5:
                logging.warning(f"Rate limit exceeded for {client_ip}. Rejecting connection.")
                await websocket.close(1008, "Too many connections")
                return
                
            self.connection_limits[client_ip] = attempts + [now]
        else:
            self.connection_limits[client_ip] = [now]
            
        # Process connection
        try:
            logging.info(f"Client {client_id} connected on path {path}")
            
            # Add to active connections
            self.active_connections.add(websocket)
            logging.info(f"Active connections: {len(self.active_connections)}")
            
            # Send connection acknowledgment
            await websocket.send(json.dumps({
                "type": "connection_ack",
                "sessionId": f"session-{time.time()}",
                "message": "Connected to mock WebSocket server"
            }))
            
            # Process messages
            async for message in websocket:
                if self.shutdown_event.is_set():
                    break
                    
                try:
                    data = json.loads(message)
                    
                    # Handle text updates
                    if data.get("type") == "text_update" and "content" in data:
                        text = data["content"]
                        logging.info(f"Received text update ({len(text)} chars)")
                        
                        # Add a short delay to simulate processing
                        await asyncio.sleep(0.3)
                        
                        # Generate mock feedback
                        feedback = generate_mock_feedback(text)
                        
                        # Send response
                        response = {
                            "type": "ai_suggestion",
                            "suggestions": feedback
                        }
                        
                        await websocket.send(json.dumps(response))
                        logging.info(f"Sent {len(feedback)} suggestions")
                    else:
                        logging.warning(f"Unknown message type: {data.get('type')}")
                        
                except json.JSONDecodeError:
                    logging.error(f"Invalid JSON received: {message[:50]}...")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON format"
                    }))
                except Exception as e:
                    logging.error(f"Error processing message: {str(e)}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": f"Server error: {str(e)}"
                    }))
                    
        except Exception as e:
            logging.error(f"Connection error: {str(e)}")
        finally:
            # Clean up
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                
            logging.info(f"Client {client_id} disconnected. Remaining: {len(self.active_connections)}")
    
    async def start(self):
        logging.info(f"Starting WebSocket server on ws://{self.host}:{self.port}")
        
        # Configure the server with robust settings
        self.server = await serve(
            self.handler,
            self.host,
            self.port,
            ping_interval=20,  # Send ping every 20 seconds
            ping_timeout=10,   # Wait 10 seconds for pong
            max_size=1024 * 1024,  # 1MB max message size
            max_queue=16,  # Limit connection queue
            close_timeout=5,  # Force close after 5 seconds
        )
        
        # Set up signal handlers for graceful shutdown
        for sig in (signal.SIGINT, signal.SIGTERM):
            asyncio.get_event_loop().add_signal_handler(
                sig, lambda: asyncio.create_task(self.shutdown())
            )
            
        logging.info("Server started. Press Ctrl+C to stop.")
        
        # Keep server running until shutdown
        await self.shutdown_event.wait()
        
    async def shutdown(self):
        if self.shutdown_event.is_set():
            return
            
        logging.info("Shutting down server...")
        self.shutdown_event.set()
        
        # Close all client connections
        if self.active_connections:
            logging.info(f"Closing {len(self.active_connections)} connections...")
            close_tasks = [ws.close(1001, "Server shutting down") 
                          for ws in self.active_connections]
            await asyncio.gather(*close_tasks, return_exceptions=True)
            
        # Close the server
        self.server.close()
        await self.server.wait_closed()
        logging.info("Server shutdown complete")

# --- Main Entry Point ---
async def main():
    server = WebsocketServer()
    await server.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server stopped by user")
    except Exception as e:
        logging.error(f"Server error: {e}")
