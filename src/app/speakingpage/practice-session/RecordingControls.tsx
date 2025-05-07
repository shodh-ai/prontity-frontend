'use client';

import React, { useState } from 'react';

const RecordingControls = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Start with a small progress when recording begins
      setProgress(10);
    }
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-[#00000099]">Record your answer</h2>
      <div className="flex items-center mt-4">
        <button 
          className={`w-12 h-12 rounded-md flex items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-[#566fe9]'}`}
          onClick={toggleRecording}
        >
          <img src="/images/img_vector.svg" alt="Record" className="w-[19px] h-[19px]" />
        </button>
        
        <button className="ml-3 w-12 h-12 rounded-md border border-[#566fe9] flex items-center justify-center">
          <img src="/images/img_vector_18x19.svg" alt="Stop" className="w-[18px] h-[19px]" />
        </button>
        
        <div className="ml-3 relative w-[492px] h-[15px]">
          <img src="/images/img_group_1000011010.svg" alt="Progress bar" className="w-full h-full" />
          <div 
            className="absolute top-0 left-0 h-full bg-[#566fe9] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default RecordingControls;