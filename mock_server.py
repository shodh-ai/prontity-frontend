import asyncio
import json
import logging
import random
import time
from websockets.server import serve

logging.basicConfig(level=logging.INFO)

# --- Mock Data Generation ---
# This function takes text and returns mock feedback
# based on your AI's output structure, transformed for the frontend.
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
                "id": f"mock-specific-{i+1}-{time.time()}", # Unique ID
                "start": item["start"], # Use absolute indices from AI
                "end": item["end"],
                "type": "grammar",
                "message": f"Change '{item['wrong_version']}' to '{item['correct_version']}'",
            })
    else:
        # Example 2: Generic feedback - highlight all occurrences of "the"
        search_term = "the"
        start_index = 0
        count = 1
        logging.info(f"'{phrase}' not found. Searching for '{search_term}'.")
        while True:
            index = text.find(search_term, start_index)
            if index == -1:
                break
            feedback_payload.append({
                "id": f"mock-the-{count}-{time.time()}", # Unique ID
                "start": index,
                "end": index + len(search_term),
                "type": "suggestion", # Different type for different styling
                "message": f"Consider replacing '{search_term}' with a more specific word.",
            })
            start_index = index + 1
            count += 1

    # Add a coherence suggestion if text is long enough
    if len(text) > 100:
        feedback_payload.append({
            "id": f"mock-coherence-{time.time()}", 
            "start": 50,
            "end": 80,
            "type": "coherence",
            "message": "This paragraph could be more cohesive with your main argument.",
        })

    if not feedback_payload:
        logging.info("No specific or generic feedback generated.")

    return feedback_payload

# --- WebSocket Handler ---
# Store active connections with a limit
MAX_CONNECTIONS = 50
active_connections = set()

# Track connection attempts to avoid resource exhaustion
connection_attempts = {}

async def handler(websocket, path):
    client_ip = websocket.remote_address[0]
    client_id = f"{client_ip}:{id(websocket)}"
    
    # Check if there are too many connections
    if len(active_connections) >= MAX_CONNECTIONS:
        logging.warning(f"Connection limit reached ({MAX_CONNECTIONS}). Rejecting connection from {client_id}")
        await websocket.close(1013, "Maximum connections reached")
        return
        
    # Check if this client is making too many connection attempts
    current_time = time.time()
    if client_ip in connection_attempts:
        # Clean up old attempts (older than 10 seconds)
        connection_attempts[client_ip] = [t for t in connection_attempts[client_ip] if current_time - t < 10]
        # If more than 5 attempts in 10 seconds, reject
        if len(connection_attempts[client_ip]) > 5:
            logging.warning(f"Too many connection attempts from {client_ip}. Rejecting.")
            await websocket.close(1008, "Too many connection attempts")
            return
        connection_attempts[client_ip].append(current_time)
    else:
        connection_attempts[client_ip] = [current_time]
    
    logging.info(f"Client {client_id} connected on path {path}")
    
    # Check if this is the expected path
    if path != '/ws' and path != '/':
        logging.warning(f"Unexpected path: {path}. Expected /ws or /")
        await websocket.close(1008, f"Unexpected path: {path}")
        return
        
    # Add to active connections
    active_connections.add(websocket)
    logging.info(f"Active connections: {len(active_connections)}")
        
    try:
        # Send a connection acknowledgment
        await websocket.send(json.dumps({
            "type": "connection_ack",
            "sessionId": f"session-{time.time()}",
            "message": "Connected to mock WebSocket server"
        }))
        logging.info("Sent connection acknowledgment")
        # You could add logic here based on the 'path' if needed
        # e.g., if path == '/ws/ai-feedback': ...

        async for message in websocket:
            logging.info(f"Received message: {message}")
            try:
                data = json.loads(message)
                # Check if it's the message type we expect from the frontend
                if data.get("type") == "text_update" and "content" in data:
                    received_text = data["content"]
                    timestamp = data.get("timestamp", 0)
                    logging.info(f"Processing text_update (timestamp: {timestamp}): '{received_text[:50]}...'")

                    # Simulate processing time
                    await asyncio.sleep(0.5 + random.uniform(0, 0.5)) # Simulate 0.5-1s delay

                    # Generate mock feedback based on the received text
                    feedback = generate_mock_feedback(received_text)

                    # Prepare response message
                    response = {
                        "type": "ai_suggestion",
                        "suggestions": feedback
                    }
                    await websocket.send(json.dumps(response))
                    logging.info(f"Sent ai_suggestion with {len(feedback)} items.")

                else:
                    logging.warning(f"Received unknown message format: {data}")
                    # Send an error back
                    await websocket.send(json.dumps({
                        "type": "error", 
                        "code": "invalid_format",
                        "message": "Unknown message format"
                    }))

            except json.JSONDecodeError:
                logging.error(f"Could not decode JSON from message: {message}")
                await websocket.send(json.dumps({
                    "type": "error", 
                    "code": "invalid_json",
                    "message": "Invalid JSON received"
                }))
            except Exception as e:
                logging.error(f"Error processing message: {e}", exc_info=True)
                await websocket.send(json.dumps({
                    "type": "error", 
                    "code": "server_error",
                    "message": f"Server error: {str(e)}"
                }))

    except Exception as e:
        logging.error(f"Connection error: {e}", exc_info=True)
    finally:
        # Clean up the websocket properly
        try:
            # Remove from active connections
            if websocket in active_connections:
                active_connections.remove(websocket)
                
            # Force close if not already closed
            if not websocket.closed:
                await websocket.close(1000, "Server cleanup")
                
            logging.info(f"Client {client_id} disconnected. Remaining connections: {len(active_connections)}")
        except Exception as cleanup_error:
            logging.error(f"Error during cleanup for {client_id}: {cleanup_error}")

# --- Start Server ---
async def main():
    host = "localhost"
    # Use the same port your frontend expects
    port = 8000
    
    # Set up ping for connection health checks (every 20 seconds)
    ping_interval = 20
    ping_timeout = 10
    
    # Using the WebSocket server with a specific path and ping settings
    server = await serve(
        handler, 
        host, 
        port,
        ping_interval=ping_interval,
        ping_timeout=ping_timeout,
        max_size=1024 * 1024,  # 1MB max message size
        max_queue=32  # Limit backlog queue
    )
    
    logging.info(f"Mock WebSocket server started on ws://{host}:{port} with ping interval {ping_interval}s")
    
    # Set up a shutdown handler
    try:
        await asyncio.Future()  # Run forever
    except asyncio.CancelledError:
        logging.info("Server shutdown requested")
    finally:
        # Close all active connections when shutting down
        if active_connections:
            logging.info(f"Closing {len(active_connections)} active connections")
            close_tasks = [ws.close(1001, "Server shutdown") for ws in active_connections]
            await asyncio.gather(*close_tasks, return_exceptions=True)
        server.close()
        await server.wait_closed()
        logging.info("Server shutdown complete")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server stopped by user")
    except Exception as e:
        logging.error(f"Server error: {e}", exc_info=True)
