import { Request, Response } from 'express';
import { CanvasRepository } from '../data/canvasRepository';
import { CanvasStatePayload } from '../types';

// Create repository instance
const canvasRepository = new CanvasRepository();

/**
 * Controller for canvas operations
 */
export class CanvasController {
  /**
   * Save canvas state for a user and word
   * @param req Express request
   * @param res Express response
   */
  async saveCanvasState(req: Request, res: Response): Promise<void> {
    const { userId, wordId } = req.params;
    const canvasData: CanvasStatePayload = req.body;

    try {
      // Basic validation
      if (!userId || !wordId) {
        res.status(400).json({ 
          status: 'error', 
          message: 'Missing required parameters: userId and wordId are required' 
        });
        return;
      }

      if (!Array.isArray(canvasData)) {
        res.status(400).json({ 
          status: 'error', 
          message: 'Invalid canvas data format: expected an array of drawing elements' 
        });
        return;
      }

      // Save canvas state
      await canvasRepository.saveCanvasState(userId, wordId, canvasData);
      
      // Return success response
      res.status(200).json({ 
        status: 'success', 
        message: 'Canvas state saved successfully' 
      });
    } catch (error) {
      console.error('Error in saveCanvasState controller:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'An error occurred while saving the canvas state' 
      });
    }
  }

  /**
   * Get canvas state for a user and word
   * @param req Express request
   * @param res Express response
   */
  async getCanvasState(req: Request, res: Response): Promise<void> {
    const { userId, wordId } = req.params;

    try {
      // Basic validation
      if (!userId || !wordId) {
        res.status(400).json({ 
          status: 'error', 
          message: 'Missing required parameters: userId and wordId are required' 
        });
        return;
      }

      // Get canvas state
      const canvasData = await canvasRepository.getCanvasState(userId, wordId);

      // Return 404 if not found
      if (canvasData === null) {
        res.status(404).json({ 
          status: 'error', 
          message: 'Canvas state not found for the specified user and word' 
        });
        return;
      }

      // Return canvas data
      res.status(200).json(canvasData);
    } catch (error) {
      console.error('Error in getCanvasState controller:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'An error occurred while retrieving the canvas state' 
      });
    }
  }

  /**
   * Delete canvas state for a user and word
   * @param req Express request
   * @param res Express response
   */
  async deleteCanvasState(req: Request, res: Response): Promise<void> {
    const { userId, wordId } = req.params;

    try {
      // Basic validation
      if (!userId || !wordId) {
        res.status(400).json({ 
          status: 'error', 
          message: 'Missing required parameters: userId and wordId are required' 
        });
        return;
      }

      // Delete canvas state
      const deleted = await canvasRepository.deleteCanvasState(userId, wordId);

      // Return appropriate response based on deletion result
      if (deleted) {
        res.status(200).json({ 
          status: 'success', 
          message: 'Canvas state deleted successfully' 
        });
      } else {
        res.status(404).json({ 
          status: 'error', 
          message: 'Canvas state not found for the specified user and word' 
        });
      }
    } catch (error) {
      console.error('Error in deleteCanvasState controller:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'An error occurred while deleting the canvas state' 
      });
    }
  }

  /**
   * Get all canvas states for a user
   * @param req Express request
   * @param res Express response
   */
  async getAllUserCanvasStates(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    try {
      // Basic validation
      if (!userId) {
        res.status(400).json({ 
          status: 'error', 
          message: 'Missing required parameter: userId is required' 
        });
        return;
      }

      // Get all canvas states for the user
      const canvasStates = await canvasRepository.getAllUserCanvasStates(userId);

      // Return canvas data
      res.status(200).json(canvasStates);
    } catch (error) {
      console.error('Error in getAllUserCanvasStates controller:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'An error occurred while retrieving the canvas states' 
      });
    }
  }
}
