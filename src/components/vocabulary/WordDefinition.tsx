'use client';

import React from 'react';

interface WordDefinitionProps {
  word: string;
  definition: string;
  partOfSpeech?: string;
  example?: string;
}

const WordDefinition: React.FC<WordDefinitionProps> = ({
  word,
  definition,
  partOfSpeech,
  example
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-bold text-[#566FE9]">{word}</h2>
        {partOfSpeech && (
          <span className="text-sm text-gray-500 italic">{partOfSpeech}</span>
        )}
      </div>
      <p className="mt-2 text-gray-700">{definition}</p>
      {example && (
        <div className="mt-2">
          <p className="text-sm italic text-gray-600">"{example}"</p>
        </div>
      )}
    </div>
  );
};

export default WordDefinition;
