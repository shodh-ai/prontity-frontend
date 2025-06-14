"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import VideoControlsUI from "@/components/VideoControlsUI";
import DoubtHandlerProvider from "@/components/DoubtHandlerProvider";
import InteractionControlsWrapper from "@/components/InteractionControlsWrapper";
import { useSession } from "next-auth/react";
import AuthProvider from "@/components/AuthProvider";

/**
 * Writing-practice component (TOEFL style).
 * ▸ First panel shows the reading prompt (static)
 * ▸ Two editable text-areas for the learner’s drafts
 * ▸ Single control cluster (timer, add-time, mic, chat)
 */
// Main page component with auth/context providers
export default function WritingPracticePage() {
  return (
    <AuthProvider>
      <DoubtHandlerProvider>
        <WritingPracticeSession />
      </DoubtHandlerProvider>
    </AuthProvider>
  );
}

// Session content component
function WritingPracticeSession() {
  const { data: session } = useSession();
  const userName = session?.user?.name || 'anonymous-user';
  
  /* ---------------------------------------------------------------- state */
  const TOTAL = 120; // seconds
  const [elapsed, setElapsed] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [draft1, setDraft1] = useState("");
  const [draft2, setDraft2] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  
  // Room name for LiveKit connection
  const roomName = `writing-practice-${Date.now()}`;

  
  /* ----------------------------------------------------------- handlers */
  const toggleAudio = () => setAudioEnabled(prev => !prev);
  const toggleVideo = () => setVideoEnabled(prev => !prev);
  const handleLeave = () => window.history.back();

  /* ----------------------------------------------------------- derived UI */
  const pct  = Math.min((elapsed / TOTAL) * 100, 100);
  const mmss = new Date((TOTAL - elapsed) * 1000).toISOString().slice(14, 19);

  /* -------------------------------------------------------------- effects */
  useEffect(() => {
    if (elapsed >= TOTAL) return;
    const id = setInterval(() => setElapsed(s => s + 1), 1_000);
    return () => clearInterval(id);
  }, [elapsed]);

  /* ------------------------------------------------------------- content */
  const readingPrompt =
    "Contrary to popular belief, Lorem ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words — ‘consectetur’ — in a Lorem Ipsum passage and, after tracing it through classical literature, discovered its undeniable source.";

  /* ------------------------------------------------------------- helpers */
  const toggleRecording = () => setIsRecording(p => !p);

  /* ---------------------------------------------------------------- view */
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white text-gray-800">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-[25vh] right-[-30vw] h-[40vw] w-[40vw] max-h-[740px] max-w-[740px] rounded-full bg-[#566fe9] opacity-80" />
      <div className="pointer-events-none absolute bottom-[-30vh] left-[-15vw] h-[30vw] w-[30vw] max-h-[500px] max-w-[500px] rounded-full bg-[#336de6] opacity-80" />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />

      {/* main card */}
      <div className="relative z-10 mx-auto mt-24 w-full max-w-[820px] rounded-3xl bg-white/90 p-8 shadow-xl">
        {/* header */}
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Writing Practice Session</h2>
          <button onClick={handleLeave} className="text-gray-400 hover:text-gray-600">
            <XIcon className="h-6 w-6" />
          </button>
        </header>

        {/* progress */}
        <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-[#566fe9] transition-[width]" />
        </div>

        {/* reading prompt (static) */}
        <p className="mb-6 max-h-40 overflow-y-auto rounded-xl border border-gray-100 bg-white p-6 text-sm leading-relaxed text-gray-700">
          {readingPrompt}
        </p>

        {/* Draft 1 textarea */}
        <textarea
          placeholder="Draft 1 – type your response here…"
          value={draft1}
          onChange={e => setDraft1(e.target.value)}
          className="mb-6 h-44 w-full resize-none rounded-xl border border-gray-100 bg-white p-6 text-sm leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#566fe9]/40"
        />

        {/* Draft 2 textarea (optional second attempt / notes) */}
        <textarea
          placeholder="Draft 2 / Notes…"
          value={draft2}
          onChange={e => setDraft2(e.target.value)}
          className="h-32 w-full resize-none rounded-xl border border-gray-100 bg-white p-6 text-sm leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#566fe9]/40"
        />

        {/* control strip (single) */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-500">
            <ClockIcon className="h-5 w-5" />
            <span className="tabular-nums">{mmss}</span>
          </div>

          <div className="flex items-center space-x-3">
            {/* New Interaction Controls with RPC integration */}
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
        </div>
      </div>

      {/* bottom-right glow */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 translate-x-1/2 translate-y-1/2 rounded-full bg-[#566fe9] opacity-30 blur-3xl" />
    </div>
  );
}

/* -------------------------------------------------------------- icons */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}