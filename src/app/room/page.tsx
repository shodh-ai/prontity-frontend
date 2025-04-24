'use client';

import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';

export default function Page() {
  const router = useRouter();
  
  // Room configuration
  const roomName = 'quickstart-room';
  const userName = 'quickstart-user';
  
  // The practice question for this specific room
  const questionText = "With the rise of automation and artificial intelligence, there is a growing concern about the future of jobs and the relevance of traditional education. What measures do you think should be taken to ensure that education remains effective in preparing individuals for the workforce?";
  
  // Handle leaving the room
  const handleLeave = () => {
    router.push('/');
  };

  return (
    <div className="page-wrapper">
      <LiveKitSession
        roomName={roomName}
        userName={userName}
        questionText={questionText}
        sessionTitle="Speaking Practice Session"
        onLeave={handleLeave}
      />
    </div>
  );
}