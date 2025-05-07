'use client';

import React, { useState, useEffect } from 'react';

interface AnswerSectionProps {
  onWordCountChange?: (count: number) => void;
}

const AnswerSection = ({ onWordCountChange }: AnswerSectionProps) => {
  const [answer, setAnswer] = useState(`In today's rapid evolving world, achieving a balance between traditional educational practices and innovative approaches is crucial for ensure effective learning outcomes. While tradition methods have provided a strong foundation for education over centuries, embrassing innovation is essential to meet the demands of the modern era. Traditional educational practices, such as lecture, textbooks, and standardized testings, offer stability and continuity in the learning process.

While tradition methods have provided a strong foundation for education over centuries, embrassing innovation is essential to meet the demands of the modern era. Traditional educational practices, such as lecture, textbooks, and standardized testings, offer stability and continuity in the learning process.`);

  // Calculate and report word count when text changes
  useEffect(() => {
    const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
    if (onWordCountChange) {
      onWordCountChange(words);
    }
  }, [answer, onWordCountChange]);

  return (
    <div 
      className="mt-4 p-4 w-full h-[280px] rounded-xl border border-transparent overflow-auto relative"
      style={{ borderImage: 'linear-gradient(166deg, #ffffff66 0%, #566fe9ff 100%) 1' }}
    >
      <div className="relative">
        <p className="text-base font-normal leading-6 text-black">
          {answer}
        </p>
        
        {/* Highlighted sections */}
        <div className="absolute top-[35px] left-[16px] w-[88px] h-[25px] bg-[#ef0e2719] rounded"></div>
        <div className="absolute top-[14px] left-[614px] w-[81px] h-[25px] bg-[#ef0e2719] rounded"></div>
        <div className="absolute top-[85px] left-[104px] w-[606px] h-[25px] bg-[#ef0e2719] rounded"></div>
        <div className="absolute top-[179px] left-[428px] w-[280px] h-[25px] bg-[#ef0e2719] rounded"></div>
        <div className="absolute top-[204px] left-[16px] w-[305px] h-[25px] bg-[#ef0e2719] rounded"></div>
        
        {/* Progress indicator */}
        <div className="absolute top-[20px] right-[0] w-[224px] h-[6px] bg-[#566fe919] rounded-md">
          <div className="absolute top-[1px] left-[123px] w-[100px] h-[4px] bg-[#566fe9] rounded-sm"></div>
        </div>
      </div>
    </div>
  );
};

export default AnswerSection;