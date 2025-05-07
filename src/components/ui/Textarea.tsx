'use client';

import React, { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  className?: string;
  containerClassName?: string;
  highlightedSections?: Array<{
    top: number;
    left: number;
    width: number;
    height: number;
  }>;
}

const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  className = '',
  containerClassName = '',
  highlightedSections = [],
  ...props
}) => {
  return (
    <div className={`relative ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <textarea
          className={`w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#566fe9] focus:border-transparent ${error ? 'border-red-500' : ''} ${className}`}
          {...props}
        />
        
        {/* Highlighted sections */}
        {highlightedSections.map((section, index) => (
          <div
            key={index}
            className="absolute bg-[#ef0e2719] rounded"
            style={{
              top: `${section.top}px`,
              left: `${section.left}px`,
              width: `${section.width}px`,
              height: `${section.height}px`,
            }}
          />
        ))}
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Textarea;