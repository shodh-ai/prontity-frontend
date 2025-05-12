'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface TestOption {
  id: string;
  title: string;
  description: string;
  path: string;
  status: 'ready' | 'beta' | 'coming-soon';
}

const SpeakingTestNav = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  const testOptions: TestOption[] = [
    {
      id: 'basic',
      title: 'Basic Speaking Practice',
      description: 'Record responses to TOEFL speaking prompts',
      path: '/speakingpage/toefl-practice',
      status: 'ready'
    },
    {
      id: 'enhanced',
      title: 'Enhanced Speaking Test',
      description: 'Real-time transcription & AI grammar feedback',
      path: '/speakingpage/speaking-test-enhanced',
      status: 'beta'
    },
    {
      id: 'mock-test',
      title: 'Full Mock Test',
      description: 'Complete TOEFL speaking section with 6 tasks',
      path: '/speakingpage/mock-test',
      status: 'coming-soon'
    }
  ];
  
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        <h2 className="text-lg font-medium text-gray-900">TOEFL Speaking Practice Options</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose the speaking practice mode that best fits your needs
        </p>
        
        <div className="mt-6 space-y-4">
          {testOptions.map((option) => (
            <div key={option.id} className="relative">
              <Link 
                href={option.status !== 'coming-soon' ? option.path : '#'}
                className={`block px-4 py-4 border rounded-lg hover:border-indigo-300 transition ${
                  pathname === option.path 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-200'
                } ${
                  option.status === 'coming-soon' 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:shadow-sm'
                }`}
                onClick={(e) => {
                  if (option.status === 'coming-soon') {
                    e.preventDefault();
                  }
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-medium text-gray-900">
                      {option.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {option.description}
                    </p>
                  </div>
                  
                  {/* Status badge */}
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    option.status === 'ready' ? 'bg-green-100 text-green-800' :
                    option.status === 'beta' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {option.status === 'ready' ? 'Ready' :
                     option.status === 'beta' ? 'Beta' :
                     'Coming Soon'}
                  </div>
                </div>
                
                {/* Active indicator */}
                {pathname === option.path && (
                  <div className="absolute inset-y-0 left-0 w-1 bg-indigo-600 rounded-l-lg"></div>
                )}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpeakingTestNav;
