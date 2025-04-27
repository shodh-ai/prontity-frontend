'use client';

import React from 'react';

// Define the vocabulary item structure
export interface VocabularyItem {
  id: string; // Unique identifier for the vocabulary item
  word: string;
  definition: string;
  exampleSentence?: string;
  partOfSpeech?: string;
}

interface VocabBoxProps {
  vocabularyItem: VocabularyItem;
}

const VocabBox: React.FC<VocabBoxProps> = ({ vocabularyItem }) => {
  const { word, definition, exampleSentence, partOfSpeech } = vocabularyItem;
  
  return (
    <div className="vocab-box bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="vocab-header flex justify-between items-start">
        <h2 className="word-title text-2xl font-bold text-[#566FE9]">{word}</h2>
        {partOfSpeech && (
          <span className="part-of-speech text-sm text-gray-500 italic">{partOfSpeech}</span>
        )}
      </div>
      
      <div className="definition-container mt-2">
        <p className="definition text-gray-700">{definition}</p>
      </div>
      
      {exampleSentence && (
        <div className="example-container mt-3 border-l-4 border-[#566FE9] pl-3">
          <p className="example text-sm italic text-gray-600">"{exampleSentence}"</p>
        </div>
      )}
    </div>
  );
};

export default VocabBox;
