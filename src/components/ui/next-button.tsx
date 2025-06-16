"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface NextButtonProps {
  isVisible: boolean;
  onNext: () => void;
}

export function NextButton({
  isVisible,
  onNext,
}: NextButtonProps): JSX.Element | null {
  if (!isVisible) {
    return null;
  }

  return (
    <Button
      onClick={onNext}
      variant="outline"
      size="icon"
      className="w-14 h-14 p-4 bg-[#566fe91a] rounded-[36px] border-none hover:bg-[#566fe930] transition-colors"
    >
      {/* Replaced the SVG with an img tag */}
      <img src="/next.svg" alt="Next" className="w-6 h-6" />
    </Button>
  );
}