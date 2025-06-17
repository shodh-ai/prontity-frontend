// src/components/RoxFooterContent.tsx
import React from 'react';

const RoxFooterContent = () => {
  return (
    // The wrapping div helps group the two elements for easier layout management.
    <div className="flex flex-col items-center">
      <div className="relative top-5 z-30 inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-[#566fe91a] rounded-[50px] backdrop-blur-sm">
        <p className="font-paragraph-extra-large font-[number:var(--paragraph-extra-large-font-weight)] text-black text-[length:var(--paragraph-extra-large-font-size)] text-center tracking-[var(--paragraph-extra-large-letter-spacing)] leading-[var(--paragraph-extra-large-line-height)]">
          Hello. I am Rox, your AI Assistant!
        </p>
      </div>
      <div className="w-[90px] h-[90px] z-20">
        <div className="relative w-full h-full">
          <div className="absolute w-[70%] h-[70%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#566fe9] rounded-full blur-[50px]" />
          <img
            className="absolute w-full h-full top-7 left-2 object-contain"
            alt="Rox AI Assistant"
            src="/screenshot-2025-06-09-at-2-47-05-pm-2.png"
          />
        </div>
      </div>
    </div>
  );
};

export default RoxFooterContent;