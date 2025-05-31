import React from 'react';

interface ChatBubbleProps {
  content: string;
  // Add any other props you might need, e.g., for positioning or styling
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ content }) => {
  return (
    <div
      className="absolute z-10 p-2 text-xs text-white bg-slate-700 rounded-md shadow-lg whitespace-nowrap transform -translate-y-full -translate-x-1/2 left-1/2 -mt-1"
      style={{ minWidth: '50px', textAlign: 'center' }} // Ensure some minimum width and center text
    >
      {content}
      {/* Small triangle/tail for the bubble */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-t-4 border-t-slate-700 border-l-4 border-l-transparent border-r-4 border-r-transparent" />
    </div>
  );
};

export default ChatBubble;
