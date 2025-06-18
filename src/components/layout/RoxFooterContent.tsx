// src/components/RoxFooterContent.tsx
import React from 'react';

const RoxFooterContent = () => {
  return (
    // Added transition classes to the main container for the `bottom` property.
    <div
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center
                 bottom-[36px] md:bottom-[45px] lg:bottom-[55px]
                 transition-all duration-300 ease-in-out" // <-- SMOOTH TRANSITION
    >
      {/* Added transition classes to the text bubble for `padding`, `top`, and font `size`. */}
      <div
        className="relative z-30 inline-flex items-center justify-center gap-2.5 
                   bg-[#566fe91a] rounded-[50px] backdrop-blur-sm
                   px-4 py-2 md:px-5 md:py-2.5
                   top-4 md:top-5
                   transition-all duration-300 ease-in-out" // <-- SMOOTH TRANSITION
      >
        {/* We add the transition to the text element itself for the font-size change. */}
        <p 
          className="font-paragraph-extra-large font-[number:var(--paragraph-extra-large-font-weight)] text-black 
                     text-center tracking-[var(--paragraph-extra-large-letter-spacing)] 
                     leading-[var(--paragraph-extra-large-line-height)]
                     text-sm md:text-base lg:text-lg
                     transition-all duration-300 ease-in-out" // <-- SMOOTH TRANSITION
        >
          Hello. I am Rox, your AI Assistant!
        </p>
      </div>

      {/* Added transition classes to the image container for `width` and `height`. */}
      <div 
        className="z-20 w-[72px] h-[72px] md:w-[90px] md:h-[90px] lg:w-[110px] lg:h-[110px]
                   transition-all duration-300 ease-in-out" // <-- SMOOTH TRANSITION
      >
        <div className="relative w-full h-full">
          {/* The glow effect will transition smoothly as its parent's size changes. */}
          <div className="absolute w-[60%] h-[60%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#566fe9] rounded-full blur-[50px]" />
          <img
            className="absolute w-full h-full object-contain"
            alt="Rox AI Assistant"
            src="/screenshot-2025-06-09-at-2-47-05-pm-2.png"
          />
        </div>
      </div>
    </div>
  );
};

export default RoxFooterContent;