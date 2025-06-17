// src/pages/your-page.tsx (or appropriate file path)

"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { XIcon, ScreenShare } from "lucide-react";
import TiptapEditor, { TiptapEditorHandle } from '../../components/TiptapEditor/TiptapEditor';
import { StarterKit } from '@tiptap/starter-kit';
import { HighlightExtension } from '@/components/TiptapEditor/HighlightExtension';
import { Highlight } from '@/components/TiptapEditor/highlightInterface';
import { Room, RoomEvent, RpcInvocationData } from 'livekit-client';
import { getTokenEndpointUrl } from '@/config/services';
import {
  AgentToClientUIActionRequest,
  ClientUIActionResponse,
  ClientUIActionType,
  HighlightRangeProto,
} from '@/generated/protos/interaction';
import {
  FrontendButtonClickRequest, // Existing F2B
  AgentResponse, // Existing F2B
  // Add these for B2F
  NotifyPageLoadRequest,
} from "@/generated/protos/interaction";

import { MessageButton } from "@/components/ui/message-button";
import { MicButton } from "@/components/ui/mic";
import { PreviousButton } from "@/components/ui/previous-button";
import { NextButton } from "@/components/ui/next-button";
import { PlayPauseButton } from "@/components/ui/playpause-button";
import { NotesButton } from "@/components/ui/NotesButton";
import { NotesPanel, Note } from "@/components/ui/NotesPanel";
import LiveKitSession from '@/components/LiveKitSession';
import { Button } from "@/components/ui/button";
import { LiveKitRpcAdapter } from '@/components/LiveKitSession';

// Helper functions for Base64
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

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

