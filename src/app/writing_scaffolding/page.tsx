"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import VideoControlsUI from "@/components/VideoControlsUI";
import DoubtHandlerProvider from "@/components/DoubtHandlerProvider";
import InteractionControlsWrapper from "@/components/InteractionControlsWrapper";
import { useSession } from "next-auth/react";
import AuthProvider from "@/components/AuthProvider";

/**
 *  WritingScaffoldingChat – a standalone page that mirrors the *final* frame of
 *  the reference (reading passage on the left, student draft + chat bubbles on
 *  the right).
 */
// Main page component with auth/context providers
export default function WritingScaffoldingPage() {
  return (
    <AuthProvider>
      <DoubtHandlerProvider>
        <WritingScaffoldingChat />
      </DoubtHandlerProvider>
    </AuthProvider>
  );
}

// Session content component
function WritingScaffoldingChat() {
  const { data: session } = useSession();
  const userName = session?.user?.name || 'anonymous-user';
  
  // Room name for LiveKit connection
  const roomName = `writing-scaffold-${Date.now()}`; 
  /* -------------------------------------------------------------- timers */
  const TOTAL = 900; // 15-minute chat window
  const [elapsed, setElapsed] = useState(0);
  const mmss = new Date((TOTAL - elapsed) * 1000).toISOString().slice(14, 19);
  
  /* --------------------------------------------------------------- state */
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  
  /* ------------------------------------------------------------- handlers */
  const toggleAudio = () => setAudioEnabled(prev => !prev);
  const toggleVideo = () => setVideoEnabled(prev => !prev);
  const handleLeave = () => window.history.back();
  
  // Async handlers for interaction controls
  const handleHandRaise = async (): Promise<void> => {
    setIsHandRaised(prev => !prev);
    console.log('Hand raised:', !isHandRaised);
    // In a real implementation, this would call the RPC service
  };
  
  const handlePushToTalk = async (isActive: boolean): Promise<void> => {
    setIsPushToTalkActive(isActive);
    console.log('Push to talk:', isActive);
    // In a real implementation, this would call the RPC service
  };
  
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => Math.min(s + 1, TOTAL)), 1000);
    return () => clearInterval(id);
  }, []);

  /* ----------------------------------------------------------- data */
  const passage = `Contrary to popular belief, Lorem ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC…`;
  const [draft, setDraft] = useState("In today's rapidly evolving world, achieving a balance between traditional educational practices…");
  const [messages, setMessages] = useState([
    { from: "ai", text: "Several factors influence how the points clarify…" },
    { from: "user", text: "Can you polish my summary and make it insightful?" },
  ]);
  const [input, setInput] = useState("");

  /* ----------------------------------------------------------- send */
  const send = () => {
    const t = input.trim();
    if (!t) return;
    setMessages((m) => [...m, { from: "user", text: t }]);
    setInput("");
    // fake AI echo after 800 ms
    setTimeout(() => {
      setMessages((m) => [...m, { from: "ai", text: `AI: ${t}` }]);
    }, 800);
  };

  /* ----------------------------------------------------------- view */
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#faf7fe] text-gray-800">
      {/* blobs & frost */}
      <div className="pointer-events-none absolute -top-[25vh] right-[-30vw] h-[45vw] w-[45vw] max-h-[780px] rounded-full bg-[#7b87ff] opacity-60" />
      <div className="pointer-events-none absolute bottom-[-25vh] left-[-15vw] h-[35vw] w-[35vw] max-h-[620px] rounded-full bg-[#556dff] opacity-60" />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />

      {/* card */}
      <div className="relative z-10 mx-auto mt-12 w-full max-w-[1100px] rounded-3xl bg-white/90 p-8 shadow-xl">
        {/* header */}
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Writing Scaffolding – Chat</h2>
          <button onClick={() => history.back()} className="text-gray-400 hover:text-gray-600">
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        {/* content grid */}
        <div className="flex gap-6">
          {/* reading passage */}
          <p className="w-2/5 max-h-[420px] overflow-y-auto rounded-lg border border-gray-100 bg-white p-6 text-sm leading-relaxed text-gray-700">
            {passage}
          </p>

          {/* right pane */}
          <div className="flex-1 relative">
            {/* Interaction Controls with LiveKit RPC integration */}
            <div className="absolute bottom-4 right-4 z-20">
              {roomName && userName && (
                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow">
                  <InteractionControlsWrapper 
                    roomName={roomName}
                    userName={userName}
                    className="w-full"
                  />
                </div>
              )}
            </div>
            {/* draft */}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mb-4 h-52 w-full resize-none rounded-lg border border-gray-100 bg-white p-6 text-sm leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#556dff]/40"
            />

            {/* chat log */}
            <div className="mb-3 max-h-44 space-y-2 overflow-y-auto pr-2 text-sm">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`w-max max-w-full rounded-lg px-4 py-2 shadow ${
                    m.from === "ai" ? "bg-[#eef1ff] text-gray-800" : "bg-[#556dff] text-white" }`}
                >
                  {m.text}
                </div>
              ))}
            </div>

            {/* input */}
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type your question…"
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#556dff]/40"
              />
              <Button size="icon" className="h-9 w-9 rounded-full bg-[#556dff] text-white shadow" onClick={send}>
                <TriangleIcon className="h-4 w-4 rotate-90" />
              </Button>
            </div>
          </div>
        </div>

        {/* footer controls */}
        <footer className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-1 text-gray-500">
            <ClockIcon className="h-4 w-4" />
            <span className="tabular-nums text-sm">{mmss}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-gray-100">
              <TriangleIcon className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-gray-100">
              <MicIcon className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-gray-100">
              <ChatIcon className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>

      {/* glow */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 translate-x-1/2 translate-y-1/2 rounded-full bg-[#7b87ff] opacity-30 blur-3xl" />
    </div>
  );
}

/* -------------------------------- icons --------------------------------- */
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function TriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
function MicIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 0 0 1 2-2h14a2 0 0 1 2 2z" />
    </svg>
  );
}
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
