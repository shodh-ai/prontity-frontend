// @/app/dash-rox/page.tsx

"use client";

import React, { useState, useRef } from "react";
import MainLayout from '@/components/layout/layout';
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MicButton } from "@/components/ui/mic";
import { RecordingBar } from "@/components/ui/record";
import RoxFooterContent from "@/components/layout/RoxFooterContent";
import { NotesButton } from "@/components/ui/NotesButton";
import { NotesPanel, Note } from "@/components/ui/NotesPanel";
import { ChatButton } from "@/components/ui/ChatButton"; // --- NEW IMPORT
import { ChatPanel } from "@/components/ui/ChatPanel";   // --- NEW IMPORT

export default function DashRoxPage(): JSX.Element {
  // State for recording and notes panel
  const [showRecordingBar, setShowRecordingBar] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  // --- NEW STATE FOR CHAT PANEL ---
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  // --- NEW HANDLER FOR CHAT PANEL ---
  const handleToggleChatPanel = () => {
    setIsChatPanelOpen(prev => !prev);
  };

  const handleToggleNotesPanel = () => {
    setIsNotesPanelOpen(prev => !prev);
  };

  // Note handling functions (onAddNote, onUpdateNote, onDeleteNote) remain unchanged
  const handleAddNote = (content: string) => { /* ... */ };
  const handleUpdateNote = (id: string, content: string) => { /* ... */ };
  const handleDeleteNote = (id: string) => { /* ... */ };

  // Recording functions (startRecording, stopRecording) remain unchanged
  const startRecording = async () => { /* ... */ };
  const stopRecording = () => { /* ... */ };

  const controlButtons = [
    { icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame-2.svg", alt: "Camera" },
    { icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame.svg", alt: "Settings" },
    { icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/mic-on.svg", type: "background", alt: "Mic" },
  ];

  return (
    <MainLayout>
      <div className="relative h-full w-full">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-2 h-6 w-6 p-0 z-20"
        >
          <XIcon className="h-6 w-6" />
        </Button>

        <div className="absolute top-0 left-0 right-0 z-10 pl-8 pr-12">
          {/* ... header content ... */}
          <div className="flex items-center justify-between pt-6 pl-9">
            <div className="flex-1">
              <h2 className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base whitespace-nowrap">
                Speaking practice session
              </h2>
            </div>
            <div className="w-full max-w-xl px-4">
              <Progress value={28} className="h-2.5 [&>div]:bg-[#566FE9]" />
            </div>
            <div className="flex-1" />
          </div>
        </div>

        <div className="h-full w-full flex items-center justify-center pt-28 pb-32 px-12">
          {/* ... main passage content ... */}
          <div className="w-full max-w-[700px]">
            <Card className="bg-transparent border-none shadow-none">
              <CardContent className="px-0">
                <h3 className="opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base mb-3">
                  Read the passage
                </h3>
                <p className="font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-base leading-relaxed">
                  {/* ... Lorem Ipsum text ... */}
                  With the rise of automation and artificial intelligence, there is a growing concern...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-4 py-5">
         {/* --- MODIFIED FOOTER CONTROLS --- */}
         <div className="w-full max-w-lg">
            <div className="flex items-center justify-between w-full">
              <div className={`flex items-center gap-4 ${!showRecordingBar ? '-ml-20' : ''}`}>
                {showRecordingBar ? (
                  <RecordingBar onStop={stopRecording} />
                ) : (
                  <>
                    {controlButtons.slice(0, 3).map((button) => {
                      if (button.alt === "Camera") {
                        return (
                          <Button
                            key={button.alt}
                            variant="outline"
                            size="icon"
                            className="w-14 h-14 p-4 bg-[#566fe91a] rounded-[36px] border-none hover:bg-[#566fe930] transition-colors"
                            onClick={startRecording}
                          >
                            <img className="w-6 h-6" alt={button.alt} src={button.icon} />
                          </Button>
                        );
                      }
                      if (button.alt === "Mic") {
                        return <MicButton key="mic-button" isVisible={true} isActive={isMicActive} />;
                      }
                      if (button.alt === "Settings") {
                        return (
                          <NotesButton
                            key="notes-button"
                            isActive={isNotesPanelOpen}
                            onClick={handleToggleNotesPanel}
                          />
                        );
                      }
                      return null;
                    })}
                  </>
                )}
              </div>
              {!showRecordingBar && (
                <div className="flex items-center gap-4 mr-10">
                  {/* The new ChatButton replaces the old "Doubt" and MessageButton functionality */}
                  <ChatButton isActive={isChatPanelOpen} onClick={handleToggleChatPanel} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- RENDER THE PANELS --- */}
        <NotesPanel
          isOpen={isNotesPanelOpen}
          onClose={() => setIsNotesPanelOpen(false)}
          notes={notes}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
        />
        <ChatPanel
          isOpen={isChatPanelOpen}
          onClose={() => setIsChatPanelOpen(false)}
        />
      </div>

      <RoxFooterContent />
    </MainLayout>
  );
}