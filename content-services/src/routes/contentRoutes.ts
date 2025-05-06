// src/routes/contentRoutes.ts
import { Router } from 'express';
import * as contentController from '../controllers/contentController';

const router = Router();

// --- Vocabulary Routes ---
router.get('/vocab/:wordId', contentController.getVocabWord);

// --- Speaking Topic Routes ---
router.get('/speaking/topic/:topicId', contentController.getSpeakingTopic);

// --- Writing Prompt Routes ---
router.get('/writing/prompt/:promptId', contentController.getWritingPrompt);

export default router;
