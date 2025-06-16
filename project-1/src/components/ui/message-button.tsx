import React, { useState } from "react";

export const MessageButton = () => {
  const [showPopup, setShowPopup] = useState(false);

  const handleToggle = () => setShowPopup((prev) => !prev);

  return (
    <div className="relative flex items-center">
      {/* Popup to the left */}
      {showPopup && (
        <div className="absolute right-full mr-2 bg-white border border-gray-300 shadow-md rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-sm text-black">
            Can you tell me about my course summary and course insights till now?
          </span>
          <img src="/arrow-right.svg" alt="arrow" className="w-4 h-4" />
        </div>
      )}

      {/* Icon button */}
      <button
        onClick={handleToggle}
        className="p-3 sm:p-4 bg-[#566fe91a] hover:bg-[#566fe930] rounded-full h-auto w-auto transition-colors duration-200 backdrop-blur-sm"
      >
        <img className="w-5 h-5 sm:w-6 sm:h-6" alt="Message" src="/frame-1.svg" />
      </button>
    </div>
  );
};
