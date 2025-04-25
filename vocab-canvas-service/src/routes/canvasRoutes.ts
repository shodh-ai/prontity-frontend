import { Router } from 'express';
import { CanvasController } from '../controllers/canvasController';

const router = Router();
const canvasController = new CanvasController();

// Route for saving canvas state
router.post('/user/:userId/word/:wordId/canvas', canvasController.saveCanvasState.bind(canvasController));

// Route for getting canvas state
router.get('/user/:userId/word/:wordId/canvas', canvasController.getCanvasState.bind(canvasController));

// Route for deleting canvas state
router.delete('/user/:userId/word/:wordId/canvas', canvasController.deleteCanvasState.bind(canvasController));

// Route for getting all canvas states for a user
router.get('/user/:userId/canvas', canvasController.getAllUserCanvasStates.bind(canvasController));

export default router;
