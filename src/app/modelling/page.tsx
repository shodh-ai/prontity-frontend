// src/pages/your-page.tsx (or appropriate file path)

"use client";
import React, { useState } from "react";
import { XIcon, ScreenShare } from "lucide-react";

import { MessageButton } from "@/components/ui/message-button";
import { MicButton } from "@/components/ui/mic";
import { PreviousButton } from "@/components/ui/previous-button";
import { NextButton } from "@/components/ui/next-button";
import { PlayPauseButton } from "@/components/ui/playpause-button";

// NEW: 1. Import the NotesButton, NotesPanel, and the Note type.
import { NotesButton } from "@/components/ui/NotesButton";
import { NotesPanel, Note } from "@/components/ui/NotesPanel";
import MainLayout, { renderRoxAssistantFooter } from '@/components/layout/MainLayout';


// NEW: 2. Add mock data for the notes panel. You can fetch this from an API later.
const mockNotesData: Note[] = [
  {
    id: 1,
    task: "Describe a memorable event from your life",
    explanation:
      "“I began with a short personal hook—‘One event I’ll never forget...’—to immediately grab attention and set a casual tone. Using the past tense consistently here helps maintain grammatical accuracy.”",
  },
  {
    id: 2,
    task: "Share a lesson learned from a mistake",
    explanation:
      "“I started off with a relatable statement, ‘We all make mistakes, but here’s what I learned...’ This approach encourages empathy and fosters a connection with the audience.”",
  },
  {
    id: 3,
    task: "Explain a life lesson learned through adversity",
    explanation:
      "“I opened with a powerful statement—‘Struggles often shape us in ways we least expect...’—to create intrigue and engage the reader emotionally from the start.”",
  },
];


export default function Page(): JSX.Element {
  // State to manage the visibility of the pop-up/chat input
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  // State to manage the play/pause status
  const [isPaused, setIsPaused] = useState(false); // Default is playing

  // NEW: 3. Add state to manage the visibility of the notes panel.
  const [isNotesPanelVisible, setIsNotesPanelVisible] = useState(false);

  // Handler functions for play/pause
  const handlePlay = () => {
    console.log("Resuming explanation...");
    setIsPaused(false);
  };

  const handlePause = () => {
    console.log("Pausing explanation...");
    setIsPaused(true);
  };
  
  // NEW: 4. Add a handler to toggle the notes panel.
  const handleToggleNotesPanel = () => {
    setIsNotesPanelVisible(prev => !prev);
  };


  return (
    <MainLayout>
      {/* Main Content Area */}
      {/* MODIFIED: Constrained the main element to fit within the union graphic */}
      <main className="relative z-10 h-full flex flex-col w-full max-w-[1336px] mx-auto pt-16 px-12 pb-6">
        {/* Placeholder for header/main content */}
        <div className={`flex-grow flex ${isNotesPanelVisible ? 'flex-row gap-4' : ''} overflow-hidden`}>
          {/* Main content card (70% if notes panel is visible, 100% otherwise) */}
          <div
            className={`p-6 rounded-lg shadow-lg h-full overflow-y-auto bg-white 
                        ${isNotesPanelVisible ? 'flex-1' : 'w-full'}`}
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Speaking Modelling</h2>
            <p className="text-gray-700 mb-3">
              Over the last few years, education has become increasingly important for making progress in both personal and professional lives. Students are now expected to understand complex topics at a much earlier age than before, and the pressure to perform well has never been higher.
            </p>
            <p className="text-gray-700 mb-3">
              Many learners struggle with expressing their ideas fluently, especially in academic writing. It's not unusual to see phrases like "He go to the university every day" or "She don't have any time" in essays. These might seem like small mistakes, but they can significantly affect how a reader perceives the clarity and credibility of your argument.
            </p>
            <p className="text-gray-700 mb-3">
              Additionally, vocabulary development is often overlooked. Some students rely on very simple words which are not always suitable for formal contexts. Instead of saying something like 'This idea is nice," "This idea is compelling" might sound more academic and specific.
            </p>
            <p className="text-gray-700">
              Some people believe that technology is make our life more easier making our lives easier, while others argue it causes more distractions than benefits. The truth probably lies somewhere in between. For example, smartphones have enabled people to communicates quickly with communicate quickly with others, but they've also made it difficult to focus for long periods of time.
            </p>
          </div>

          {/* NotesPanel card (30% when visible) */}
          {isNotesPanelVisible && (
            <div className="w-[30%] h-full p-6 rounded-lg shadow-lg bg-white overflow-y-auto flex flex-col">
              <NotesPanel
                isVisible={true} // Controlled by parent's conditional rendering
                onClose={() => setIsNotesPanelVisible(false)}
                notes={mockNotesData}
                className="flex-grow" // NotesPanel component should fill this card container
              />
            </div>
          )}
        </div>

        {/* Footer section with conditional UI */}
        <div className="flex flex-col items-center gap-4 pb-5">
          {renderRoxAssistantFooter()}
          <div className="w-full max-w-lg">
            {!isPopupVisible ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4 -ml-40">
                  <PreviousButton
                    isVisible={true}
                    onPrevious={() => console.log("Previous button clicked")}
                  />
                  <NextButton
                    isVisible={true}
                    onNext={() => console.log("Next button clicked")}
                  />
                  <PlayPauseButton
                    isVisible={true}
                    isPaused={isPaused}
                    onPlay={handlePlay}
                    onPause={handlePause}
                  />
                  
                  {/* MODIFIED: NotesButton is now the 4th button */}
                  <NotesButton
                    isActive={isNotesPanelVisible}
                    onClick={handleToggleNotesPanel}
                  />
                  
                  <MicButton isVisible={true} />
                </div>

                <div className="flex items-center gap-4 mr-10">
                  
                  {/* MODIFIED: ScreenShare is now the 6th button */}
                  <button
                    className="flex items-center justify-center w-12 h-12 bg-white/50 rounded-full hover:bg-white/80 transition-colors"
                    aria-label="Share Screen"
                    onClick={() => console.log("Screen Share clicked")}
                  >
                    <ScreenShare className="w-6 h-6 text-gray-800" />
                  </button>

                  <MessageButton
                    isVisible={true}
                    onClick={() => setIsPopupVisible(true)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full p-2 rounded-full bg-white/80 backdrop-blur-lg shadow-md border border-gray-200/80">
                <input
                  type="text"
                  placeholder="Ask Rox anything..."
                  className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 px-4 text-black text-sm"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* NotesPanel component has been moved into the main content layout above */}
    </MainLayout>
  );
}