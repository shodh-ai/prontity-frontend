/**
 * Type definitions for content service data models.
 * These types match the structure of the responses from the content service API.
 */

/**
 * Represents a vocabulary word from the content service
 */
export interface VocabWord {
  wordId: string;
  wordText: string;
  definition: string;
  exampleSentence: string | null;
  difficultyLevel: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a speaking topic from the content service
 */
export interface SpeakingTopic {
  topicId: string;
  title: string;
  promptText: string;
  difficultyLevel: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a writing prompt from the content service
 */
export interface WritingPrompt {
  promptId: string;
  title: string;
  promptText: string;
  difficultyLevel: number | null;
  createdAt: string;
  updatedAt: string;
}
