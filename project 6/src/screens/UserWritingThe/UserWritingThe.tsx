import { XIcon } from "lucide-react";
import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";

export const UserWritingThe = (): JSX.Element => {
  const teacherComments = [
    {
      text: "Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College.",
    },
    {
      text: "Try using more transition words like however, therefore, or in contrast to improve the flow between your ideas.",
    },
    {
      text: "Editing one extra time for grammar and punctuation will make your final piece look much more polished.",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center overflow-hidden relative">
      {/* Background decorative elements */}
      <div className="absolute w-[753px] h-[753px] top-0 right-0 bg-[#566fe9] rounded-[376.5px] -z-10" />
      <div className="absolute w-[353px] h-[353px] bottom-0 left-0 bg-[#336de6] rounded-[176.5px] -z-10" />
      <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] -z-10" />

      {/* Main content card */}
      <Card className="w-[1280px] h-[740px] bg-white rounded-xl border-none m-4 relative">
        <CardContent className="p-6">
          {/* Close button */}
          <button className="absolute top-4 right-4">
            <XIcon className="h-6 w-6" />
          </button>

          {/* Progress section */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base">
              Writing Practice Session
            </h1>
            <div className="w-[610px]">
              <Progress value={28} className="bg-[#c7ccf8] opacity-20" />
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-[2fr_1fr] gap-8">
            {/* Left column - Reading and Writing */}
            <div className="space-y-6">
              {/* Reading section */}
              <div>
                <h3 className="opacity-60 font-semibold mb-3">Read the passage</h3>
                <div className="font-normal text-base leading-[25.6px]">
                  With the rise of automation and artificial intelligence, there
                  is a growing concern about the future of jobs and the relevance
                  of traditional education. What measures do you think should be
                  taken to ensure that education remains effective in preparing
                  individuals for the workforce.
                  <br /><br />
                  Contrary to popular belief, Lorem Ipsum is not simply random
                  text. It has roots in a piece of classical Latin literature from
                  45 BC, making it over 2000 years old. Richard McClintock, a
                  Latin professor at Hampden-Sydney College in Virginia, looked up
                  one of the more obscure Latin words, consectetur, from a Lorem
                  Ipsum passage, and going through the cites of the word in
                  classical literature, discovered the undoubtable source.
                </div>
              </div>

              {/* Writing section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="opacity-60 font-semibold">User Answer</h3>
                  <span className="text-[#566fe9]">Word Count: 192</span>
                </div>
                <Card className="border-none">
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <p className="text-base leading-6">
                        In today's rapid evolving world, achieving a balance
                        between traditional educational practices and innovative
                        approaches is crucial for ensure effective learning
                        outcomes. While tradition methods have provided a strong
                        foundation for education over centuries, embrassing
                        innovation is essential to meet the demands of the
                        modern era. Traditional educational practices, such as
                        lecture, textbooks, and standardized testings, offer
                        stability and continuity in the learning process.
                      </p>
                      <div className="absolute bg-[#ef0e27] opacity-10 inset-y-0 left-0 w-[89px]" />
                      <div className="absolute bg-[#ef0e27] opacity-10 inset-y-0 right-0 w-[82px]" />
                    </div>
                    <div className="relative">
                      <p className="text-base leading-6">
                        While tradition methods have provided a strong
                        foundation for education over centuries, embrassing
                        innovation is essential to meet the demands of the
                        modern era. Traditional educational practices, such as
                        lecture, textbooks, and standardized testings, offer
                        stability and continuity in the learning process.
                      </p>
                      <div className="absolute bg-[#ef0e27] opacity-10 inset-y-0 right-0 w-[280px]" />
                      <div className="absolute bg-[#ef0e27] opacity-10 inset-y-0 left-0 w-[306px]" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right column - Comments */}
            <div>
              <h2 className="opacity-60 font-semibold mb-3">Comments</h2>
              <ScrollArea className="h-[520px] pr-4">
                {teacherComments.map((comment, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-5 mb-4 rounded-xl"
                  >
                    <img
                      className="w-12 h-12 object-cover"
                      alt="AI Teacher"
                      src="/rectangle-53-2.png"
                    />
                    <div className="space-y-2">
                      <div className="opacity-60 font-semibold">
                        AI Writing Teacher
                      </div>
                      <div className="font-normal text-base leading-[25.6px]">
                        {comment.text}
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
              <Button
                variant="outline"
                className="w-full mt-4 border-[#566fe9] text-[#566fe9]"
              >
                Next Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};