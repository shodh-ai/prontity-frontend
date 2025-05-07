'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { XIcon } from 'lucide-react';
import { useSession } from 'next-auth/react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function PracticePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [progress] = useState(35);
  const [wordCount, setWordCount] = useState(0);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [transcription, setTranscription] = useState('');
  const [timer, setTimer] = useState('05m : 00s');
  
  // Handle recording state changes
  const startRecording = () => {
    setRecordingState('recording');
    // In a real implementation, you would start recording here
  };
  
  const stopRecording = () => {
    if (recordingState === 'recording') {
      setRecordingState('paused');
      // In a real implementation, you would pause recording here
    }
  };
  
  // Handle close button click
  const handleClose = () => {
    router.push('/roxpage');
  };
  
  // Update word count based on transcription
  useEffect(() => {
    if (transcription.trim() === '') {
      setWordCount(0);
    } else {
      setWordCount(transcription.trim().split(/\s+/).length);
    }
  }, [transcription]);

  return (
    <ProtectedRoute>
      <div className="w-full h-screen bg-white overflow-hidden flex justify-center items-center">
        <div className="relative w-[1440px] h-[820px]">
          {/* Background elements */}
          <div className="absolute w-[753px] h-[753px] top-0 right-0 bg-[#566fe9] rounded-[376.5px] opacity-70" />
          <div className="absolute w-[353px] h-[353px] bottom-0 left-0 bg-[#336de6] rounded-[176.5px] opacity-70" />
          <div className="absolute w-full h-full bg-[#ffffff99] backdrop-blur-[200px] backdrop-brightness-[100%]" />

          {/* Main content card */}
          <div className="absolute w-[1280px] h-[740px] top-[40px] left-[80px] rounded-xl border-none bg-white shadow-lg">
            <div className="p-0 h-full flex flex-col">
              {/* Header with title and close button */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="font-semibold text-black text-base leading-6">
                  New Practice Session
                </div>
                <button 
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <XIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="px-4 py-2">
                <div className="h-2.5 w-full bg-gray-200 rounded-full">
                  <div 
                    className="h-full bg-[#566fe9] rounded-full" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Main content area */}
              <div className="p-6 flex-grow overflow-auto">
                {/* Topic section */}
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-black/60 mb-3">Topic</h2>
                  <div className="text-lg text-black leading-7">
                    Practice your speaking skills by discussing your favorite hobby or interest. What makes it enjoyable for you and how did you get started with it?
                  </div>
                </div>

                {/* Timer and recording controls */}
                <div className="flex gap-5 mb-6">
                  {/* Preparation time */}
                  <div>
                    <h3 className="text-base font-semibold text-black/60 mb-3">Preparation time</h3>
                    <div className="inline-flex h-12 items-center px-4 py-3 bg-white rounded-md border border-[#566fe9]">
                      <span className="font-semibold text-[#566fe9] text-xl">{timer}</span>
                    </div>
                  </div>

                  {/* Recording controls */}
                  <div>
                    <h3 className="text-base font-semibold text-black/60 mb-3">Record your answer</h3>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={startRecording}
                        className={`w-12 h-12 p-3 rounded-md flex items-center justify-center ${recordingState === 'recording' ? 'bg-red-500' : 'bg-[#566fe9]'}`}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 15C13.6569 15 15 13.6569 15 12V6C15 4.34315 13.6569 3 12 3C10.3431 3 9 4.34315 9 6V12C9 13.6569 10.3431 15 12 15Z" fill="white"/>
                          <path d="M5 12C5 15.866 8.13401 19 12 19C15.866 19 19 15.866 19 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M12 19V22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                      <button 
                        onClick={stopRecording}
                        className={`w-12 h-12 p-3 rounded-md border ${recordingState === 'recording' ? 'border-red-500 text-red-500' : 'border-[#566fe9] text-[#566fe9]'} flex items-center justify-center`}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="6" y="6" width="12" height="12" rx="1" fill={recordingState === 'recording' ? '#EF4444' : '#566FE9'}/>
                        </svg>
                      </button>
                      <div className="relative w-[492px] h-[15px]">
                        <div className="absolute w-full h-[5px] top-[5px] bg-[#566fe933] rounded-md" />
                        <div 
                          className="absolute h-[5px] top-[5px] bg-[#566fe9] rounded-md" 
                          style={{ width: recordingState === 'recording' ? '40%' : '0%' }}
                        />
                        <div 
                          className="absolute w-[15px] h-[15px] top-0 bg-[#647aeb] rounded-full" 
                          style={{ left: recordingState === 'recording' ? '40%' : '0%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Response area */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base font-semibold text-black/60">Your Response</h3>
                    <div className="text-[#566fe9] font-semibold">Word Count: {wordCount}</div>
                  </div>

                  <div className="w-full h-[280px] overflow-auto border border-gray-200 rounded-lg">
                    <div className="p-3.5">
                      {transcription ? (
                        <p className="text-base text-black leading-6">{transcription}</p>
                      ) : (
                        <p className="text-base text-black/50 leading-6">
                          Your response will appear here as you speak...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom control buttons */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button className="w-12 h-12 p-3 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15C13.6569 15 15 13.6569 15 12V6C15 4.34315 13.6569 3 12 3C10.3431 3 9 4.34315 9 6V12C9 13.6569 10.3431 15 12 15Z" fill="#566FE9"/>
                    <path d="M5 12C5 15.866 8.13401 19 12 19C15.866 19 19 15.866 19 12" stroke="#566FE9" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M12 19V22" stroke="#566FE9" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="w-12 h-12 p-3 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 10L19.5528 7.72361C20.2177 7.39116 21 7.87465 21 8.61803V15.382C21 16.1253 20.2177 16.6088 19.5528 16.2764L15 14M5 18H13C14.1046 18 15 17.1046 15 16V8C15 6.89543 14.1046 6 13 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18Z" stroke="#566FE9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="w-12 h-12 p-3 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.68377 10.7837C8.88791 10.5796 9.20449 10.5796 9.40863 10.7837L12 13.375L14.5914 10.7837C14.7955 10.5796 15.1121 10.5796 15.3162 10.7837C15.5204 10.9878 15.5204 11.3044 15.3162 11.5085L12.3624 14.4623C12.1583 14.6664 11.8417 14.6664 11.6376 14.4623L8.68377 11.5085C8.47963 11.3044 8.47963 10.9878 8.68377 10.7837Z" fill="#566FE9"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 17.1086 6.89137 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12Z" fill="#566FE9"/>
                  </svg>
                </button>
                <button className="w-12 h-12 p-3 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.9999 2.75021C6.89111 2.75021 2.74963 6.89169 2.74963 12.0005C2.74963 17.1093 6.89111 21.2508 11.9999 21.2508C17.1086 21.2508 21.2501 17.1093 21.2501 12.0005C21.2501 6.89169 17.1086 2.75021 11.9999 2.75021ZM1.24963 12.0005C1.24963 6.06343 6.06279 1.25021 11.9999 1.25021C17.937 1.25021 22.7501 6.06343 22.7501 12.0005C22.7501 17.9376 17.937 22.7508 11.9999 22.7508C6.06279 22.7508 1.24963 17.9376 1.24963 12.0005Z" fill="#566FE9"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.1421 7.89959C11.1421 7.48538 11.4779 7.14959 11.8921 7.14959H12.1088C12.523 7.14959 12.8588 7.48538 12.8588 7.89959V12.8996C12.8588 13.3138 12.523 13.6496 12.1088 13.6496H11.8921C11.4779 13.6496 11.1421 13.3138 11.1421 12.8996V7.89959Z" fill="#566FE9"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.1421 16.1004C11.1421 15.6862 11.4779 15.3504 11.8921 15.3504H12.1088C12.523 15.3504 12.8588 15.6862 12.8588 16.1004V16.1004C12.8588 16.5146 12.523 16.8504 12.1088 16.8504H11.8921C11.4779 16.8504 11.1421 16.5146 11.1421 16.1004V16.1004Z" fill="#566FE9"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
