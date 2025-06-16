'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import styles from './login.module.css';
// Import only Pronity API for authentication
import { login as pronityLogin, PronityApiError, AuthResponse, fetchUserProfile, User } from '@/api/pronityClient';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams ? searchParams.get('error') : null;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<{name?: string, email?: string} | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Check if user is already logged in (token exists)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token by getting user profile using Pronity API
      fetchUserProfile(token)
        .then(data => {
          setIsLoggedIn(true);
          setUserProfile(data);
        })
        .catch((error) => {
          // Token invalid or expired
          console.error('Token validation error:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsLoggedIn(false);
        });
    }
    
    // Handle error query params
    if (error) {
      setErrorMessage('An error occurred during sign in');
    }
  }, [error]);

  // Add function to logout current user
  const handleLogout = () => {
    // Remove token and user data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUserProfile(null);
    setErrorMessage('You have been logged out. Please log in again.');
  };

  // Function to manually navigate to main page
  const goToMainPage = () => {
    router.push('/rox');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    console.log('Attempting login with:', { email }); // Debug login attempt
    
    try {
      // Sign in with Pronity backend
      const credentials = { email, password };
      console.log('Using API URL:', window.location.origin); // Show base URL for debugging
      const result = await pronityLogin(credentials);
      console.log('Login successful, got token:', result.token ? 'token-received' : 'no-token'); // Debug token receipt
      
      // Store token and user info in localStorage
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      console.log('Saved token to localStorage');
      
      setIsLoggedIn(true);
      setUserProfile(result.user);
      console.log('Redirecting to main page');
      router.push('/rox');
    } catch (err: any) {
      let errorMsg = 'Invalid email or password';
      
      console.error('Login failed with error:', err); // More detailed error logging
      
      if (err instanceof PronityApiError) {
        console.error('Pronity API error:', { message: err.message, statusCode: err.statusCode });
        errorMsg = err.message;
        
        // Add more user-friendly messages for specific error codes
        if (err.statusCode === 401) {
          errorMsg = 'Invalid email or password';
        } else if (err.statusCode === 404) {
          errorMsg = 'User not found. Please register first.';
        } else if (err.statusCode >= 500) {
          errorMsg = 'Server error. Please try again later.';
        }
      } else {
        // Handle network errors better
        errorMsg = `Connection error: ${err.message}. Please check if the backend server is running.`;
      }
      
      setErrorMessage(errorMsg);
      setIsLoading(false);
    }
  };

  // Handle social media login - would need to be implemented in Pronity backend
  // For now, we'll keep the UI but show an alert that it's not implemented
  const handleSocialLogin = async (provider: string) => {
    setErrorMessage(`Social login with ${provider} is not yet implemented in the Pronity backend`);
    // Future implementation would connect to the appropriate endpoint
  };

  return (
    <div className={styles.loginPage}>
      {/* Background elements */}
      <div className={styles.group1000010987}>
        <div className={styles.ellipse3}></div>
        <div className={styles.ellipse4}></div>
        <div className={styles.rectangle3996}></div>
      </div>
      
      {/* Main card container */}
      <div className={styles.rectangle3934}>
        {/* Left side - Image */}
        <div className={styles.imageContainer}>
          <Image 
            src="/login-image.jpg" 
            alt="Login" 
            fill 
            className={styles.loginImage}
            priority
          />
        </div>
        
        {/* Right side - Login form */}
        <div className={styles.group1000010988}>
          <div className={styles.formEllipse3}></div>
          <div className={styles.formEllipse4}></div>
          <div className={styles.formRectangle3996}></div>
          
          {/* Login form content */}
          <div className={styles.frame1000011209}>
            {/* Logo and tagline */}
            <div className={styles.frame1000011149}>
              <div className={styles.group31}>
                <div className={styles.frame11}>
                  <div className={styles.finalLogo} style={{ textAlign: 'center', padding: '0', maxWidth: '100%' }}>
                    {isLoggedIn && userProfile ? (
                      <div style={{ width: '175.5px', height: '42px', position: 'relative', margin: '0 auto' }}>
                        <Image
                          src={`/shodh-logo.png?v=${new Date().getTime()}`} 
                          alt="Shodh AI Logo"
                          fill
                          priority
                          style={{ objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div style={{ width: '175.5px', height: '42px', position: 'relative', margin: '0 auto' }}>
                        <Image
                          src={`/shodh-logo.png?v=${new Date().getTime()}`} 
                          alt="Shodh AI Logo"
                          fill
                          priority
                          style={{ objectFit: 'contain' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className={styles.tagline} style={{ width: '279px', height: '21px', margin: '0 auto' }}>AI-Powered Insights for Smarter Learning.</p>
            </div>
            
            {/* Form fields */}
            <div className={styles.frame1000011208}>
              <div className={styles.frame1000011207}>
                {/* Show authenticated user info if logged in */}
                {isLoggedIn && userProfile ? (
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <p style={{ marginBottom: '10px' }}>You are logged in as {userProfile.name || userProfile.email}</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <button
                        onClick={goToMainPage}
                        className={styles.primaryButton}
                        style={{ marginTop: '10px', flex: '1' }}
                      >
                        <span className={styles.buttonLabel}>Go to Main Page</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className={styles.primaryButton}
                        style={{ marginTop: '10px', flex: '1', background: '#f44336' }}
                      >
                        <span className={styles.buttonLabel}>Logout</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <form onSubmit={handleSubmit} className={styles.frame1000011206}>
                      {/* Welcome text removed */}
                      <div className={styles.frame1000011144}>
                        <div className={styles.frame146}>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email"
                            className={styles.emailInput}
                            disabled={isLoading}
                          />
                        </div>
                        
                        <div className={styles.frame144}>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="password"
                            className={styles.passwordInput}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={styles.primaryButton}
                      >
                        <span className={styles.buttonLabel}>{isLoading ? 'Logging in...' : 'Login'}</span>
                      </button>
                    </form>
                    
                    {/* Divider */}
                    <div className={styles.line1}></div>
                    
                    {/* Social login */}
                    <div className={styles.frame1000011204}>
                      <p className={styles.loginWith}>Login with</p>
                      
                      <div className={styles.frame1000011203}>
                        <button
                          onClick={() => handleSocialLogin('Google')}
                          disabled={isLoading}
                          className={styles.frame1000010992}
                        >
                          <svg className={styles.googleIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" style={{ minWidth: '24px', minHeight: '24px', display: 'block' }}>
                            <path d="M21.9 12.1h-10v3.9h5.7c-.5 2.5-2.6 4.3-5.7 4.3-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.5 0 2.9.5 4 1.4l2.9-2.9C16.9 4.3 14.6 3.3 12 3.3c-4.9 0-8.9 4-8.9 8.9s4 8.9 8.9 8.9c7.2 0 8.9-6.3 8.2-9h-9.2z" fill="#566FE9" />
                          </svg>
                          <span className={styles.socialLabel}>Google</span>
                        </button>
                        
                        <button
                          onClick={() => handleSocialLogin('Apple')}
                          disabled={isLoading}
                          className={styles.frame1000011201}
                        >
                          <svg className={styles.appleIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" style={{ minWidth: '24px', minHeight: '24px', display: 'block' }}>
                            <path d="M17.5 12.5c0-3.5 2.9-4.1 3-4.2-1.6-2.4-4.2-2.7-5.1-2.7-2.2-.2-4.3 1.3-5.4 1.3-1.1 0-2.8-1.3-4.6-1.2-2.4 0-4.5 1.4-5.7 3.5-2.5 4.2-.6 10.5 1.7 13.9 1.2 1.7 2.6 3.5 4.4 3.5 1.8 0 2.4-1.1 4.6-1.1 2.1 0 2.7 1.1 4.6 1.1 1.9 0 3.1-1.7 4.3-3.4.8-1.2 1.5-2.5 1.9-3.9-3.3-1.2-4.7-5.9-4.7-7.8z" fill="#566FE9" />
                            <path d="M14.5 4c1-.4 1.8-1.4 2.1-2.4-1.9.1-4.2 1.3-5.4 2.8-1.1 1.3-2 3.2-1.7 5.1 2 .2 4.1-1.1 5-3.5z" fill="#566FE9" />
                          </svg>
                          <span className={styles.socialLabel}>Apple</span>
                        </button>
                        
                        <button
                          onClick={() => handleSocialLogin('Facebook')}
                          disabled={isLoading}
                          className={styles.frame1000011202}
                        >
                          <svg className={styles.facebookIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" style={{ minWidth: '24px', minHeight: '24px', display: 'block' }}>
                            <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.855v-8.386H7.078V12h3.047V9.356c0-3.007 1.79-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#566FE9" />
                          </svg>
                          <span className={styles.socialLabel}>Facebook</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                
                {errorMessage && <p className="text-red-500 text-center text-sm mb-4">{errorMessage}</p>}
              </div>
              
              {/* Forgot password and Sign up link - only show when not logged in */}
              {!isLoggedIn && (
                <>
                  <p className={styles.forgotPassword}>
                    Forgot your password?
                  </p>
                  
                  <p className={styles.signUpText}>
                    Don&#39;t have a account? <Link href="/signuppage" className="text-[#566FE9]">Sign Up</Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
