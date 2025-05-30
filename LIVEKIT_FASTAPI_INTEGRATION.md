# LiveKit-FastAPI Integration Guide

This guide explains how to test and use the enhanced bidirectional communication between the FastAPI backend and LiveKit agent.

## Architecture Overview

```
Frontend Client <---> LiveKit Server <---> LiveKit Agent <---> FastAPI Backend
```

The flow of UI actions:
1. FastAPI backend generates UI actions
2. LiveKit agent receives actions via HTTP response
3. LiveKit agent sends actions to client via RPC
4. Client performs the requested UI actions

## Key Components Enhanced

1. **FastAPI Backend**
   - Added a validated `UIAction` model
   - Improved error handling and data validation
   - Added test endpoint for direct UI action testing

2. **LiveKit Agent (RoxAgent)**
   - Enhanced `process_ui_actions` method with robust error handling
   - Improved participant handling via `remote_participants`
   - Added detailed logging to trace UI action flow

3. **CustomLLMBridge**
   - Updated to extract UI actions from FastAPI responses
   - Added support for both legacy and new UI action formats

## Testing the Integration

### Prerequisites
- Both the LiveKit agent server and FastAPI backend must be running
- At least one client must be connected to the LiveKit room

### Method 1: Using the Test Script

A test script is provided to easily send UI actions:

```bash
# Basic alert test
./test_ui_action.py

# Custom alert message
./test_ui_action.py --message "Hello from custom test!"

# Update text in an element
./test_ui_action.py --action_type UPDATE_TEXT_CONTENT --target_element_id "agentUpdatableTextRoxPage" --message "Text updated via test script"
```

### Method 2: Using curl

```bash
# Show an alert
curl -X POST http://localhost:5005/test/ui_actions \
  -H "Content-Type: application/json" \
  -d '[{"action_type": "SHOW_ALERT", "parameters": {"message": "Test alert via curl"}}]'

# Update text in an element
curl -X POST http://localhost:5005/test/ui_actions \
  -H "Content-Type: application/json" \
  -d '[{"action_type": "UPDATE_TEXT_CONTENT", "target_element_id": "agentUpdatableTextRoxPage", "parameters": {"text": "Updated via curl"}}]'
```

## Supported UI Action Types

The following action types are supported:

- `SHOW_ALERT`: Display an alert with a message
  ```json
  {
    "action_type": "SHOW_ALERT",
    "parameters": {"message": "Alert message"}
  }
  ```

- `UPDATE_TEXT_CONTENT`: Update text in a DOM element
  ```json
  {
    "action_type": "UPDATE_TEXT_CONTENT",
    "target_element_id": "elementId",
    "parameters": {"text": "New text content"}
  }
  ```

- `UPDATE_ELEMENT_ATTRIBUTE`: Update an attribute of a DOM element
  ```json
  {
    "action_type": "UPDATE_ELEMENT_ATTRIBUTE",
    "target_element_id": "elementId",
    "parameters": {"attribute": "src", "value": "new-image.jpg"}
  }
  ```

## Troubleshooting

### Checking Logs

Look for the following log messages to trace UI action flow:

1. **FastAPI Backend**: 
   - "Validated X UI actions"
   - "UI action X: action_type=..."

2. **CustomLLMBridge**:
   - "Received ui_actions from FastAPI"
   - "Created task to process X UI actions via RoxAgent" 

3. **RoxAgent**:
   - "RoxAgent.process_ui_actions ENTRY POINT"
   - "Processing X UI actions from backend API"
   - "Sending UI action X to client Y"

4. **Frontend Client**:
   - Check browser console for RPC-related logs

### Common Issues

1. **UI Actions Not Received by RoxAgent**:
   - Ensure the `_rox_agent_ref` is properly passed to `CustomLLMBridge`
   - Check that the response from FastAPI contains the `ui_actions` field

2. **UI Actions Not Sent to Client**:
   - Verify that remote participants are available in the room
   - Check if the client properly registered the RPC handler

3. **Client Not Processing Actions**:
   - Ensure the client has implemented the proper RPC handler
   - Verify that the action type is valid and supported by the client
