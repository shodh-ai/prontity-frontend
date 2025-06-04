const express = require('express');
const tokenController = require('../controllers/tokenController');
const { sessionAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /api/token
 * @desc Generate a LiveKit access token. Requires Bearer token authentication.
 * @header {string} Authorization - Bearer session_token.
 * @body {string} [room_name] - Room name to create token for (e.g., 'default-toefl-room'). Defaults if not provided.
 * @body {string} [participant_identity] - The LiveKit identity for the participant. Defaults to the authenticated user's ID if not provided.
 * @returns {Object} - Object containing token, WebSocket URL, and confirmed user ID.
 */
router.post('/token', sessionAuth, tokenController.generateToken);

/**
 * @route GET /api/token
 * @desc Generate a LiveKit access token using query parameters. For development use.
 * @query {string} room - Room name to create token for
 * @query {string} username - The LiveKit identity for the participant
 * @returns {Object} - Object containing token
 */
router.get('/token', tokenController.generateTokenFromQuery);

// Optional: Add a route for token verification if needed
router.post('/verify', tokenController.verifyToken);

module.exports = router;