"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** -------------------------------------------------------------------------
 *  FeedbackReviewSession
 *
 *  Combines three core interactions seen in the reference:
 *    • Highlighted writing with AI hint bubble
 *    • Q&A chat thread
 *    • Detailed rule-explanation sidebar when a mark is clicked
 *
 *  – Left pane is always the student's writing (content-editable for tweaks)
 *  – Right pane dynamically switches between chat log & feedback cards
 *  – Bottom dock retains timer / mic / chat controls for consistency
 * ---------------------------------------------------------------------- */
export default function FeedbackReviewSession() {
  /* ---------------------------------------------------------------- state */
  const TOTAL = 900; // 15-min review
  const [elapsed, setElapsed] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMark, setSelectedMark] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([
    { from: "ai", text: "Okay, let's zoom in on that second sentence. You said 'it more better helps students' — try changing that to 'it helps students better'. Sound smoother?" },
  ]);

  /* ------------------------------------------------------------- timer */
  const mmss = new Date((TOTAL - elapsed) * 1000).toISOString().slice(14, 19);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => Math.min(s + 1, TOTAL)), 1000);
    return () => clearInterval(id);
  }, []);

  /* -------------------------------------------------------- writing HTML */
  const initialHTML = `
    <p>Over the last few years, education has become increasingly <mark data-id="1">important for to make</mark> progress in both personal and professional lives. Students are now expected to understand complex topics at a much earlier age than before, and the pressure to perform well has never been higher.</p>
    <p>Many learners struggle with expressing their ideas fluently, especially in academic writing. It's not unusual to see phrases like <mark data-id="2">He go to the university every day</mark> or <mark data-id="2">She don't have any time</mark> in essays. These might seem like small mistakes, but they can significantly affect how a reader perceives clarity and credibility.</p>
    <p>Additionally, vocabulary development is often overlooked. Some students rely on very simple words which aren't <mark data-id="3">always suitable</mark> for formal contexts. Instead of saying something like <mark data-id="3">This idea is nice.</mark>, <mark data-id="3">This idea is compelling.</mark> might sound more academic and specific.</p>
    <p>Some people believe that technology is make our life more easier, while others argue it causes more distractions than benefits. The truth probably lies somewhere in between. For example, smartphones enable quick communication but also make it difficult to focus for long periods.</p>`;

  /* ---------------------------------------------------------- feedback DB*/
  const FEEDBACK: Record<string, { title: string; body: string }> = {
    1: {
      title: "Word Order / Redundancy",
      body: "The phrase 'important for to make' is redundant and ungrammatical. Replace with 'important for making' or simply 'important to'…",
    },
    2: {
      title: "Subject–Verb Agreement",
      body: "Verb must match subject in number/person. Example: He go → He goes; She don't → She doesn't.",
    },
    3: {
      title: "Word Choice",
      body: "Use more precise vocabulary in academic contexts. 'Nice' → 'compelling', 'good' → 'advantageous', etc.",
    },
  };

  /* ----------------------------------------------------------- handlers */
  const send = () => {
    const t = input.trim();
    if (!t) return;
    setChat((c) => [...c, { from: "user", text: t }]);
    setInput("");
    // demo AI echo
    setTimeout(() => setChat((c) => [...c, { from: "ai", text: `Sure! ${t}` }]), 800);
  };

  /* ---------------------------------------------------------------- view */
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbf9ff] text-gray-800">
      {/* blobs & frost */}
      <div className="pointer-events-none absolute -top-[25vh] right-[-30vw] h-[45vw] w-[45vw] max-h-[780px] rounded-full bg-[#6e83ff] opacity-60" />
      <div className="pointer-events-none absolute bottom-[-25vh] left-[-15vw] h-[35vw] w-[35vw] max-h-[620px] rounded-full bg-[#4b6cfb] opacity-60" />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />

      {/* main card */}
      <div className="relative z-10 mx-auto mt-12 w-full max-w-[1200px] rounded-3xl bg-white/90 p-8 shadow-xl">
        {/* header */}
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Feedback</h2>
          <button onClick={() => history.back()} className="text-gray-400 hover:text-gray-600">
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        {/* grid */}
        <div className="flex gap-6">
          {/* writing area */}
          <div className="relative w-7/12 rounded-lg border border-gray-200 bg-white p-5">
            <div
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: initialHTML }}
              onClick={(e) => {
                const mark = (e.target as HTMLElement).closest("mark[data-id]") as HTMLElement | null;
                setSelectedMark(mark ? mark.dataset.id || null : null);
              }}
              className="prose prose-sm max-h-[420px] overflow-y-auto focus:outline-none"
            />

            {/* AI hint bubble (bottom-center) */}
            <div className="pointer-events-none absolute left-1/2 top-[calc(100%+1rem)] w-max -translate-x-1/2 rounded-full bg-white px-6 py-2 text-xs text-gray-700 shadow">
              "Good job getting your ideas down! Mind if I highlight a couple areas we can polish for fluency and tone?"
            </div>
          </div>

          {/* right pane – either feedback or chat */}
          <div className="flex w-5/12 flex-col gap-4">
            {selectedMark ? (
              <aside className="flex-1 rounded-lg border border-gray-200 bg-white p-5 text-sm shadow-sm">
                <h3 className="mb-3 font-medium text-gray-800">{FEEDBACK[selectedMark].title}</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{FEEDBACK[selectedMark].body}</p>
              </aside>
            ) : (
              <div className="flex h-full flex-col">
                {/* chat log */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
                  {chat.map((m, i) => (
                    <div
                      key={i}
                      className={`w-max max-w-full rounded-lg px-4 py-2 shadow ${
                        m.from === "ai" ? "bg-[#eef1ff] text-gray-800" : "bg-[#566fe9] text-white" }`}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>

                {/* chat input */}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Ask your AI tutor…"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#566fe9]/40"
                  />
                  <Button size="icon" className="h-9 w-9 rounded-full bg-[#566fe9] text-white shadow" onClick={send}>
                    <TriangleIcon className="h-4 w-4 rotate-90" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer controls */}
        <footer className="mt-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <ClockIcon className="h-4 w-4" />
            <span className="tabular-nums text-sm">{mmss}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-gray-100">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-gray-100">
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={() => setIsRecording((p) => !p)}
              className={`h-8 w-8 rounded-full transition-colors ${
                isRecording ? "bg-[#566fe9] text-white" : "bg-[#566fe9]/10 text-[#566fe9]" }`}
            >
              <MicIcon className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-gray-100">
              <ChatIcon className="h-4 w-4" />
            </Button>
          </div>
        </footer>

        {/* highlight styling */}
        <style jsx>{`
          mark {
            background: #d1fadd;
            padding: 0 2px;
            border-radius: 3px;
            cursor: pointer;
          }
          mark[data-id="${selectedMark ?? ""}"] {
            outline: 2px solid #37b24d;
          }
        `}</style>
      </div>

      {/* glow */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 translate-x-1/2 translate-y-1/2 rounded-full bg-[#6e83ff] opacity-30 blur-3xl" />
    </div>
  );
}

/* ------------------------------------------------------------- icons */
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
function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
