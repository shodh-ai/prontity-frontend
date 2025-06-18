import Image from "next/image";

export default function ShodhAIHero() {
  return (
    <div className="flex flex-col justify-center items-center gap-2 sm:gap-3">
      <Image
        src="/logo-full.png"
        alt="Shodh Logo"
        height={42}
        width={176}
        className="h-auto w-[150px] sm:w-[176px]"
      />
      <div className="text-xs sm:text-sm text-center">
        AI-Powered Insights for Smarter Learning.
      </div>
    </div>
  );
}
