'use client';

import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  height?: number;
  className?: string;
  backgroundColor?: string;
  progressColor?: string;
  rounded?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = 10,
  className = '',
  backgroundColor = '#c7ccf833',
  progressColor = '#566fe9e5',
  rounded = true,
}) => {
  const percentage = (value / max) * 100;
  
  return (
    <div 
      className={`w-full ${rounded ? 'rounded-md' : ''} ${className}`}
      style={{ 
        height: `${height}px`,
        backgroundColor
      }}
    >
      <div 
        className={`h-full transition-all duration-300 ${rounded ? 'rounded-md' : ''}`}
        style={{ 
          width: `${percentage}%`,
          backgroundColor: progressColor
        }}
      ></div>
    </div>
  );
};

export default ProgressBar;