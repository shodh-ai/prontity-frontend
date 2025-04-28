"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">TOEFL Practice</h1>
        <p className="text-gray-600">Choose a section to practice</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full px-4">
        <Link 
          href="/roxpage" 
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-blue-600 mb-2">Rox Assistant</h2>
          <p className="text-gray-600">Chat with Rox, your TOEFL practice assistant</p>
        </Link>
        
        <Link 
          href="/speakingpage" 
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-blue-600 mb-2">Speaking Practice</h2>
          <p className="text-gray-600">Practice your speaking skills with guided exercises</p>
        </Link>
        
        <Link 
          href="/writingpage" 
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-blue-600 mb-2">Writing Practice</h2>
          <p className="text-gray-600">Improve your writing with structured practice</p>
        </Link>
        
        <Link 
          href="/vocabpage" 
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-blue-600 mb-2">Vocabulary Practice</h2>
          <p className="text-gray-600">Expand your vocabulary through interactive exercises</p>
        </Link>
      </div>
      
      <div className="mt-10">
        <Link 
          href="/loginpage" 
          className="text-blue-500 hover:text-blue-700 underline"
        >
          Login Page
        </Link>
      </div>
    </div>
  );
}