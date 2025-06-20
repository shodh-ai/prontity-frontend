"use client";

import React, { useState, useRef } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
// --- MODIFICATION: Added more Card components for the new Chat Card ---
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MicButton } from "@/components/ui/mic";
import { RecordingBar } from "@/components/ui/record";
import { NotesButton } from "@/components/ui/NotesButton";
import { NotesPanel, Note } from "@/components/ui/NotesPanel";
import { MessageButton } from "@/components/ui/message-button";
import { ChatButton } from "@/components/ui/ChatButton";
// --- MODIFICATION: Added Input for the new Chat Card ---
import { Input } from "@/components/ui/input";

// --- MODIFICATION: The ChatPanel component is no longer needed as an import
// import { ChatPanel } from "@/components/ui/ChatPanel";

export default function DashRoxPage(): JSX.Element {
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [showRecordingBar, setShowRecordingBar] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  
  // --- MODIFICATION: This state now controls the inline chat card visibility ---
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  const handleToggleChatPanel = () => {
    setIsChatPanelOpen(prev => !prev);
  };

  const handleToggleNotesPanel = () => {
    setIsNotesPanelOpen(prev => !prev);
  };

  const handleAddNote = (content: string) => { /* ... */ };
  const handleUpdateNote = (id: string, content: string) => { /* ... */ };
  const handleDeleteNote = (id: string) => { /* ... */ };
  const startRecording = async () => { /* ... */ };
  const stopRecording = () => { /* ... */ };

  const controlButtons = [
    { icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame-2.svg", alt: "Camera" },
    // --- MODIFICATION: Changed alt text for clarity ---
    { icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame.svg", alt: "Chat" },
    { icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/mic-on.svg", type: "background", alt: "Mic" },
  ];

  return (
    <>
      {/* FIX: Use h-screen and overflow-hidden to prevent page scrolling */}
      <div className="relative h-screen w-full overflow-hidden">
        <Button variant="ghost" size="icon" className="absolute top-1 right-2 h-6 w-6 p-0 z-20">
          <XIcon className="h-6 w-6" />
        </Button>
        <div className="absolute top-0 left-0 right-0 z-10 pl-8 pr-12">
          <div className="flex items-center justify-between pt-6 pl-9">
            <div className="flex-1"><h2 className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base whitespace-nowrap">Writing Scaffolding</h2></div>
            <div className="w-full max-w-xl px-4"><Progress value={28} className="h-2.5 [&>div]:bg-[#566FE9]" /></div>
            <div className="flex-1" />
          </div>
        </div>
        
        {/* FIX: Removed items-start to allow content to stretch vertically */}
        <div className="h-full w-full flex justify-center pt-28 pb-32 px-12 gap-8">
          
          {/* --- MODIFICATION: Passage card now has dynamic width --- */}
          <div className={`transition-all duration-300 ease-in-out ${isChatPanelOpen ? 'w-[60%]' : 'w-full max-w-[700px]'}`}>
            {/* FIX: Card now fills available height and its content can scroll */}
            <Card className="h-full flex flex-col bg-transparent border-none shadow-none">
              <CardContent className="px-0 overflow-y-auto">
                <h3 className="opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base mb-3">Read the passage</h3>
                <p className="font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-base leading-relaxed">
                  With the rise of automation and artificial intelligence, the future of work is a topic of much debate. Many fear widespread job displacement as machines become capable of performing tasks once done by humans. However, others see this technological shift as an opportunity for humanity to focus on more creative and strategic endeavors. The transition will undoubtedly require significant societal adjustments, including a greater emphasis on lifelong learning and the development of new skills.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* --- MODIFICATION: Chat Card is now rendered here conditionally --- */}
          {isChatPanelOpen && (
            <div className="w-[30%]">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between">
                  
                  <Button variant="ghost" size="icon" onClick={() => setIsChatPanelOpen(false)}>
                    <XIcon className="h-4 w-4" />
                  </Button>
                </CardHeader>
                {/* FIX: Card content is now scrollable if messages overflow */}
                <CardContent className="flex-grow overflow-y-auto">
                  {/* Placeholder for chat messages */}
                  <div className="space-y-4 text-sm">
                    <div className="p-3 rounded-lg bg-gray-100 max-w-xs">
                      Hello! How can I help you practice today?
                    </div>
                    <div className="p-3 rounded-lg bg-blue-100 max-w-xs ml-auto">
                      What does "widespread" mean?
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="flex w-full items-center space-x-2">
                    <Input id="chat-message" placeholder="Ask Rox a question..." />
                    <Button type="submit">Send</Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>

        {/* Footer remains the same */}
        <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-4 py-5">
         <div className="w-full max-w-lg">
            {!isPopupVisible ? (
              <div className="flex items-center justify-between w-full">
                <div className={`flex items-center gap-4 ${!showRecordingBar ? '-ml-20' : ''}`}>
                  {showRecordingBar ? (
                    <RecordingBar onStop={stopRecording} />
                  ) : (
                    <>
                      {controlButtons.map((button) => {
                        if (button.alt === "Camera") {
                          return ( <Button key={button.alt} variant="outline" size="icon" className="w-14 h-14 p-4 bg-[#566fe91a] rounded-[36px] border-none hover:bg-[#566fe930] transition-colors" onClick={startRecording}> <img className="w-6 h-6" alt={button.alt} src={button.icon} /> </Button> );
                        }
                        if (button.alt === "Mic") {
                          return <MicButton key="mic-button" isVisible={true} isActive={isMicActive} />;
                        }
                        // --- MODIFICATION: Button logic points to the new Chat button handler ---
                        if (button.alt === "Chat") {
                          return ( <ChatButton key="chat-button" isActive={isChatPanelOpen} onClick={handleToggleChatPanel} /> );
                        }
                        return null;
                      })}
                    </>
                  )}
                </div>
                {!showRecordingBar && (
                  <div className="flex items-center gap-4 mr-10">
                    <NotesButton
                      isActive={isNotesPanelOpen}
                      onClick={handleToggleNotesPanel}
                    />
                    <MessageButton
                      isVisible={true}
                      onClick={() => setIsPopupVisible(true)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full p-2 rounded-full bg-white/80 backdrop-blur-lg shadow-md border border-gray-200/80">
                <input
                  type="text"
                  placeholder="Ask Rox anything..."
                  className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 px-4 text-black text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  className="flex-shrink-0 bg-[#566fe9] hover:bg-[#4a5fcf] rounded-full w-9 h-9"
                  onClick={() => {
                    console.log("Message Sent!");
                    setIsPopupVisible(false);
                  }}
                >
                  <img className="w-5 h-5" alt="Send" src="/send.svg" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* The Notes panel remains a slide-out overlay */}
        <NotesPanel
          isOpen={isNotesPanelOpen}
          onClose={() => setIsNotesPanelOpen(false)}
          notes={notes}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
        />
        {/* --- MODIFICATION: The old ChatPanel component call is removed from here --- */}
      </div>
    </>
  );
}