// @/components/ui/ChatButton.tsx

"use client";

import React from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";

interface ChatButtonProps {
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

export const ChatButton = ({ isActive, onClick, className }: ChatButtonProps) => {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="icon"
      className={`w-14 h-14 p-4 bg-[#566fe91a] rounded-[36px] border-none hover:bg-[#566fe930] transition-colors ${className || ''}`}
      aria-label={isActive ? "Close chat" : "Open chat"}
      aria-pressed={isActive}
    >
      {isActive ? (
        // Icon when chat is OPEN (Close 'X' icon)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-[#566FE9]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ) : (
        // Icon when chat is CLOSED (Your custom icon)
        <Image
          src="/frame-6.svg"
          alt="Open chat icon"
          width={24}
          height={24}
        />
      )}
    </Button>
  );
};