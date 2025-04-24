const { AccessToken } = require('livekit-server-sdk');

/**
 * Generate a LiveKit access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.generateToken = async (req, res, next) => {
  try {
    const { room, username } = req.query;
    
    // Input validation
    if (!room) {
      return res.status(400).json({ error: 'Missing "room" query parameter' });
    } else if (!username) {
      return res.status(400).json({ error: 'Missing "username" query parameter' });
    }

    // Environment validation
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Create token with appropriate permissions
    const at = new AccessToken(apiKey, apiSecret, { identity: username });
    
    // Add grant with specific permissions
    at.addGrant({ 
      room, 
      roomJoin: true, 
      canPublish: true, 
      canSubscribe: true 
    });

    // Generate and return token
    const token = await at.toJwt();
    
    // Log token generation (but not the actual token)
    console.log(`Token generated for user: ${username}, room: ${room}`);
    
    // Return token and WebSocket URL
    return res.status(200).json({
      token,
      wsUrl,
      // You could add additional metadata here if needed
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return next(error);
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
