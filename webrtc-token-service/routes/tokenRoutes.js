const express = require('express');
const tokenController = require('../controllers/tokenController');

const router = express.Router();

/**
 * @route GET /api/token
 * @desc Generate a LiveKit access token
 * @param {string} room - Room name to create token for
 * @param {string} username - User identity to create token for
 * @returns {Object} - Object containing token and WebSocket URL
 */
router.get('/token', tokenController.generateToken);

// Optional: Add a route for token verification if needed
router.post('/verify', tokenController.verifyToken);

module.exports = router;
