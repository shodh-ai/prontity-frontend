import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

export const TopicToSpeakAbout = (): JSX.Element => {
  // Data for user answer with highlighted sections
  const userAnswerParagraphs = [
    {
      text: "In today's rapid evolving world, achieving a balance between traditional educational practices and innovative approaches is crucial for ensure effective learning outcomes. While tradition methods have provided a strong foundation for education over centuries, embrassing innovation is essential to meet the demands of the modern era. Traditional educational practices, such as lecture, textbooks, and standardized testings, offer stability and continuity in the learning process.",
      highlights: [
        { start: 21, length: 89 },
        { start: 599, length: 82 },
        { start: 89, length: 607 },
      ],
    },
    {
      text: "While tradition methods have provided a strong foundation for education over centuries, embrassing innovation is essential to meet the demands of the modern era. Traditional educational practices, such as lecture, textbooks, and standardized testings, offer stability and continuity in the learning process.",
      highlights: [
        { start: 413, length: 280 },
        { start: 0, length: 306 },
      ],
    },
  ];

  return (
    <div className="w-[1440px] h-[820px] bg-white overflow-hidden">
      <div className="relative w-[2012px] h-[1284px] top-[-359px] -left-36">
        {/* Background elements */}
        <div className="absolute w-[753px] h-[753px] top-0 left-[1259px] bg-[#566fe9] rounded-[376.5px]" />
        <div className="absolute w-[353px] h-[353px] top-[931px] left-0 bg-[#336de6] rounded-[176.5px]" />
        <div className="absolute w-[1440px] h-[820px] top-[359px] left-36 bg-[#ffffff99] backdrop-blur-[200px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]" />

        {/* Main card container */}
        <Card className="absolute w-[1280px] h-[740px] top-[399px] left-56 rounded-xl border-[none]">
          <CardContent className="p-0">
            {/* Close button */}
            <div className="absolute w-6 h-6 top-[17px] left-[1207px] bg-[url(/close.svg)] bg-[100%_100%]" />

            {/* Progress bar */}
            <div className="absolute w-[610px] h-2.5 top-[24px] left-[303px]">
              <Progress
                value={28}
                className="h-2.5 bg-[#c7ccf8] bg-opacity-20"
              />
            </div>

            {/* Session title */}
            <div className="absolute top-[16px] left-[56px] font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6 whitespace-nowrap">
              Speaking Practice Session
            </div>

            {/* User and AI profile images */}
            <div className="inline-flex items-start gap-6 absolute top-[116px] left-[787px] opacity-50">
              <div className="relative w-[200px] h-[200px] bg-[url(/rectangle-63.png)] bg-cover bg-[50%_50%]">
                <div className="inline-flex items-center justify-center gap-2.5 px-2.5 py-1 relative top-[163px] left-2 bg-white rounded-md">
                  <div className="relative w-fit mt-[-1.00px] font-label-large font-[number:var(--label-large-font-weight)] text-[#566fe9] text-[length:var(--label-large-font-size)] tracking-[var(--label-large-letter-spacing)] leading-[var(--label-large-line-height)] whitespace-nowrap [font-style:var(--label-large-font-style)]">
                    User
                  </div>
                </div>
              </div>

              <div className="relative w-[200px] h-[200px] bg-[url(/image-5.png)] bg-cover bg-[50%_50%]">
                <div className="inline-flex items-center justify-center gap-2.5 px-2.5 py-1 relative top-[163px] left-2 bg-white rounded-md">
                  <div className="relative w-fit mt-[-1.00px] font-label-large font-[number:var(--label-large-font-weight)] text-[#566fe9] text-[length:var(--label-large-font-size)] tracking-[var(--label-large-letter-spacing)] leading-[var(--label-large-line-height)] whitespace-nowrap [font-style:var(--label-large-font-style)]">
                    AI Speaking Teacher
                  </div>
                </div>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex flex-col w-[758px] items-start gap-9 absolute top-[80px] left-[56px]">
              {/* Question section */}
              <div className="flex flex-col items-start gap-3 relative self-stretch w-full flex-[0_0_auto]">
                <div className="relative w-fit mt-[-1.00px] opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6 whitespace-nowrap">
                  Question
                </div>

                <div className="relative w-[756px] font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-lg tracking-[0] leading-[28.8px]">
                  With the rise of automation and artificial intelligence, there
                  is a growing concern about the future of jobs and the
                  relevance of traditional education. What measures do you think
                  should be taken to ensure that effective in preparing
                  individuals for the workforce?
                </div>
              </div>

              {/* Timer and recording controls */}
              <div className="inline-flex items-start gap-5 relative flex-[0_0_auto]">
                {/* Think time section */}
                <div className="inline-flex flex-col items-start gap-3 relative flex-[0_0_auto]">
                  <div className="relative self-stretch mt-[-1.00px] opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6">
                    Think time
                  </div>

                  <div className="inline-flex h-12 items-center gap-3 px-4 py-3 relative bg-white rounded-md border border-solid border-[#566fe9]">
                    <div className="relative w-fit font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-[#566fe9] text-xl tracking-[0] leading-[26px] whitespace-nowrap">
                      10m : 00s
                    </div>
                  </div>
                </div>

                {/* Recording controls */}
                <div className="inline-flex flex-col items-start gap-3 relative flex-[0_0_auto]">
                  <div className="relative self-stretch mt-[-1.00px] opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6">
                    Record your answer
                  </div>

                  <div className="inline-flex items-center gap-3 relative flex-[0_0_auto]">
                    <Button className="w-12 h-12 p-3 bg-[#566fe9] rounded-md">
                      <img
                        className="w-6 h-6"
                        alt="Record"
                        src="/frame-2.svg"
                      />
                    </Button>

                    <Button variant="outline" className="p-3 border-[#566fe9]">
                      <img className="w-6 h-6" alt="Pause" src="/frame-1.svg" />
                    </Button>

                    {/* Audio progress bar */}
                    <div className="relative w-[492px] h-[15px]">
                      <div className="relative h-[15px]">
                        <div className="absolute w-[123px] h-[5px] top-[5px] left-0 bg-[#566fe9] rounded-md opacity-90" />
                        <div className="absolute w-[492px] h-[5px] top-1 left-0 bg-[#566fe933] rounded-md" />
                        <div className="absolute w-[15px] h-[15px] top-0 left-[115px] bg-[#647aeb] rounded-[7.5px]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* User answer section */}
              <div className="relative w-[758px] h-[316px]">
                <Card className="absolute w-[758px] h-[280px] top-9 left-0 rounded-xl">
                  <CardContent className="p-0">
                    {/* First paragraph */}
                    <div className="absolute w-[728px] h-28 top-3.5 left-4">
                      <div className="relative w-[726px] h-28">
                        <div className="absolute w-[724px] top-1 left-0.5 font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-base tracking-[-0.32px] leading-6">
                          {userAnswerParagraphs[0].text}
                        </div>
                        {userAnswerParagraphs[0].highlights.map(
                          (highlight, index) => (
                            <div
                              key={index}
                              className="absolute bg-[#ef0e27] rounded opacity-10"
                              style={{
                                width: `${highlight.length}px`,
                                height: "25px",
                                top:
                                  index === 0
                                    ? "21px"
                                    : index === 1
                                      ? "0"
                                      : "71px",
                                left:
                                  index === 0
                                    ? "0"
                                    : index === 1
                                      ? "599px"
                                      : "89px",
                              }}
                            />
                          ),
                        )}
                      </div>
                    </div>

                    {/* Second paragraph */}
                    <div className="absolute w-[728px] h-[84px] top-[162px] left-4">
                      <div className="relative w-[726px] h-[84px]">
                        <div className="absolute w-[724px] top-0 left-0.5 font-['Plus_Jakarta_Sans',Helvetica] font-normal text-black text-base tracking-[-0.32px] leading-6">
                          {userAnswerParagraphs[1].text}
                        </div>
                        {userAnswerParagraphs[1].highlights.map(
                          (highlight, index) => (
                            <div
                              key={index}
                              className="absolute bg-[#ef0e27] rounded opacity-10"
                              style={{
                                width: `${highlight.length}px`,
                                height: "25px",
                                top: index === 0 ? "17px" : "42px",
                                left: index === 0 ? "413px" : "0",
                              }}
                            />
                          ),
                        )}
                      </div>
                    </div>

                    {/* Scrollbar */}
                    <div className="inline-flex h-56 items-end gap-2.5 p-px absolute top-5 left-[744px] bg-[#566fe91a] rounded-[100px]">
                      <div className="relative w-1 h-[100px] bg-[#566fe9] rounded-[100px]" />
                    </div>
                  </CardContent>
                </Card>

                {/* User answer header */}
                <div className="flex w-[744px] items-center justify-between absolute top-0 left-0">
                  <div className="relative w-fit mt-[-1.00px] opacity-60 font-['Plus_Jakarta_Sans',Helvetica] font-semibold text-black text-base tracking-[0] leading-6 whitespace-nowrap">
                    User Answer
                  </div>

                  <div className="relative w-fit mt-[-1.00px] font-label-extra-large font-[number:var(--label-extra-large-font-weight)] text-[#566fe9] text-[length:var(--label-extra-large-font-size)] tracking-[var(--label-extra-large-letter-spacing)] leading-[var(--label-extra-large-line-height)] whitespace-nowrap [font-style:var(--label-extra-large-font-style)]">
                    Word Count: 192
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom control buttons */}
            <div className="inline-flex items-center gap-2 absolute top-[668px] left-[500px] opacity-50">
              <Button
                variant="outline"
                className="w-12 h-12 p-3 border-[#566fe9]"
              >
                <div className="w-6 h-6 bg-[url(/mic-on.svg)] bg-[100%_100%]" />
              </Button>

              <Button
                variant="outline"
                className="w-12 h-12 p-3 border-[#566fe9]"
              >
                <img className="w-6 h-6" alt="Pause" src="/frame.svg" />
              </Button>

              <Button
                variant="outline"
                className="w-12 h-12 p-3 border-[#566fe9]"
              >
                <img className="w-6 h-6" alt="Refresh" src="/frame-4.svg" />
              </Button>

              <Button
                variant="outline"
                className="w-12 h-12 p-3 border-[#566fe9]"
              >
                <img className="w-6 h-6" alt="Settings" src="/frame-3.svg" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
