// src/data/contentRepository.ts
import pool from '../config/db';
import { VocabWord, SpeakingTopic, WritingPrompt } from '../types';

// Helper function to map database rows to TypeScript types
const mapToVocabWord = (row: any): VocabWord => ({
    wordId: row.word_id,
    wordText: row.word_text,
    definition: row.definition,
    exampleSentence: row.example_sentence,
    difficultyLevel: row.difficulty_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const mapToSpeakingTopic = (row: any): SpeakingTopic => ({
    topicId: row.topic_id,
    title: row.title,
    promptText: row.prompt_text,
    difficultyLevel: row.difficulty_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const mapToWritingPrompt = (row: any): WritingPrompt => ({
    promptId: row.prompt_id,
    title: row.title,
    promptText: row.prompt_text,
    difficultyLevel: row.difficulty_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const findVocabWordById = async (wordId: string): Promise<VocabWord | null> => {
    const query = 'SELECT * FROM vocab_words WHERE word_id = $1';
    try {
        const result = await pool.query(query, [wordId]);
        if (result.rows.length > 0) {
            return mapToVocabWord(result.rows[0]);
        }
        return null;
    } catch (error) {
        console.error('Error fetching vocab word:', error);
        throw error; // Re-throw the error to be handled by the controller
    }
};

export const findSpeakingTopicById = async (topicId: string): Promise<SpeakingTopic | null> => {
    const query = 'SELECT * FROM speaking_topics WHERE topic_id = $1';
    try {
        const result = await pool.query(query, [topicId]);
        if (result.rows.length > 0) {
            return mapToSpeakingTopic(result.rows[0]);
        }
        return null;
    } catch (error) {
        console.error('Error fetching speaking topic:', error);
        throw error;
    }
};

export const findWritingPromptById = async (promptId: string): Promise<WritingPrompt | null> => {
    const query = 'SELECT * FROM writing_prompts WHERE prompt_id = $1';
    try {
        const result = await pool.query(query, [promptId]);
        if (result.rows.length > 0) {
            return mapToWritingPrompt(result.rows[0]);
        }
        return null;
    } catch (error) {
        console.error('Error fetching writing prompt:', error);
        throw error;
    }
};
