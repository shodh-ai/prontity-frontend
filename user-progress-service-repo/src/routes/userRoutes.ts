import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as userController from '../controllers/userController';
// Import the authentication middleware
import { authenticateToken } from '../middleware/authMiddleware'; 

const router = Router();

// --- Authentication Routes --- //
router.post('/auth/register', authController.registerUser);
router.post('/auth/login', authController.loginUser);

// --- User Profile & Progress Routes (Protected) --- //
// All routes below this point would ideally use authenticateToken middleware

// User Profile
router.get('/users/me', authenticateToken, userController.getUserProfile); 

// Progress
router.get('/users/me/progress', authenticateToken, userController.getUserProgress);
router.post('/users/me/progress', authenticateToken, userController.recordTaskCompletion);

// Next Task (ToC logic)
router.get('/users/me/next-task', authenticateToken, userController.getNextTask);

// SRS Review Items
router.get('/users/me/srs/review-items', authenticateToken, userController.getSrsReviewItems);

export default router;
