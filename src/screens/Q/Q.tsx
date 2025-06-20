"use client";
import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { MessageButton } from "../../components/ui/message-button";
import { MicButton } from "../../components/ui/mic";

export const Q = (): JSX.Element => {
  // REMOVED: State to manage the pop-up/chat input is no longer needed.
  // const [isPopupVisible, setIsPopupVisible] = useState(false);

  // Data for suggestion cards remains as it is specific to this page
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

  const handleMessageClick = () => {
    // TODO: Add the functionality for the message button here.
    // For example, opening a chat modal or sending a predefined query.
    console.log("Message button clicked!");
  };

  return (
    <div>
      {/* Sidebar */}
      <div className="group fixed left-0 top-0 h-full z-20 w-4">
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
        <div className="flex flex-wrap items-center justify-center gap-4">
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

      {/* Bottom controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-20">
        {/*
          MODIFIED: Removed the conditional rendering. The view with both buttons is now permanent.
        */}
        <div className="flex items-center justify-between w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px] mx-auto">
          <MicButton isVisible={true} />
          <MessageButton isVisible={true} onClick={handleMessageClick} />
        </div>
      </div>
    </div>
  );
};