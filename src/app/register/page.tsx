"use client";

import Image from "next/image";
import { useState, FormEvent } from "react";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Simulate API call with 10 second delay
      await new Promise((resolve) => setTimeout(resolve, 10000));
      console.log("Registration successful");
    } catch (err: any) {
      setError(err.message || "An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center flex-col p-4">
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
      {/* Registration Form */}
      <form
        className="flex flex-col mt-4 sm:mt-6 w-full max-w-md"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-3 sm:gap-5 p-4 sm:p-6 w-full max-w-md mx-auto">
          <input
            type="email"
            placeholder="email"
            className="h-10 sm:h-12 border border-[rgba(0,0,0,0.2)] rounded-xl px-3 sm:px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:[color:#717171] text-sm sm:text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="password"
            className="h-10 sm:h-12 border border-[rgba(0,0,0,0.2)] rounded-xl px-3 sm:px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:[color:#717171] text-sm sm:text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-[#566FE9] text-white h-10 sm:h-12 rounded-xl font-medium hover:bg-[#566FE9]/95 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register"}
          </button>
          {error && (
            <div className="text-red-500 text-xs sm:text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </form>
      <hr className="w-full max-w-md border-[#566FE9] my-1 sm:my-2" />
      {/* Other options */}
      <div className="flex flex-col w-full max-w-md items-center justify-center gap-1 sm:gap-2">
        <div className="text-xs sm:text-sm">Sign up with</div>
        <div className="flex flex-wrap justify-center gap-2">
          <div className="flex flex-row gap-1 sm:gap-2 bg-white rounded-full border border-[rgba(86,111,233,0.3)] p-2 sm:p-3 cursor-pointer text-xs sm:text-sm">
            <Image
              src="/google.png"
              alt="Google"
              height={24}
              width={24}
              className="h-4 w-4 sm:h-6 sm:w-6"
            />
            Google
          </div>
          <div className="flex flex-row gap-1 sm:gap-2 bg-white rounded-full border border-[rgba(86,111,233,0.3)] p-2 sm:p-3 cursor-pointer text-xs sm:text-sm">
            <Image
              src="/apple.png"
              alt="Apple"
              height={24}
              width={22}
              className="h-4 w-4 sm:h-6 sm:w-6"
            />
            Apple
          </div>
          <div className="flex flex-row gap-1 sm:gap-2 bg-white rounded-full border border-[rgba(86,111,233,0.3)] p-2 sm:p-3 cursor-pointer text-xs sm:text-sm">
            <Image
              src="/facebook.png"
              alt="Facebook"
              height={24}
              width={24}
              className="h-4 w-4 sm:h-6 sm:w-6"
            />
            Facebook
          </div>
        </div>
      </div>
    </div>
  );
}
