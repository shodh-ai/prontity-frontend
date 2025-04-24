"use client";

import React from "react";
import { MicIcon, VideoIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import { useEffect, useState } from "react";

// Define types for our question data
type Highlight = {
  text: string;
  start: number;
  end: number;
};

type Answer = {
  text: string;
  highlights: Highlight[];
};

type SessionData = {
  title: string;
  progress: number;
  question: string;
  answer: Answer;
};

export default function Home() {
  // State for showing/hiding the answer
  const [showAnswer, setShowAnswer] = useState(false);
  
  // State for the speaking practice session data
  const [sessionData, setSessionData] = useState<SessionData>({
    title: "Speaking Practice Session",
    progress: 28, // 171px out of 610px ≈ 28%
    question: "",
    answer: {
      text: "",
      highlights: [],
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch question from API
  useEffect(() => {
    async function fetchQuestion() {
      try {
        setLoading(true);
        // You can randomize which question to fetch or specify a particular one
        // For now, we'll fetch the first question (id: 1)
        const response = await fetch("/api/questions");
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        const question = data[0]; // Get the first question for now
        
        setSessionData(prev => ({
          ...prev,
          question: question.text,
          answer: question.answer
        }));
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch question:", err);
        setError("Failed to load question. Please try again.");
        setLoading(false);
      }
    }
    
    fetchQuestion();
  }, []);

  // Profiles data
  const profiles = [
    {
      image: "/rectangle-63.png",
      label: "User",
    },
    {
      image: "/image-5.png",
      label: "AI Speaking Teacher",
    },
  ];

  return (
    <div className="bg-white flex flex-row justify-center w-full">
      <div className="bg-white overflow-hidden w-[1440px] h-[820px] relative">
        {/* Background elements */}
        <div className="absolute w-[753px] h-[753px] top-[-359px] right-[-572px] bg-[#566fe9] rounded-[376.5px]" />
        <div className="absolute w-[353px] h-[353px] bottom-[-464px] left-[-36px] bg-[#336de6] rounded-[176.5px]" />
        <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px]" />

        {/* Main card */}
        <Card className="absolute top-[40px] left-[80px] w-[1280px] h-[740px] rounded-xl border-none shadow-none">
          <CardContent className="p-0 relative h-full">
            {/* Header with title and close button */}
            <div className="flex justify-between items-center p-4">
              <h2 className="font-semibold text-base">
                {sessionData.title}
              </h2>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <XIcon className="h-6 w-6" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="w-[610px] mx-auto">
              <Progress
                value={sessionData.progress}
                className="h-2.5 bg-opacity-20 bg-[#c7ccf8]"
              />
            </div>

            <div className="flex mt-24">
              {/* Main content area */}
              <div className="flex-1 px-10">
                {/* Question section */}
                <div className="flex flex-col w-[800px] items-start gap-3">
                  <h3 className="opacity-60 font-semibold text-base">
                    Question
                  </h3>
                  {loading ? (
                    <p className="font-normal text-lg leading-[28.8px]">Loading question...</p>
                  ) : error ? (
                    <p className="font-normal text-lg leading-[28.8px] text-red-500">{error}</p>
                  ) : (
                    <p className="font-normal text-lg leading-[28.8px]">
                      {sessionData.question}
                    </p>
                  )}
                </div>

                {/* Separator */}
                <Separator className="my-8 w-[800px]" />

                {/* Show Answer Button */}
                {!showAnswer && !loading && !error && (
                  <div className="mt-4 mb-8">
                    <Button 
                      onClick={() => setShowAnswer(true)}
                      className="bg-[#566fe9] text-white hover:bg-[#4056c9]"
                    >
                      Show Answer
                    </Button>
                  </div>
                )}

                {/* Answer section - only shown if showAnswer is true */}
                {showAnswer && (
                  <div className="flex flex-col w-[725px] items-start gap-3">
                    <h3 className="opacity-60 font-semibold text-base">
                      Answer
                    </h3>
                    <div className="relative w-[725px]">
                      {loading ? (
                        <p className="font-normal text-lg tracking-[-0.06px] leading-[27px]">Loading answer...</p>
                      ) : error ? (
                        <p className="font-normal text-lg tracking-[-0.06px] leading-[27px] text-red-500">{error}</p>
                      ) : sessionData.answer.text && sessionData.answer.highlights.length >= 2 ? (
                        <p className="font-normal text-lg tracking-[-0.06px] leading-[27px]">
                          {sessionData.answer.text
                            .split(sessionData.answer.highlights[0].text)
                            .map((part, index, array) => {
                              if (index === 0) {
                                return (
                                  <React.Fragment key={`part-${index}`}>
                                    {part}
                                    <span className="text-[#ee0d27] bg-[#ef0e27] bg-opacity-10 rounded">
                                      {sessionData.answer.highlights[0].text}
                                    </span>
                                  </React.Fragment>
                                );
                              } else {
                                const remainingText = part.split(
                                  sessionData.answer.highlights[1].text,
                                );
                                return (
                                  <React.Fragment key={`part-${index}`}>
                                    {remainingText[0]}
                                    <span className="text-[#ee0d27] bg-[#ef0e27] bg-opacity-10 rounded">
                                      {sessionData.answer.highlights[1].text}
                                    </span>
                                    {remainingText[1]}
                                  </React.Fragment>
                                );
                              }
                            })}
                        </p>
                      ) : (
                        <p className="font-normal text-lg tracking-[-0.06px] leading-[27px]">{sessionData.answer.text || "No answer available"}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2 mt-24 justify-center" style={{position: 'absolute', width: '160px', height: '48px', left: 'calc(50% - 160px/2)', top: '696px'}}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 border-[#566fe9] rounded-none"
                    style={{boxSizing: 'border-box', display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px', gap: '10px', width: '48px', height: '48px', background: '#FFFFFF', border: '1px solid #566FE9', borderRadius: '0px'}}
                  >
                    <MicIcon className="h-6 w-6" style={{color: '#566FE9'}} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 border-[#566fe9] rounded-none"
                    style={{boxSizing: 'border-box', display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px', gap: '10px', width: '48px', height: '48px', background: '#FFFFFF', border: '1px solid #566FE9', borderRadius: '0px'}}
                  >
                    <VideoIcon className="h-6 w-6" style={{color: '#566FE9'}} />
                  </Button>
                </div>
              </div>

              {/* Profile cards */}
              <div className="flex flex-col w-[200px] items-start gap-6 mr-8">
                {profiles.map((profile, index) => (
                  <div
                    key={`profile-${index}`}
                    className="relative w-[200px] h-[200px]"
                    style={{
                      backgroundImage: `url(${profile.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "50% 50%",
                    }}
                  >
                    <Badge className="absolute bottom-2 left-2 bg-white text-[#566fe9] font-label-large">
                      {profile.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}