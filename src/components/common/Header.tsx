'use client';

import React from 'react';

interface HeaderProps {
  title: string;
  onClose?: () => void;
  showProgress?: boolean;
  progressValue?: number;
}

const Header: React.FC<HeaderProps> = ({
  title,
  onClose,
  showProgress = false,
  progressValue = 0
}) => {
  return (
    <div className="flex justify-between items-center p-4 relative">
      <h1 className="text-base font-semibold text-black">{title}</h1>
      
      {showProgress && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-[610px] h-2.5 bg-[#c7ccf833] rounded-md">
          <div 
            className="h-2.5 bg-[#566fe9e5] rounded-md transition-all duration-300"
            style={{ width: `${progressValue}px` }}
          ></div>
        </div>
      )}
      
      {onClose && (
        <button className="w-6 h-6" onClick={onClose}>
          <img src="/images/img_close.svg" alt="Close" className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Header;