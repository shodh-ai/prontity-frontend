'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';

export default function ReflectionPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [reflections, setReflections] = useState('');
  
  // Room configuration
  const roomName = 'ReflectionSession';
  
  // Reflection prompt
  const reflectionPrompt = "Let's reflect on your practice session. What did you learn? What areas do you feel confident about, and where would you like to improve?";
  
  // Get username from localStorage when component mounts
  useEffect(() => {
    const storedUserName = localStorage.getItem('userName');
    if (storedUserName) {
      setUserName(storedUserName);
    } else {
      // Redirect to login if no username found
      router.push('/loginpage');
    }
  }, [router]);

  // Handle leaving the room
  const handleLeave = () => {
    router.push('/roxpage');
  };

  // Custom reflection form component
  const ReflectionForm = () => (
    <div className="reflection-container">
      <textarea
        className="reflection-textarea"
        value={reflections}
        onChange={(e) => setReflections(e.target.value)}
        placeholder="Write your reflections here..."
        style={{
          width: '100%',
          minHeight: '200px',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          fontSize: '16px',
          lineHeight: '1.5',
          marginBottom: '15px'
        }}
      />
      
      <div className="reflection-rating">
        <h4>Rate your confidence (1-5):</h4>
        <div className="rating-buttons" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button 
              key={rating} 
              className="rating-button"
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc'
              }}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>
      
      <button 
        className="submit-reflection"
        style={{
          padding: '10px 20px',
          backgroundColor: '#566FE9',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          marginTop: '15px',
          cursor: 'pointer'
        }}
        onClick={() => alert("Reflection submitted successfully!")}
      >
        Submit Reflection
      </button>
    </div>
  );

  return (
    <div className="page-wrapper">
      <LiveKitSession
        roomName={roomName}
        userName={userName || 'student-user'}
        questionText={reflectionPrompt}
        sessionTitle="Reflection Session"
        pageType="reflection"
        customControls={<ReflectionForm />}
        onLeave={handleLeave}
        aiAssistantEnabled={true}
      />
    </div>
  );
}
