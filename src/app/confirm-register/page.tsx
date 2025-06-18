"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ShodhAIHero from "@/components/common/ShodhAIHero";

export default function ConfirmRegister() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/registration-test");
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleContinue = () => {
    router.push("/registration-test");
  };

  return (
    <div className="w-full h-full flex items-center justify-center flex-col p-4 md:p-6 gap-6 md:gap-8">
      <ShodhAIHero />
      <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-md text-center">
        <div className="font-semibold text-2xl sm:text-3xl md:text-4xl leading-[130%] tracking-tight text-[#566FE9]">
          Account Created!
        </div>
        <div className="text-sm sm:text-base text-gray-700">
          You will be redirected to your registration test in a few seconds.
        </div>
      </div>
      <button
        onClick={handleContinue}
        className="w-full max-w-md h-10 sm:h-12 bg-[#566FE9] hover:bg-[#4a5fcf] transition-colors rounded-full text-white text-sm sm:text-base font-semibold"
      >
        Continue
      </button>
    </div>
  );
}
