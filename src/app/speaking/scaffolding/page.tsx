"use client";
import React, { useState, useRef, useCallback } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MessageButton } from "@/components/ui/message-button";
import { MicButton } from "@/components/ui/mic";
import { RpcInvocationData } from "livekit-client";
import {
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
} from "@/generated/protos/interaction";
import LiveKitSession, {
  LiveKitRpcAdapter,
} from "@/components/LiveKitSession";
import InlineTimerButton from "@/components/ui/InlineTimerButton";
import { RecordingBar } from "@/components/ui/record";

// Helper function for Base64 encoding
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export default function Page(): JSX.Element {
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);
  const handlePerformUIAction = useCallback(
    async (rpcInvocationData: RpcInvocationData): Promise<string> => {
      const payloadString = rpcInvocationData.payload as string | undefined;
      let requestId = rpcInvocationData.requestId || "";
      console.log("[SpeakRoxPage] B2F RPC received. Request ID:", requestId);

      try {
        if (!payloadString) throw new Error("No payload received.");

        const request = AgentToClientUIActionRequest.fromJSON(
          JSON.parse(payloadString)
        );
        let success = true;
        let message = "Action processed successfully.";

        console.log(
          `[SpeakRoxPage] Received action: ${request.actionType}`,
          request
        );
        // This page doesn't have complex UI elements like an editor,
        // so we'll just log the action for now.

        const response = ClientUIActionResponse.create({
          requestId,
          success,
          message,
        });
        return uint8ArrayToBase64(
          ClientUIActionResponse.encode(response).finish()
        );
      } catch (innerError) {
        console.error(
          "[SpeakRoxPage] Error handling Agent PerformUIAction:",
          innerError
        );
        const errMessage =
          innerError instanceof Error ? innerError.message : String(innerError);
        const errResponse = ClientUIActionResponse.create({
          requestId,
          success: false,
          message: `Client error processing UI action: ${errMessage}`,
        });
        return uint8ArrayToBase64(
          ClientUIActionResponse.encode(errResponse).finish()
        );
      }
    },
    []
  );

  // State to manage the visibility of the pop-up/chat input and recording
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [showRecordingBar, setShowRecordingBar] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setIsMicActive(true);
        setShowRecordingBar(true);
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          const audioUrl = URL.createObjectURL(audioBlob);
          console.log("Recording finished:", audioUrl);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorderRef.current.start();
      } catch (err) {
        console.error("Error accessing microphone:", err);
      }
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsMicActive(false);
    setShowRecordingBar(false);
  };

  // Data for control buttons
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
    // The `bg-transparent` class here makes the component's background transparent.
    <div className="w-full h-screen bg-transparent overflow-hidden relative">
      <div style={{ display: "none" }}>
        <LiveKitSession
          roomName="speak-rox-room"
          userName="speak-rox-user"
          onConnected={(connectedRoom, rpcAdapter) => {
            console.log(
              "LiveKit connected in SpeakRoxPage, room:",
              connectedRoom
            );
            liveKitRpcAdapterRef.current = rpcAdapter;
            console.log(
              "LiveKitRpcAdapter assigned in SpeakRoxPage:",
              liveKitRpcAdapterRef.current
            );
          }}
          onPerformUIAction={handlePerformUIAction}
        />
      </div>

      {/* Main Content Area - Added pb-32 for padding at the bottom to avoid being obscured by the fixed footer */}
      <main className="relative z-10 h-full flex flex-col pl-8 pr-12 py-6 pb-32 overflow-y-auto">
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
      </main>

      {/* Fixed Footer with controls */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-4 p-5">
        <div className="w-full max-w-lg">
          {!isPopupVisible ? (
            <div className="flex items-center justify-between w-full">
              <div
                className={`flex items-center gap-4 ${
                  !showRecordingBar ? "-ml-20" : ""
                }`}
              >
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
      </footer>
    </div>
  );
}