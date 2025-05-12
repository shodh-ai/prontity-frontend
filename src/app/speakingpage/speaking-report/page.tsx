'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';
import '@/styles/enhanced-room.css';
import '../figma-styles.css';

// Report data interface
interface ReportData {
  id: string;
  score: number;
  fluency: number;
  pronunciation: number;
  vocabulary: number;
  grammar: number;
  feedback: string;
  transcription: string;
  questionText: string;
  date: string;
}

export default function SpeakingReportPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<{name?: string, email?: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [showLiveKit, setShowLiveKit] = useState(false);
  
  // For LiveKit session
  const roomName = "SpeakingReport";
  const userName = userData?.name || "User";

  // Check authentication status
  useEffect(() => {
    // Check if user is authenticated by looking for token in localStorage
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      setIsAuthenticated(true);
      setUserData(JSON.parse(user));
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  // Fetch report data (mock data for now)
  useEffect(() => {
    // In a real implementation, fetch report data from your backend
    // For now, we'll use mock data
    setTimeout(() => {
      const mockReport: ReportData = {
        id: '1',
        score: 85,
        fluency: 80,
        pronunciation: 85,
        vocabulary: 90,
        grammar: 85,
        feedback: "Your speaking is generally fluent with good use of vocabulary. Work on reducing hesitations and improving pronunciation of certain words. Your grammar is mostly correct, but there are some minor errors in complex sentences.",
        transcription: "I believe that technology has both positive and negative impacts on society. On the positive side, technology has made communication easier and faster. People can now connect with others across the world instantly. Furthermore, technology has improved healthcare, education, and transportation. However, there are also drawbacks. Many people have become dependent on technology, which can lead to social isolation. Additionally, privacy concerns have increased with the widespread use of social media and data collection. In conclusion, while technology offers many benefits, we must be mindful of its potential negative effects.",
        questionText: "Do you think technology has had a positive or negative impact on society? Give reasons and examples to support your opinion.",
        date: "May 12, 2025"
      };
      setReport(mockReport);
      setLoading(false);
    }, 1000);
  }, []);

  // Toggle LiveKit assistant
  const toggleLiveKit = () => {
    setShowLiveKit(!showLiveKit);
  };

  // Handle leaving the LiveKit session
  const handleLiveKitLeave = () => {
    setShowLiveKit(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/loginpage');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Speaking Assessment Report</h1>
      
      {report && (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
          {/* Report header */}
          <div className="bg-blue-600 text-white p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Assessment Report</h2>
              <span className="text-sm">{report.date}</span>
            </div>
            <p className="mt-2 text-blue-100">{report.questionText}</p>
          </div>
          
          {/* Overall score */}
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Overall Score</h3>
              <div className="flex items-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 border-4 border-blue-500 flex items-center justify-center mr-4">
                  <span className="text-2xl font-bold text-blue-700">{report.score}</span>
                </div>
                <div className="text-sm text-gray-500">
                  <div>Excellent: 90-100</div>
                  <div>Good: 75-89</div>
                  <div>Satisfactory: 60-74</div>
                  <div>Needs Improvement: Below 60</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Detailed scores */}
          <div className="p-6 border-b">
            <h3 className="text-lg font-medium mb-4">Skill Breakdown</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fluency */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Fluency</span>
                  <span className="text-sm font-medium">{report.fluency}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${report.fluency}%` }}></div>
                </div>
              </div>
              
              {/* Pronunciation */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Pronunciation</span>
                  <span className="text-sm font-medium">{report.pronunciation}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${report.pronunciation}%` }}></div>
                </div>
              </div>
              
              {/* Vocabulary */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Vocabulary</span>
                  <span className="text-sm font-medium">{report.vocabulary}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${report.vocabulary}%` }}></div>
                </div>
              </div>
              
              {/* Grammar */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Grammar</span>
                  <span className="text-sm font-medium">{report.grammar}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: `${report.grammar}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Feedback */}
          <div className="p-6 border-b">
            <h3 className="text-lg font-medium mb-2">Teacher Feedback</h3>
            <p className="text-gray-700 leading-relaxed">{report.feedback}</p>
          </div>
          
          {/* Transcription */}
          <div className="p-6 border-b">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Your Response (Transcription)</h3>
              <span className="text-xs text-gray-500">Word count: {report.transcription.split(/\s+/).length}</span>
            </div>
            <div className="bg-gray-50 p-4 rounded border text-gray-700 leading-relaxed">
              {report.transcription}
            </div>
          </div>
          
          {/* Speak with AI tutor */}
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Speak with AI Tutor</h3>
            <p className="text-gray-700 mb-4">Practice speaking or ask questions about your assessment with our AI tutor.</p>
            
            <button 
              onClick={toggleLiveKit}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {showLiveKit ? 'Hide AI Tutor' : 'Start Speaking with AI Tutor'}
            </button>
            
            {showLiveKit && (
              <div className="mt-6 border rounded-lg overflow-hidden">
                <LiveKitSession
                  roomName={roomName}
                  userName={userName}
                  sessionTitle="Speaking Practice with AI Tutor"
                  pageType="speaking"
                  onLeave={handleLiveKitLeave}
                  questionText={report.questionText}
                  aiAssistantEnabled={true}
                />
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="flex justify-center space-x-4">
        <button 
          onClick={() => router.push('/speakingpage')}
          className="bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Take Another Test
        </button>
        <button 
          onClick={() => router.push('/')}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
