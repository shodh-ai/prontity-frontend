import logging
import base64
from livekit.rtc.rpc import RpcInvocationData # For RPC invocation data
from generated.protos import interaction_pb2 # Your generated protobuf types

logger = logging.getLogger(__name__)

class AgentInteractionService: # Simple class without inheritance
    def __init__(self, agent_instance=None):
        # No base class, so no super().__init__() needed
        self.agent_instance = agent_instance
        logger.info("!!!!!! DEBUG: AgentInteractionService initialized. !!!!!")

    async def HandleFrontendButton(self, invocation_data: RpcInvocationData) -> str:
        print("!!!!!! DEBUG: HandleFrontendButton ENTERED (once) !!!!!!")
        logger.info("!!!!!! DEBUG: HandleFrontendButton ENTERED VIA LOGGER (once) !!!!!!")

        # Deserialize the request from invocation_data.payload
        request = interaction_pb2.FrontendButtonClickRequest()
        # The payload is a base64-encoded string from the LiveKit client
        # We need to decode it first before parsing
        try:
            if isinstance(invocation_data.payload, str):
                logger.info(f"RPC HandleFrontendButton: Payload is a string, assuming base64 encoded. Length: {len(invocation_data.payload)}")
                # First, decode the base64 string to bytes
                try:
                    # The payload might be a base64-encoded string - try to decode it
                    decoded_bytes = base64.b64decode(invocation_data.payload)
                    logger.info(f"Base64 decoded payload. Length: {len(decoded_bytes)}")
                    payload_bytes = decoded_bytes
                except Exception as e:
                    logger.error(f"Failed to decode base64 payload: {e}")
                    # If base64 decoding fails, try using the raw string encoded to bytes
                    payload_bytes = invocation_data.payload.encode('utf-8')
                    logger.info(f"Using raw UTF-8 encoded payload. Length: {len(payload_bytes)}")
            elif isinstance(invocation_data.payload, bytes):
                logger.info(f"RPC HandleFrontendButton: Payload is already bytes. Length: {len(invocation_data.payload)}")
                payload_bytes = invocation_data.payload
            else:
                logger.error(f"RPC HandleFrontendButton: Cannot handle payload type {type(invocation_data.payload)}")
                error_response = interaction_pb2.AgentResponse(status_message=f"Error: Unhandled payload type {type(invocation_data.payload)}", data_payload="")
                serialized_error = error_response.SerializeToString()
                return base64.b64encode(serialized_error).decode('utf-8')
            
            # Now parse the protobuf message from the bytes
            logger.info(f"Attempting to parse protobuf message from payload. First 100 bytes: {payload_bytes[:100]}")
            request.ParseFromString(payload_bytes)
            logger.info(f"Successfully parsed FrontendButtonClickRequest: button_id={request.button_id}, custom_data={request.custom_data}")
        except Exception as e:
            logger.error(f"RPC HandleFrontendButton: Failed to parse payload into FrontendButtonClickRequest: {e}", exc_info=True)
            logger.error(f"Received payload (first 100 bytes): {payload_bytes[:100] if 'payload_bytes' in locals() else 'unknown'}")
            
            # Return an error response
            error_response = interaction_pb2.AgentResponse(
                status_message=f"Error processing request: {str(e)}",
                data_payload="Parse error"
            )
            serialized_error = error_response.SerializeToString()
            return base64.b64encode(serialized_error).decode('utf-8')


        logger.info(f"RPC: HandleFrontendButton called by participant: {invocation_data.caller_identity}")
        logger.info(f"RPC: Request button_id='{request.button_id}', custom_data='{request.custom_data}'")
        
        response_message = f"Button '{request.button_id}' click processed by RoxAgent."
        if request.custom_data:
            response_message += f" Data: '{request.custom_data}'"

        # Create the protobuf response object
        response = interaction_pb2.AgentResponse(
            status_message=response_message,
            data_payload="Successfully processed by agent." # More descriptive success
        )
        
        # Serialize the response to bytes before returning
        logger.info(f"Sending response: {response}")
        serialized_response = response.SerializeToString()
        logger.info(f"Serialized response length: {len(serialized_response)} bytes")
        
        # Base64 encode the serialized response before returning
        base64_response = base64.b64encode(serialized_response).decode('utf-8')
        logger.info(f"Base64 encoded response length: {len(base64_response)} characters")
        
        return base64_response