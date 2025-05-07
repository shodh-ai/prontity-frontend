'use client';

import React from 'react';

interface QuestionSectionProps {
  question: string;
}

const QuestionSection = ({ question }: QuestionSectionProps) => {
  return (
    <div className="mt-10">
      <h2 className="text-base font-semibold text-[#00000099]">Question</h2>
      <p className="mt-4 text-lg font-normal leading-7 text-black">
        {question}
      </p>
    </div>
  );
};

export default QuestionSection;