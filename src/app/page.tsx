"use client";

import { MicIcon, VideoIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  // Data for the speaking practice session
  const sessionData = {
    title: "Speaking Practice Session",
    progress: 28, // 171px out of 610px ≈ 28%
    question:
      "With the rise of automation and artificial intelligence, there is a growing concern about the future of jobs and the relevance of traditional education. What measures do you think should be taken to ensure that education remains effective in preparing individuals for the workforce?",
    answer: {
      text: "In today's rapid evolving world, achieving a balance between traditional educational practices and innovative approaches is crucial for ensure effective learning outcomes. While tradition methods have provided a strong foundation for education over centuries, embrassing innovation is essential to meet the demands of the modern era. Traditional educational practices, such as lecture, textbooks, and standardized testings, offer stability and continuity in the learning process.",
      highlights: [
        { text: "innovative approaches", start: 85, end: 105 },
        {
          text: "Traditional educational practices, such as lecture, textbooks, and standardized testings,",
          start: 237,
          end: 323,
        },
      ],
    },
  };

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
                  <p className="font-normal text-lg leading-[28.8px]">
                    {sessionData.question}
                  </p>
                </div>

                {/* Separator */}
                <Separator className="my-8 w-[800px]" />

                {/* Answer section */}
                <div className="flex flex-col w-[725px] items-start gap-3">
                  <h3 className="opacity-60 font-semibold text-base">
                    Answer
                  </h3>
                  <div className="relative w-[725px]">
                    <p className="font-normal text-lg tracking-[-0.06px] leading-[27px]">
                      {sessionData.answer.text
                        .split(sessionData.answer.highlights[0].text)
                        .map((part, index, array) => {
                          if (index === 0) {
                            return (
                              <>
                                {part}
                                <span className="text-[#ee0d27] bg-[#ef0e27] bg-opacity-10 rounded">
                                  {sessionData.answer.highlights[0].text}
                                </span>
                              </>
                            );
                          } else {
                            const remainingText = part.split(
                              sessionData.answer.highlights[1].text,
                            );
                            return (
                              <>
                                {remainingText[0]}
                                <span className="text-[#ee0d27] bg-[#ef0e27] bg-opacity-10 rounded">
                                  {sessionData.answer.highlights[1].text}
                                </span>
                                {remainingText[1]}
                              </>
                            );
                          }
                        })}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 mt-24 justify-center">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 rounded-md border-[#566fe9]"
                  >
                    <MicIcon className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 rounded-md border-[#566fe9]"
                  >
                    <VideoIcon className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Profile cards */}
              <div className="flex flex-col w-[200px] items-start gap-6 mr-8">
                {profiles.map((profile, index) => (
                  <div
                    key={index}
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