// src/controllers/contentController.ts
import { Request, Response } from 'express';
import * as contentRepository from '../data/contentRepository';

export const getVocabWord = async (req: Request, res: Response): Promise<void> => {
    const { wordId } = req.params;
    try {
        const word = await contentRepository.findVocabWordById(wordId);
        if (word) {
            res.status(200).json(word);
        } else {
            res.status(404).json({ message: `Vocabulary word with ID '${wordId}' not found.` });
        }
    } catch (error) {
        console.error('Error in getVocabWord controller:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getSpeakingTopic = async (req: Request, res: Response): Promise<void> => {
    const { topicId } = req.params;
    try {
        const topic = await contentRepository.findSpeakingTopicById(topicId);
        if (topic) {
            res.status(200).json(topic);
        } else {
            res.status(404).json({ message: `Speaking topic with ID '${topicId}' not found.` });
        }
    } catch (error) {
        console.error('Error in getSpeakingTopic controller:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getWritingPrompt = async (req: Request, res: Response): Promise<void> => {
    const { promptId } = req.params;
    try {
        const prompt = await contentRepository.findWritingPromptById(promptId);
        if (prompt) {
            res.status(200).json(prompt);
        } else {
            res.status(404).json({ message: `Writing prompt with ID '${promptId}' not found.` });
        }
    } catch (error) {
        console.error('Error in getWritingPrompt controller:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
