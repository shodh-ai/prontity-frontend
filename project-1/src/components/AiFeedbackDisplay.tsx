import React from 'react';

// Define a type for AI feedback messages
export interface AiFeedbackMessage {
  id: string;
  text: string;
  timestamp: Date;
  source: 'AI' | 'System' | string; // Allow other sources
}

interface AiFeedbackDisplayProps {
  messages: AiFeedbackMessage[];
  title?: string;
}

const AiFeedbackDisplay: React.FC<AiFeedbackDisplayProps> = ({ messages, title = "AI Feedback & Comments" }) => {
  return (
    <div className="flex-grow bg-white p-4 rounded-lg shadow overflow-y-auto mt-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
        {/* Optional: Add a button or other controls here if needed */}
      </div>
      {messages.length === 0 ? (
        <p className="text-gray-500 italic">No feedback received yet. Waiting for AI...</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((msg) => (
            <li key={msg.id} className="p-3 bg-blue-50 rounded-md border border-blue-200 shadow-sm">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.text}</p>
              <p className="text-xs text-gray-400 mt-1 text-right">
                {msg.source} - {msg.timestamp.toLocaleTimeString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AiFeedbackDisplay;
