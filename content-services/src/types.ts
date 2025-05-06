// src/types.ts

export interface VocabWord {
    wordId: string;
    wordText: string;
    definition: string;
    exampleSentence: string | null;
    difficultyLevel: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface SpeakingTopic {
    topicId: string;
    title: string;
    promptText: string;
    difficultyLevel: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface WritingPrompt {
    promptId: string;
    title: string;
    promptText: string;
    difficultyLevel: number | null;
    createdAt: Date;
    updatedAt: Date;
}
