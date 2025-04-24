'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LiveKitSession from '@/components/LiveKitSession';

export default function LoginPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Room configuration for secure authentication
  const roomName = 'AuthenticationRoom';
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError('Please enter a username');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Simple auth simulation - in a real app, you'd call an auth API
      setTimeout(() => {
        // Store user info in localStorage or use a proper state management solution
        localStorage.setItem('userName', userName);
        
        // Redirect to main page
        router.push('/roxpage');
        setIsLoading(false);
      }, 1000);
    } catch (err) {
      setError('Authentication failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle exiting the login page
  const handleLeave = () => {
    router.push('/');
  };

  return (
    <div className="page-wrapper">
      <div className="login-container">
        <h1>Login to TOEFL Practice</h1>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your username"
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
      
      {/* Use LiveKitSession with login page specific settings */}
      <div style={{ display: 'none' }}>
        <LiveKitSession
          roomName={roomName}
          userName={userName || 'guest-user'}
          pageType="login"
          hideAudio={true}
          hideVideo={true}
          aiAssistantEnabled={false}
          onLeave={handleLeave}
        />
      </div>
    </div>
  );
}
