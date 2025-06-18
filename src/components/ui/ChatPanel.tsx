// @/components/ui/ChatPanel.tsx

"use client";

import React from 'react';
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// A reusable component for individual chat messages to match the image style
const ChatBubble = ({ message, sender }: { message: string; sender: 'user' | 'ai' }) => {
  if (sender === 'ai') {
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 self-start w-full shadow-sm">
        <p className="text-sm text-gray-800 leading-relaxed">{message}</p>
      </div>
    );
  }
  // For 'user' messages
  return (
    <div className="bg-purple-100 p-4 rounded-lg self-end max-w-md">
      <p className="text-sm text-gray-800 leading-relaxed">{message}</p>
    </div>
  );
};

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  // Mock data to replicate the UI in the image
  const chatHistory = [
    { sender: 'ai', message: "Sure! Root locus shows how the poles of a system move in the complex plane as the gain changes. If the poles move into the right half of the s-plane, the system becomes unstable. By analyzing the root locus, you can adjust the gain to keep the poles in the left half, ensuring stability." },
    { sender: 'user', message: "Oh, I see! So, the location of the poles directly affects stability. How do I figure out where the root locus will be on the real axis?" },
    { sender: 'ai', message: "Great question! On the real axis, the root locus exists between an odd number of poles and zeros. Count the total number of poles and zeros to the right of any point on the real axis. If it's odd, that section is part of the root locus." }
  ];

  return (
    // This container provides the blurred, semi-transparent backdrop
    <div
      className={`fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        // This is the actual panel content that slides in
        className={`fixed top-0 right-0 h-full bg-[#f9f9ff] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'clamp(320px, 30vw, 450px)' }} // Responsive 30% width
        onClick={(e) => e.stopPropagation()} // Prevents closing when clicking inside the panel
      >
        <header className="flex items-center justify-between p-4 border-b bg-white">
          <h2 id="chat-panel-title" className="text-lg font-semibold text-gray-800">
            Speaking Scaffolding
          </h2>
          {/* <Button onClick={onClose} variant="ghost" size="icon" aria-label="Close chat panel">
            <XIcon className="h-5 w-5" />
          </Button> */}
        </header>

        <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-4">
          {chatHistory.map((chat, index) => (
            <ChatBubble key={index} sender={chat.sender as 'user' | 'ai'} message={chat.message} />
          ))}
        </div>

        <footer className="p-4 bg-white border-t">
          <div className="relative">
            <input
              type="text"
              placeholder="Can you tell me about my course summary till now?"
              className="w-full pl-4 pr-12 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#566FE9] hover:bg-[#4a5fcf] rounded-full w-9 h-9"
            >
              <img className="w-5 h-5" alt="Send" src="/send.svg" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};