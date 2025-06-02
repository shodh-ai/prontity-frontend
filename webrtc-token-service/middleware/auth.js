/**
 * Authentication middleware to protect endpoints
 * Basic implementation using API key authentication
 */

const jwt = require('jsonwebtoken');
// Dynamically import node-fetch
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const sessionAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - Missing or invalid Bearer token format' });
  }

  const sessionToken = authHeader.split(' ')[1];

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized - Bearer token is empty' });
  }

  console.log("JWT Token:", sessionToken);
  req.userInfo = {
    userToken: sessionToken
  }

  // try {
  //   // 1. Verify JWT locally
  //   if (!process.env.JWT_SECRET) {
  //     console.error('JWT_SECRET is not defined in environment variables.');
  //     return res.status(500).json({ error: 'Authentication configuration error: JWT_SECRET missing' });
  //   }
  //   const decodedToken = jwt.verify(sessionToken, process.env.JWT_SECRET);

  //   if (!decodedToken || !decodedToken.userId) {
  //     console.error('Invalid token or userId missing in token payload for token:', sessionToken);
  //     return res.status(401).json({ error: 'Invalid token or userId missing' });
  //   }

  //   const userId = decodedToken.userId;

  //   // 2. Fetch user details (including name) from pronity-backend
  //   console.log('Fetching user details from pronity-backend for userId:', userId);

  //   const pronityUserInfoUrl = `${process.env.PRONITY_BACKEND_USER_INFO_URL}`;
    
  //   const response = await fetch(pronityUserInfoUrl, {
  //     method: 'GET',
  //     headers: {
  //       'Authorization': `Bearer ${sessionToken}`, // Pass the original token to pronity-backend
  //       'Content-Type': 'application/json'
  //     }
  //   });

  //   if (!response.ok) {
  //     const errorBody = await response.text(); // Read error body for more details
  //     console.error(`Failed to fetch user info from pronity-backend. Status: ${response.status}, Body: ${errorBody}`);
  //     return res.status(response.status).json({ error: `Failed to validate session with backend: ${response.statusText}` });
  //   }

  //   const pronityUserResponse = await response.json();

  //   if (!pronityUserResponse || !pronityUserResponse.user || !pronityUserResponse.user.firstName) {
  //     console.error('User details (firstName) not found in pronity-backend response:', pronityUserResponse);
  //     return res.status(500).json({ error: 'Failed to retrieve complete user details from backend' });
  //   }

  //   const { firstName, lastName } = pronityUserResponse.user;
  //   const participantName = lastName ? `${firstName} ${lastName}` : firstName;

  //   // 3. Populate req.userInfo
  //   req.userInfo = {
  //     userId: userId,
  //     name: participantName
  //   };

  //   console.log(`User ${userId} authenticated successfully. Name: ${participantName}`);
    next();

  // } catch (error) {
  //   if (error instanceof jwt.JsonWebTokenError) {
  //     console.error('JWT verification failed:', error.message);
  //     return res.status(401).json({ error: `Invalid session token: ${error.message}` });
  //   } else if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
  //       console.error('Network error connecting to pronity-backend:', error);
  //       return res.status(503).json({ error: 'Service unavailable: Could not connect to authentication backend' });
  //   }
  //   console.error('Authentication error:', error);
  //   return res.status(500).json({ error: 'Authentication failed due to an unexpected server error' });
  // }
};

module.exports = {
  sessionAuth // Exporting the new session-based auth middleware
};
