import React, { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { MessageButton } from "../../components/ui/message-button";
import { MicButton } from "../../components/ui/mic";

export const Q = (): JSX.Element => {
  // State to manage the visibility of the pop-up/chat input
  const [isPopupVisible, setIsPopupVisible] = useState(false);

  // Data for suggestion cards
  const suggestionCards = [
    {
      title: "Summarize my learning",
      description: "so far, what have I covered and how well?",
    },
    {
      title: "Improve my speaking skills",
      description: "where am I lacking and how to fix it?",
    },
    {
      title: "Show me my mistakes",
      description: "and how I can improve them.",
    },
  ];

  // Data for navigation items
  const navItems = [
    {
      active: true,
      icon: "/dashboard.svg",
      bgClass: "bg-[url(/dashboard.svg)]",
    },
    { active: false, icon: "/frame-3.svg" },
    { active: false, icon: "/docs-icon.svg" },
    {
      active: false,
      icon: "/reference-material.svg",
      bgClass: "bg-[url(/reference-material.svg)]",
    },
    { active: false, icon: "/vector.svg" },
  ];

  return (
    <div className="w-full min-h-screen bg-white overflow-hidden relative">
      <div className="relative w-full min-h-screen">
        {/* Background elements */}
        <div className="absolute w-[40vw] h-[40vw] max-w-[753px] max-h-[753px] top-[-20vh] right-[-30vw] bg-[#566fe9] rounded-full" />
        <div className="absolute w-[25vw] h-[25vw] max-w-[353px] max-h-[353px] bottom-[-25vh] left-[-10vw] bg-[#336de6] rounded-full" />

        {/* Main content container with backdrop blur */}
        <div className="absolute inset-0 bg-[#ffffff99] backdrop-blur-[200px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(200px)_brightness(100%)]">
          <img
            className="absolute w-full  max-w-[1336px] h-[90vh] top-6 left-1/2 -translate-x-1/2 opacity-50 "
            alt="Union"
            src="/union.svg"
          />
        </div>

        {/* Left sidebar navigation - hover to show */}
        <div className="group fixed left-0 top-0 h-full z-20 w-4"> {/* Adjust w-4 for hover area size */}
          <nav className="flex flex-col h-full items-center justify-between px-1.5 py-3.5 absolute left-0 top-0 z-10 opacity-0 -translate-x-full group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-in-out">
            {/* Logo */}
            <div className="flex w-[28.1px] h-7 items-start gap-[0.47px] px-[2.38px] py-0">
              <img className="w-[23.29px] h-7" alt="Logo" src="/final-logo.png" />
            </div>

            {/* Navigation icons */}
            <div className="flex flex-col items-start gap-3">
              {navItems.map((item, index) => (
                <Button
                  key={index}
                  variant={item.active ? "default" : "ghost"}
                  size="icon"
                  className={`p-2.5 ${
                    item.active ? "bg-[#566fe9]" : ""
                  } rounded-[100px] w-12 h-12`}
                >
                  {item.bgClass ? (
                    <div className={`${item.bgClass} w-6 h-6 bg-[100%_100%]`} />
                  ) : (
                    <img
                      className="w-6 h-6"
                      alt="Navigation icon"
                      src={item.icon}
                    />
                  )}
                </Button>
              ))}
            </div>

            {/* Spacer element */}
            <div className="w-[28.1px] h-7 opacity-0">
              <img
                className="w-[23.29px] h-7"
                alt="Logo"
                src="/final-logo-1.png"
              />
            </div>
          </nav>
        </div>

        {/* Suggestion cards */}
        <div className="absolute top-[25vh] sm:top-[30vh] left-1/2 -translate-x-1/2 w-full max-w-[90vw] px-4">
          <div className="flex items-center justify-center gap-3 lg:gap-[11px]">
            {suggestionCards.map((card, index) => (
              <Card
                key={index}
                className="flex-col items-start gap-2.5 pt-3 pb-4 px-4 rounded-2xl border-none [background:linear-gradient(357deg,rgba(255,255,255,0)_0%,rgba(86,111,233,0.2)_100%)] 
                           w-[200px] sm:w-[220px] lg:w-[240px] 
                           h-[120px] sm:h-[130px] lg:h-[150px]
                           flex-shrink-0"
              >
                <CardContent className="flex flex-col items-start gap-2 p-0 h-full justify-between">
                  <h3 className="font-label-large font-[number:var(--label-large-font-weight)] text-black text-[length:var(--label-large-font-size)] tracking-[var(--label-large-letter-spacing)] leading-[var(--label-large-line-height)]">
                    {card.title}
                  </h3>
                  <p className="font-normal text-black text-xs sm:text-sm tracking-[0] leading-normal font-['Plus_Jakarta_Sans',Helvetica] flex-1">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* AI Assistant message */}
        <div className="absolute bottom-[11rem] sm:bottom-[11rem] lg:bottom-[11rem] left-1/2 -translate-x-1/2 inline-flex items-center justify-center gap-2.5 px-4 sm:px-5 py-2.5 bg-[#566fe91a] rounded-[50px] max-w-[90vw] backdrop-blur-sm">
          <p className="font-paragraph-extra-large font-[number:var(--paragraph-extra-large-font-weight)] text-black text-[length:var(--paragraph-extra-large-font-size)] text-center tracking-[var(--paragraph-extra-large-letter-spacing)] leading-[var(--paragraph-extra-large-line-height)] text-sm sm:text-base">
            Hello. I am Rox, your AI Assistant!
          </p>
        </div>
        
        {/* Avatar/Logo element */}
        <div className="absolute bottom-[5rem] sm:bottom-[5rem] lg:bottom-[ 5rem] left-1/2 -translate-x-1/2 w-16 h-16 sm:w-20 sm:h-20 lg:w-[90px] lg:h-[90px] z-20">
          <div className="relative w-full h-full">
            <div className="absolute w-[70%] h-[70%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#566fe9] rounded-full blur-[30px] sm:blur-[40px] lg:blur-[50px]" />
            <img
              className="absolute w-full h-full top-0 left-0 object-contain"
              alt="Rox AI Assistant"
              src="/screenshot-2025-06-09-at-2-47-05-pm-2.png"
            />
          </div>
        </div>

        {/* 
          MODIFICATION: 
          The control buttons and the chat input are now in a single container.
          A conditional check on `isPopupVisible` swaps between the two UIs.
          This makes the chat input appear in the same central location as the controls.
        */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-20">
          {!isPopupVisible ? (
            // Initial controls view
            <div className="flex items-center justify-center gap-x-8 w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px] mx-auto">
              <MicButton isVisible={!isPopupVisible} />
              <div className="w-16 sm:w-20 lg:w-[90px]"></div> {/* Spacer for the avatar */}
              <div className="-mr-1"> {/* Wrapper to shift MessageButton left */}
              <MessageButton isVisible={!isPopupVisible} />
            </div>
            </div>
          ) : (
            <div className="w-full relative left-22"> {/* Wrapper to apply the shift, ensuring full width */}
              {/* Chat input view (replaces the controls) */}
              <div className="flex items-center gap-2 w-full p-2 rounded-full bg-white/80 backdrop-blur-lg shadow-md border border-gray-200/80"> {/* ml-4 removed from here */}
                <input
                  type="Can you tell me about my course summary and course insights till now?"
                  defaultValue="Can you tell me about my course summary and course insights till now?"
                  className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 px-2 text-black text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  className="flex-shrink-0 bg-[#566fe9] hover:bg-[#4a5fcf] rounded-full w-9 h-9"
                  onClick={() => {
                    console.log("Message Sent!");
                    setIsPopupVisible(false); // Hide input and show controls again
                  }}
                >
                  <img className="w-5 h-5" alt="Send" src="/send.svg" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};