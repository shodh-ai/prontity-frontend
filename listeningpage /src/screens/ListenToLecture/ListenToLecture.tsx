import { MicIcon, PlayIcon } from "lucide-react";
import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";

export const ListenToLecture = (): JSX.Element => {
  const questionOptions = [
    "Who to hire for the specific job.",
    "What to do at the upcoming faculty party.",
    "Who to fire.",
    "How to evaluate new teachers.",
  ];

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="relative w-[1440px] h-[820px] bg-white overflow-hidden">
        <Card className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[1280px] h-[740px] rounded-xl border-[none]">
          <CardContent className="relative p-8 h-full">
            {/* Close button */}
            <button className="absolute top-4 right-4 w-6 h-6 bg-[url(/close.svg)] bg-[100%_100%]" />

            {/* User profiles section */}
            <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col gap-6">
              <div className="relative w-[200px] h-[200px] bg-[url(/rectangle-63.png)] bg-cover">
                <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-white rounded-md">
                  <span className="text-[#566fe9] font-label-large">User</span>
                </div>
              </div>

              <div className="relative w-[200px] h-[200px] bg-[url(/image-5.png)] bg-cover">
                <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-white rounded-md">
                  <span className="text-[#566fe9] font-label-large">AI Speaking Teacher</span>
                </div>
              </div>
            </div>

            <div className="max-w-[800px] space-y-8">
              {/* Session title and progress */}
              <div className="space-y-4">
                <h2 className="font-semibold text-base">Speaking Practice Session</h2>
                <Progress value={28} className="h-2.5 rounded-md bg-[#c7ccf8] bg-opacity-20" />
              </div>

              {/* Listen to lecture section */}
              <section className="space-y-3">
                <h3 className="opacity-60 font-semibold text-base">Listen to the lecture</h3>
                <div className="flex items-center gap-3">
                  <Button size="icon" className="w-12 h-12 bg-[#566fe9] rounded-md">
                    <PlayIcon className="w-6 h-6 text-white" />
                  </Button>
                  <Button variant="outline" size="icon" className="p-3 border-[#566fe9]">
                    <img className="w-6 h-6" alt="Frame" src="/frame.svg" />
                  </Button>
                  <div className="relative w-[680px] h-[15px]">
                    <div className="relative h-[15px]">
                      <div className="absolute w-[123px] h-[5px] top-[5px] left-0 bg-[#566fe9] rounded-md opacity-90" />
                      <div className="absolute w-[680px] h-[5px] top-[5px] left-0 bg-[#566fe933] rounded-md" />
                      <div className="absolute w-[15px] h-[15px] top-0 left-[115px] bg-[#647aeb] rounded-[7.5px]" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Questions section */}
              <section className="space-y-3">
                <h3 className="opacity-60 font-semibold text-base">Answer the following questions</h3>
                <p className="text-base leading-[25.6px]">
                  What topic are the two staff members talking about?
                </p>
              </section>

              {/* Multiple choice options */}
              <RadioGroup className="space-y-2">
                {questionOptions.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-5 rounded-md border border-gray-200"
                  >
                    <RadioGroupItem
                      value={`option-${index + 1}`}
                      id={`option-${index + 1}`}
                      className="w-6 h-6"
                    />
                    <label
                      htmlFor={`option-${index + 1}`}
                      className="text-base leading-[25.6px]"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Control buttons - Centered at the bottom */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
              <Button variant="outline" size="icon" className="w-12 h-12 border-[#566fe9]">
                <MicIcon className="w-6 h-6 text-[#566fe9]" />
              </Button>
              <Button variant="outline" size="icon" className="w-12 h-12 border-[#566fe9]">
                <img className="w-6 h-6" alt="Frame" src="/frame-4.svg" />
              </Button>
              <Button variant="outline" size="icon" className="w-12 h-12 border-[#566fe9]">
                <img className="w-6 h-6" alt="Frame" src="/frame-7.svg" />
              </Button>
              <Button variant="outline" size="icon" className="w-12 h-12 border-[#566fe9]">
                <img className="w-6 h-6" alt="Frame" src="/frame-5.svg" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};