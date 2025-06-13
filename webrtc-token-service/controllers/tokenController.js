const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

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

    // Assign defaults
    const room_name = req_room_name || 'default-toefl-room';
    const participant_identity = req_participant_identity || application_user_id;
    const participant_name = authenticated_user_name || 'Participant';

    // Environment validation
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      console.error("LiveKit API Key, Secret, or Host not configured in environment variables.");
      return res.status(500).json({ error: 'Server misconfigured - LiveKit credentials missing' });
    }

    // Prepare metadata
    const metadataPayload = {
      user_id: application_user_id,
      app_role: "student",
      userToken: req.userInfo.userToken,
      userId: userId,
    };
    const metadataString = JSON.stringify(metadataPayload);

    const roomServiceClient = new RoomServiceClient(wsUrl, apiKey, apiSecret);

    const roomOptions = {
      name: room_name,
      emptyTimeout: 300,
      maxParticipants: 2,
      metadata: metadataString,
    };
    const room = await roomServiceClient.createRoom(roomOptions);


    // Create token with appropriate permissions
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participant_identity,
      name: participant_name,
      metadata: metadataString,
      ttl: '1h'
    });
    
    // Define grants (permissions)
    const roomGrant = {
      room: room_name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };

    at.addGrant(roomGrant);

    // Generate token
    const token = await at.toJwt();
    
    // Return token and WebSocket URL
    return res.status(200).json({
      token,
      wsUrl,
      user_id_confirmed: application_user_id
    });

  } catch (error) {
    console.error('Token generation error:', error);
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
    const { room, username } = req.query;
    
    if (!room || !username) {
      return res.status(400).json({ error: 'Missing required query parameters: room and username' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(500).json({ error: 'Server misconfigured - LiveKit credentials missing' });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: username });

    at.addGrant({ 
      roomJoin: true, 
      room: room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const token = at.toJwt();

    return res.status(200).json({ token, wsUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Verify a LiveKit access token
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
    
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }
    
    const decoded = AccessToken.validate(token, apiKey, apiSecret);
    
    return res.status(200).json({
      valid: true,
      decoded: {
        identity: decoded.identity,
        grants: decoded.video
      }
    });
    
  } catch (error) {
    if (error.message.includes('invalid token')) {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }
    
    return next(error);
  }
};