export default function ModellingCopyPage() {
  const liveKitRpcAdapterRef = useRef<LiveKitRpcAdapter | null>(null);
  const pageLoadNotifiedRef = useRef(false); // Flag to ensure NotifyPageLoad is sent only once
  const [rpcCallStatus, setRpcCallStatus] = useState<string>("");
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isNotesPanelVisible, setIsNotesPanelVisible] = useState(false);

  const [highlightData, setHighlightData] = useState<Highlight[]>([]);
  const tiptapEditorRef = useRef<TiptapEditorHandle>(null);

  const tiptapExtensions = [
    StarterKit,
    HighlightExtension
  ];

  const handlePerformUIAction = useCallback(async (rpcInvocationData: RpcInvocationData): Promise<string> => {
    const payloadString = rpcInvocationData.payload as string | undefined;
    let requestId = rpcInvocationData.requestId || "";
    console.log("[ModellingCopyPage] B2F RPC received. Request ID:", requestId);

    try {
      if (!payloadString) throw new Error("No payload received.");

      const request = AgentToClientUIActionRequest.fromJSON(JSON.parse(payloadString));
      let success = true;
      let message = "Action processed successfully.";

      switch (request.actionType) {
        case ClientUIActionType.HIGHLIGHT_TEXT_RANGES:
          if (request.highlightRangesPayload) {
            // The payload is an array of ranges. We'll add them to our existing highlights.
            const newHighlights: Highlight[] = request.highlightRangesPayload.map((range: any) => ({
              start: range.from,
              end: range.to,
              id: range.id,
              type: 'highlight'
            }));
            console.log("Adding new highlights:", newHighlights);
            setHighlightData(prevHighlights => {
                const existingIds = new Set(prevHighlights.map(h => h.id));
                const uniqueNewHighlights = newHighlights.filter(h => !existingIds.has(h.id));
                if (uniqueNewHighlights.length < newHighlights.length) {
                    console.warn("Filtered out duplicate highlight IDs.");
                }
                return [...prevHighlights, ...uniqueNewHighlights];
            });
          } else {
            success = false;
            message = "Error: Missing highlightRangesPayload for HIGHLIGHT_TEXT_RANGES.";
          }
          break;

        case ClientUIActionType.APPEND_TEXT_TO_EDITOR_REALTIME:
          if (request.appendTextToEditorRealtimePayload?.textChunk && tiptapEditorRef.current?.editor) {
            const editor = tiptapEditorRef.current.editor;
            const textToAppend = request.appendTextToEditorRealtimePayload.textChunk;
            // Append the text at the end of the document, adding a space for separation.
            editor.chain().focus().insertContentAt(editor.state.doc.content.size, textToAppend + ' ').run();
            console.log("Appended text to editor:", textToAppend);
          } else {
            success = false;
            const errorMessage = "Error: Missing payload or editor instance for APPEND_TEXT_TO_EDITOR_REALTIME.";
            message = errorMessage;
            console.error(errorMessage);
          }
          break;
        default:
          success = false;
          message = `Error: Unknown action_type '${request.actionType}'.`;
          console.warn(`Unknown agent UI action: ${request.actionType}`);
      }

      const response = ClientUIActionResponse.create({ requestId, success, message });
      return uint8ArrayToBase64(ClientUIActionResponse.encode(response).finish());
    } catch (innerError) {
      console.error('Error handling Agent PerformUIAction:', innerError);
      const errMessage = innerError instanceof Error ? innerError.message : String(innerError);
      const errResponse = ClientUIActionResponse.create({
        requestId,
        success: false,
        message: `Client error processing UI action: ${errMessage}`
      });
      return uint8ArrayToBase64(ClientUIActionResponse.encode(errResponse).finish());
    }
  }, []);


  const handlePlay = () => {
    console.log("Resuming explanation...");
    setIsPaused(false);
  };

  const handlePause = () => {
    console.log("Pausing explanation...");
    setIsPaused(true);
  };
  
  const handleToggleNotesPanel = () => {
    setIsNotesPanelVisible(prev => !prev);
  };
  const handleTestRpcCall = useCallback(async () => {
    if (!liveKitRpcAdapterRef.current) {
      setRpcCallStatus("RPC Adapter not ready.");
      console.error("[ModellingCopyPage] RPC Adapter not available for Test RPC call.");
      return;
    }

    setRpcCallStatus("Sending 'Trigger Highlight' RPC call...");
    console.log("[ModellingCopyPage] Attempting to send 'Trigger Highlight' RPC call.");

    try {
      const requestMessage = FrontendButtonClickRequest.create({
        buttonId: "trigger_highlight_test", // Specific ID for backend to recognize
        // Optionally, include a payload if your backend needs more context
        // customData: JSON.stringify({ detail: "requesting highlight for specific text" })
      });
      console.log("[ModellingCopyPage] FrontendButtonClickRequest (for highlight) created:", requestMessage);

      const serializedRequest = FrontendButtonClickRequest.encode(requestMessage).finish();

      // Ensure 'rox.interaction.AgentInteraction' and 'HandleFrontendButton' match your LiveKitSession setup
      // and the backend agent's RPC registration.
      const serializedResponse = await liveKitRpcAdapterRef.current.request(
        "rox.interaction.AgentInteraction", // Fully qualified service name from proto package and service
        "HandleFrontendButton",             // The RPC method name on the backend agent
        serializedRequest
      );

      if (!serializedResponse) {
        throw new Error("No response (null/undefined) received from RPC call.");
      }
      
      const agentResponse = AgentResponse.decode(serializedResponse);
      console.log("[ModellingCopyPage] AgentResponse received for 'Trigger Highlight':", agentResponse);

      setRpcCallStatus(
        `'Trigger Highlight' RPC successful: ${agentResponse.statusMessage || "Backend acknowledged."}. Data: ${agentResponse.dataPayload || "No data"}`
      );
    } catch (error: any) {
      console.error("[ModellingCopyPage] Error during 'Trigger Highlight' RPC call:", error);
      setRpcCallStatus(
        `'Trigger Highlight' RPC failed: ${error.message || "Unknown error"}`
      );
    }
  }, [liveKitRpcAdapterRef]);
  return (
    <div className="w-full h-screen bg-white overflow-hidden relative">
      <div className="absolute w-[40vw] h-[40vw] max-w-[753px] max-h-[753px] top-[-20vh] right-[-30vw] bg-[#566fe9] rounded-full" />
      <div className="absolute w-[25vw] h-[25vw] max-w-[353px] max-h-[353px] bottom-[-25vh] left-[-10vw] bg-[#336de6] rounded-full" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]">
        <img
          className="absolute w-full max-w-[1336px] h-auto top-6 left-1/2 -translate-x-1/2 opacity-50"
          alt="Union"
          src="https://c.animaapp.com/mbsxrl26lLrLIJ/img/union.svg"
        />
      </div>

      <main className="relative z-10 h-full flex flex-col w-full max-w-[1336px] mx-auto pt-16 px-12 pb-6">
        <div className={`flex-grow flex ${isNotesPanelVisible ? 'flex-row gap-4' : ''} overflow-hidden`}>
          <div
            className={`p-6 rounded-lg shadow-lg h-full overflow-y-auto bg-white 
                        ${isNotesPanelVisible ? 'flex-1' : 'w-full'}`}
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Speaking Modelling</h2>
            <div className="my-6">
              <LiveKitSession
                roomName="modelling-room"
                userName="modelling-user"
                onConnected={(connectedRoom, rpcAdapter) => {
                  console.log("LiveKit connected in ModellingCopyPage, room:", connectedRoom);
                  liveKitRpcAdapterRef.current = rpcAdapter;
                  console.log("LiveKitRpcAdapter assigned in ModellingCopyPage:", liveKitRpcAdapterRef.current);
                }}
                onPerformUIAction={handlePerformUIAction}
              />
            </div>
            <div className="my-6">
              <TiptapEditor 
                ref={tiptapEditorRef}
                extensions={tiptapExtensions}
                initialContent={`<p></p>`} 
                isEditable={true}
                highlightData={highlightData}
              />
            </div>
          </div>

          {isNotesPanelVisible && (
            <div className="w-[30%] h-full p-6 rounded-lg shadow-lg bg-white overflow-y-auto flex flex-col">
              <NotesPanel
                isVisible={true}
                onClose={() => setIsNotesPanelVisible(false)}
                notes={mockNotesData}
                className="flex-grow"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 pb-5">
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
                  
                  <NotesButton
                    isActive={isNotesPanelVisible}
                    onClick={handleToggleNotesPanel}
                  />
              <Button
              onClick={handleTestRpcCall}
              variant="outline"
              className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md truncate">
              Test RPC
            </Button>
                  
                  <MicButton isVisible={true} />
                </div>

                <div className="flex items-center gap-4 mr-10">
                  
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
    </div>
  );
}