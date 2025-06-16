import React, { KeyboardEventHandler } from 'react';

interface AgentTextInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

const AgentTextInput: React.FC<AgentTextInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Type your message...",
  className = "",
  rows = 1,
}) => {
  const handleKeyPress: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    // Submit on Enter, but allow Shift+Enter for new line
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent new line
      onSubmit();
    }
  };

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyPress={handleKeyPress}
      placeholder={placeholder}
      rows={rows}
      className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none ${className}`}
    />
  );
};

export default AgentTextInput;
