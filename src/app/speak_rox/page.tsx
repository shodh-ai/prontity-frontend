"use client";
import React, { useState, useRef } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MessageButton } from "@/components/ui/message-button";
import { MicButton } from "@/components/ui/mic";
import InlineTimerButton from "@/components/ui/InlineTimerButton";
import { RecordingBar } from "@/components/ui/record";

export default function Page(): JSX.Element {
  // State to manage the visibility of the pop-up/chat input
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [showRecordingBar, setShowRecordingBar] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Data for control buttons
  const startRecording = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicActive(true);
        setShowRecordingBar(true);

        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          console.log('Recording finished:', audioUrl);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
      } catch (err) {
        console.error("Error accessing microphone:", err);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsMicActive(false);
    setShowRecordingBar(false);
  };

  const controlButtons = [
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame-2.svg",
      alt: "Camera",
    },
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame.svg",
      alt: "Settings",
    },
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/mic-on.svg",
      type: "background",
      alt: "Mic",
    },
    {
      icon: "https://c.animaapp.com/mbsxrl26lLrLIJ/img/frame-1.svg",
      alt: "Message", // This button triggers the chat input
    },
  ];

  return (
    <div className="w-full h-screen bg-white overflow-hidden relative">
      {/* Background elements */}
      <div className="absolute w-[40vw] h-[40vw] max-w-[753px] max-h-[753px] top-[-20vh] right-[-30vw] bg-[#566fe9] rounded-full" />
      <div className="absolute w-[25vw] h-[25vw] max-w-[353px] max-h-[353px] bottom-[-25vh] left-[-10vw] bg-[#336de6] rounded-full" />
      {/* Main content container with backdrop blur and union graphic */}
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]">
        <img
          className="absolute w-full max-w-[1336px] h-auto top-6 left-1/2 -translate-x-1/2 opacity-50"
          alt="Union"
          src="https://c.animaapp.com/mbsxrl26lLrLIJ/img/union.svg"
        />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 h-full flex flex-col pl-8 pr-12 py-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-2 h-6 w-6 p-0 z-20"
        >
          <XIcon className="h-6 w-6" />
        </Button>

        <div className="flex items-center justify-between pt-6 pl-9">
          {/* Left Column: Title. Balances the right column. */}
          <div className="flex-1">
            <h2 className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base whitespace-nowrap">
              Speaking practice session
            </h2>
          </div>

          {/* Center Column: Contains the progress bar. */}
          <div className="w-full max-w-xl px-4">
            <Progress value={28} className="h-2.5 [&>div]:bg-[#566FE9]" />
          </div>

          {/* Right Column: This is now an empty spacer to balance the left column. */}
          <div className="flex-1" />
        </div>

        {/* Passage Card */}
        <div className="flex-grow flex items-center justify-center py-8 gap-4">
          {/* Added mb-16 to shift the card up from the vertical center */}
          <div className="w-full max-w-[700px] mb-24">
            <Card className="bg-transparent border-none shadow-none">
              <CardContent className="px-0">
                <h3 className="opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base mb-3">
                  Read the passage
                </h3>
                <p className="font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-base leading-16">
                  With the rise of automation and artificial intelligence, there
                  is a growing concern about the future of jobs and the
                  relevance of traditional education. What measures do you think
                  should be taken to ensure that education remains effective in
                  preparing individuals for the workforce.
                  <br />
                  <br />
                  Contrary to popular belief, Lorem Ipsum is not simply random
                  text. It has roots in a piece of classical Latin literature
                  from 45 BC, making it over 2000 years old. Richard
                  McClintock, a Latin professor at Hampden-Sydney College in
                  Virginia, looked up one of the more obscure Latin words,
                  consectetur, from a Lorem Ipsum passage, and going through the
                  cites of the word in classical literature, discovered the
                  undoubtable source.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer section with conditional UI */}
        <div className="flex flex-col items-center gap-4 pb-5">
          {/* MOVED THIS BUBBLE DOWN to reduce the gap with the avatar below */}
          <div className="relative top-5 z-30 inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-[#566fe91a] rounded-[50px] backdrop-blur-sm">
            <p className="font-paragraph-extra-large font-[number:var(--paragraph-extra-large-font-weight)] text-black text-[length:var(--paragraph-extra-large-font-size)] text-center tracking-[var(--paragraph-extra-large-letter-spacing)] leading-[var(--paragraph-extra-large-line-height)]">
              Hello. I am Rox, your AI Assistant!
            </p>
          </div>
          <div className="w-[90px] h-[90px] z-20">
            <div className="relative w-full h-full">
              <div className="absolute w-[70%] h-[70%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#566fe9] rounded-full blur-[50px]" />
              <img
                className="absolute w-full h-full top-7 left-2 object-contain"
                alt="Rox AI Assistant"
                src="/screenshot-2025-06-09-at-2-47-05-pm-2.png"
              />
            </div>
          </div>
          <div className="w-full max-w-lg">
            {!isPopupVisible ? (
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
                              <img
                                className="w-6 h-6"
                                alt={button.alt}
                                src={button.icon}
                              />
                            </Button>
                          );
                        }
                        if (button.alt === "Mic") {
                          return (
                            <MicButton
                              key="mic-button"
                              isVisible={true}
                              isActive={isMicActive}
                            />
                          );
                        }
                        if (button.alt === "Settings") {
                          return <InlineTimerButton key="inline-timer-button" />;
                        }
                        return null;
                      })}
                    </>
                  )}
                </div>
                {!showRecordingBar && (
                  <MessageButton
                    isVisible={true}
                    className="mr-10"
                    onClick={() => setIsPopupVisible(true)}
                  />
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
      </main>
    </div>
  );
}