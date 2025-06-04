const { AccessToken, RoomGrant } = require('livekit-server-sdk'); // RoomGrant might not be strictly needed if using object literal for grant, but good for clarity.

/**
 * Generate a LiveKit access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.generateToken = async (req, res, next) => {
  try {
    // User information from sessionAuth middleware
    const { userId: application_user_id, name: authenticated_user_name } = req.userInfo;

    // Parameters from request body (optional overrides)
    const { room_name: req_room_name, participant_identity: req_participant_identity, User_id: userId } = req.body;

    console.log(`[tokenController] Received User_id from req.body: ${userId}, type: ${typeof userId}`);

    // Input validation (application_user_id is guaranteed by sessionAuth if it reaches here)
    // No need for: if (!application_user_id) { ... }

    // Assign defaults
    const room_name = req_room_name || 'default-toefl-room';
    // Participant identity defaults to the authenticated user's ID, but can be overridden from request body
    const participant_identity = req_participant_identity || application_user_id;
    // Participant name defaults to the authenticated user's name
    const participant_name = authenticated_user_name || 'Participant'; // Fallback if name wasn't in session

    // Environment validation
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      console.error("LiveKit API Key, Secret, or Host not configured in environment variables.");
      return res.status(500).json({ error: 'Server misconfigured - LiveKit credentials missing' });
    }

    console.log(`Generating LiveKit token for application_user_id: ${application_user_id}, participant_identity: ${participant_identity}, name: ${participant_name}, room: ${room_name}`);

    // --- THIS IS THE KEY MODIFICATION AREA ---
    const metadataPayload = {
      user_id: application_user_id, // Your application's user ID
      app_role: "student",
      userToken: req.userInfo.userToken,
      userId: userId,
      // You can add other relevant, non-sensitive info here
    };
    const metadataString = JSON.stringify(metadataPayload);
    console.log(`[tokenController] Generated metadataString: ${metadataString}`);
    // --- END KEY MODIFICATION AREA ---

    console.log("Metadata String:", metadataString);

    // Create token with appropriate permissions
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participant_identity,
      name: participant_name,
      metadata: metadataString, 
      ttl: '1h' // Example: 1 hour validity, or use a number in seconds
    });
    
    // Define grants (permissions)
    const roomGrant = { // Using RoomGrant directly as an object
      room: room_name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // hidden: false, // whether participant is hidden from others
      // recorder: false, // whether participant is a recorder
    };

    at.addGrant(roomGrant); // Add the grant to the token

    // Generate and return token
    const token = await at.toJwt();
    
    console.log(`Token generated successfully for application_user_id: ${application_user_id}, participant_identity: ${participant_identity}`);
    
    // Return token and WebSocket URL
    return res.status(200).json({
      token,
      wsUrl,
      user_id_confirmed: application_user_id
    });

  } catch (error) {
    console.error('Token generation error:', error);
    // Consider more specific error handling if needed
    return res.status(500).json({ error: 'Failed to generate LiveKit token', details: error.message });
  }
};

/**
 * Generate a LiveKit access token from query parameters (for development use)
 * @param {Object} req - Express request object with query parameters
 * @param {Object} res - Express response object
 */
exports.generateTokenFromQuery = async (req, res, next) => {
  try {
    // Extract room and username from query parameters
    const { room, username } = req.query;
    
    if (!room || !username) {
      return res.status(400).json({ error: 'Missing required query parameters: room and username' });
    }

    // Environment validation
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      console.error("LiveKit API Key, Secret, or Host not configured in environment variables.");
      return res.status(500).json({ error: 'Server misconfigured - LiveKit credentials missing' });
    }

    console.log(`Generating LiveKit token for room: ${room}, username: ${username}`);

    // Create a new access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username
    });

    // Create token with room access
    at.addGrant({ 
      roomJoin: true, 
      room: room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    // Generate the token
    const token = at.toJwt();

    // Return the token
    return res.status(200).json({
      token,
      wsUrl
    });
  } catch (error) {
    console.error(`Error generating token from query: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Verify a LiveKit access token (optional functionality)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Missing token in request body' });
    }
    
    // Environment validation
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }
    
    // Verify the token
    const decoded = AccessToken.validate(token, apiKey, apiSecret);
    
    // Return validation result
    return res.status(200).json({
      valid: true,
      decoded: {
        identity: decoded.identity,
        grants: decoded.video
      }
    });
    
  } catch (error) {
    // If token is invalid, return specific error
    if (error.message.includes('invalid token')) {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }
    
    console.error('Token verification error:', error);
    return next(error);
  }
};
