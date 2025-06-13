"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import VideoControlsUI from "@/components/VideoControlsUI";

/**
 * Live Writing Task page – with *clickable* error highlights.
 *
 *  ▸ Each <mark data-id="…"> is rendered from an HTML string, so marks are visible.
 *  ▸ Clicking any highlight opens a sidebar explaining the rule (subject-verb agreement, etc.).
 *  ▸ Uses Tailwind + shadcn/ui Button.
 */
export default function WritingLiveSession() {
  /* ---------------------------------------------------------------- state */
  const DURATION = 600; // seconds
  const [elapsed, setElapsed] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  
  // Handlers for VideoControlsUI
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

  /* ------------------------------------------------------ derived helpers */
  const mmss = new Date((DURATION - elapsed) * 1000).toISOString().slice(14, 19);

  useEffect(() => {
    if (elapsed >= DURATION) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1_000);
    return () => clearInterval(id);
  }, [elapsed]);

  /* ------------------------------------------------------ initial content */
  const initialHTML = `
  <p>Over the last few years, education has become increasingly <mark data-id="1">important for to make</mark> progress in both personal and professional lives. Students are now expected to understand complex topics at a much earlier age than before, and the pressure to perform well has never been higher.</p>
  <p>Many learners struggle with expressing their ideas fluently, especially in academic writing. It's not unusual to see phrases like <mark data-id="2">He go to the university every day</mark> or <mark data-id="2">She don't have any time</mark> in essays. These might seem like small mistakes, but they can significantly affect how a reader perceives clarity and credibility.</p>
  <p>Additionally, vocabulary development is often overlooked. Some students rely on very simple words which aren't <mark data-id="3">always suitable</mark> for formal contexts. Instead of saying something like <mark data-id="3">This idea is nice.</mark>, <mark data-id="3">This idea is compelling.</mark> might sound more academic and specific.</p>
  <p>Some people believe that technology is make our life more easier, while others argue it causes more distractions than benefits. The truth probably lies somewhere in between. For example, smartphones enable quick communication but also make it difficult to focus for long periods.</p>`;

  /* ---------------------------------------------------------- feedback DB */
  const FEEDBACK: Record<string, { title: string; body: string }> = {
    1: {
      title: "Word Order / Redundancy",
      body: "The phrase ‘important for to make’ is redundant and ungrammatical. Replace with ‘important for making’ or simply ‘important to make’.",
    },
    2: {
      title: "Subject–Verb Agreement",
      body: "Verb must match subject in number/person. Example: He go → He goes, She don't → She doesn't.",
    },
    3: {
      title: "Word Choice",
      body: "Use more specific vocabulary in academic contexts. ‘Nice’ → ‘compelling’, ‘good’ → ‘advantageous’, etc.",
    },
  };

  /* ---------------------------------------------------------------- view */
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#fdfbff] text-gray-800">
      {/* decorative blobs & frost */}
      <div className="pointer-events-none absolute -top-[25vh] right-[-30vw] h-[45vw] w-[45vw] max-h-[780px] rounded-full bg-[#6e83ff] opacity-70" />
      <div className="pointer-events-none absolute bottom-[-25vh] left-[-15vw] h-[35vw] w-[35vw] max-h-[620px] rounded-full bg-[#4b6cfb] opacity-70" />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />

      {/* main card */}
      <div className="relative z-10 mx-auto mt-16 w-full max-w-[1020px] rounded-3xl bg-white/90 p-8 shadow-xl">
        {/* header */}
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Writing Live</h2>
          <button onClick={() => window.history.back()} className="text-gray-400 hover:text-gray-600">
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex gap-6">
          {/* writing canvas */}
          <div
            className="prose prose-sm flex-1 max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 focus:outline-none"
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: initialHTML }}
            onClick={(e) => {
              const mark = (e.target as HTMLElement).closest("mark[data-id]") as HTMLElement | null;
              if (mark) setSelected(mark.dataset.id || null);
            }}
          />

          {/* sidebar feedback */}
          {selected && (
            <aside className="w-64 shrink-0 rounded-lg border border-gray-200 bg-white p-5 text-sm shadow-sm">
              <h3 className="mb-3 font-medium text-gray-800">{FEEDBACK[selected].title}</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{FEEDBACK[selected].body}</p>
            </aside>
          )}
        </div>

        {/* controls */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-500">
            <ClockIcon className="h-4 w-4" />
            <span className="tabular-nums text-sm">{mmss}</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <VideoControlsUI
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              toggleAudio={toggleAudio}
              toggleCamera={toggleVideo}
              handleLeave={handleLeave}
              hideVideo={true}
              hideAudio={false}
              onHandRaise={handleHandRaise}
              onPushToTalk={handlePushToTalk}
            />
          </div>
        </div>
      </div>

      {/* highlight styling */}
      <style jsx>{`
        mark {
          background: #d1fadd;
          padding: 0 2px;
          border-radius: 3px;
          cursor: pointer;
        }
        mark[data-id="${selected ?? ""}"] {
          outline: 2px solid #37b24d;
        }
      `}</style>

      {/* bottom-right glow */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-44 w-44 translate-x-1/2 translate-y-1/2 rounded-full bg-[#6e83ff] opacity-30 blur-3xl" />
    </div>
  );
}

/* -------------------------------------------------------------- icons */
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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