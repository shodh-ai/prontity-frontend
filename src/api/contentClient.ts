/**
 * Content Service API Client
 * 
 * This module provides functions to interact with the Content Service API,
 * which provides access to vocabulary words, speaking topics, and writing prompts.
 */

import { VocabWord, SpeakingTopic, WritingPrompt } from '../types/contentTypes';

// The base URL for the content service API
const CONTENT_SERVICE_URL = process.env.NEXT_PUBLIC_CONTENT_SERVICE_URL || 'http://localhost:3001';

/**
 * Error class for Content API related errors
 */
export class ContentApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ContentApiError';
    this.statusCode = statusCode;
  }
}

// Define types for list items (summary/preview information)
export interface VocabListItem {
  wordId: string;
  wordText: string;
  difficultyLevel?: number | null;
}

export interface SpeakingTopicListItem {
  topicId: string;
  title: string;
  difficultyLevel?: number | null;
}

export interface WritingPromptListItem {
  promptId: string;
  title: string;
  difficultyLevel?: number | null;
}

/**
 * Fetches a vocabulary word by its ID
 * @param wordId The unique identifier of the vocabulary word
 * @returns Promise resolving to the vocabulary word data
 * @throws ContentApiError if the request fails
 */
export async function fetchVocabWord(wordId: string): Promise<VocabWord> {
  try {
    const response = await fetch(`${CONTENT_SERVICE_URL}/content/vocab/${wordId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new ContentApiError(`Vocabulary word '${wordId}' not found`, 404);
      }
      throw new ContentApiError(`Error fetching vocabulary word: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ContentApiError) {
      throw error;
    }
    throw new ContentApiError(`Network error when fetching vocabulary word: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches a speaking topic by its ID
 * @param topicId The unique identifier of the speaking topic
 * @returns Promise resolving to the speaking topic data
 * @throws ContentApiError if the request fails
 */
export async function fetchSpeakingTopic(topicId: string): Promise<SpeakingTopic> {
  try {
    const response = await fetch(`${CONTENT_SERVICE_URL}/content/speaking/topic/${topicId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new ContentApiError(`Speaking topic '${topicId}' not found`, 404);
      }
      throw new ContentApiError(`Error fetching speaking topic: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ContentApiError) {
      throw error;
    }
    throw new ContentApiError(`Network error when fetching speaking topic: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches a writing prompt by its ID
 * @param promptId The unique identifier of the writing prompt
 * @returns Promise resolving to the writing prompt data
 * @throws ContentApiError if the request fails
 */
export async function fetchWritingPrompt(promptId: string): Promise<WritingPrompt> {
  try {
    const response = await fetch(`${CONTENT_SERVICE_URL}/content/writing/prompt/${promptId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new ContentApiError(`Writing prompt '${promptId}' not found`, 404);
      }
      throw new ContentApiError(`Error fetching writing prompt: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ContentApiError) {
      throw error;
    }
    throw new ContentApiError(`Network error when fetching writing prompt: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches a list of vocabulary words
 * @returns Promise resolving to an array of vocabulary list items
 * @throws ContentApiError if the request fails
 */
export async function fetchVocabList(): Promise<VocabListItem[]> {
  try {
    const response = await fetch(`${CONTENT_SERVICE_URL}/content/vocab`);
    
    if (!response.ok) {
      throw new ContentApiError(`Error fetching vocabulary list: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ContentApiError) {
      throw error;
    }
    throw new ContentApiError(`Network error when fetching vocabulary list: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches a list of speaking topics
 * @returns Promise resolving to an array of speaking topic list items
 * @throws ContentApiError if the request fails
 */
export async function fetchSpeakingTopicList(): Promise<SpeakingTopicListItem[]> {
  try {
    const response = await fetch(`${CONTENT_SERVICE_URL}/content/speaking/topics`);
    
    if (!response.ok) {
      throw new ContentApiError(`Error fetching speaking topic list: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ContentApiError) {
      throw error;
    }
    throw new ContentApiError(`Network error when fetching speaking topic list: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches a list of writing prompts
 * @returns Promise resolving to an array of writing prompt list items
 * @throws ContentApiError if the request fails
 */
export async function fetchWritingPromptList(): Promise<WritingPromptListItem[]> {
  try {
    const response = await fetch(`${CONTENT_SERVICE_URL}/content/writing/prompts`);
    
    if (!response.ok) {
      throw new ContentApiError(`Error fetching writing prompt list: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ContentApiError) {
      throw error;
    }
    throw new ContentApiError(`Network error when fetching writing prompt list: ${(error as Error).message}`, 0);
  }
}
