'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';
import dynamic from 'next/dynamic';
// Import CSS normally - CSS modules in Next.js are handled specially
import styles from './profile.module.css';
import userProgressApi from '@/api/mockUserProgressService';
import UserStatus from '@/components/UserStatus';

function UserProfileContent() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{name?: string, email?: string, userId?: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState<string>('');
  
  // Sample user data (would come from backend in a real app)
  const userData = {
    firstName: 'Jahnavi',
    lastName: 'Sharma',
    email: 'jessicah@gmail.com',
    phoneNumber: '+91 8329050593',
    education: 'B. tech in Information Technology',
    country: 'India',
    state: 'Rajasthan',
    city: 'Jaipur'
  };

  useEffect(() => {
    // Fetch user data from the user progress service
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Try to get user profile from token
        const token = localStorage.getItem('token');
        setAuthToken(token || '');
        
        if (token) {
          try {
            const profileData = await userProgressApi.getUserProfile();
            setUserProfile(profileData);
            setError(''); // Clear any previous errors
          } catch (err) {
            console.error('Error fetching user profile:', err);
            // Use demo data instead of showing error
            setUserProfile({
              userId: 'demo-user',
              name: `${userData.firstName} ${userData.lastName}`,
              email: userData.email
            });
          }
        } else {
          // For demo purposes, just use the sample data instead of redirecting
          setUserProfile({
            userId: 'demo-user',
            name: `${userData.firstName} ${userData.lastName}`,
            email: userData.email
          });
          console.log('No authentication token found, using demo data');
        }
      } catch (err) {
        console.error('Error in user profile flow:', err);
        // Still use the demo data even if there's an error
        setUserProfile({
          userId: 'demo-user',
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [router, userData.firstName, userData.lastName, userData.email]);

  const goBack = () => {
    router.push('/roxpage');
  };

  return (
    <div className={styles.profilePage}>
      {/* Background elements */}
      <div className={styles.backgroundElements}>
        <div className={styles.ellipse3}></div>
        <div className={styles.ellipse4}></div>
        <div className={styles.rectangle3996}></div>
      </div>
      
      {/* Main container */}
      <div className={styles.mainContainer}>
        {/* Navigation rail */}
        <div className={styles.navigationRail}>
          <div className={styles.logoContainer}>
            <Image 
              src="/shodh-logo.png" 
              alt="Shodh AI Logo" 
              width={24} 
              height={28} 
              className={styles.logo}
            />
          </div>
          
          <div className={styles.navButtons}>
            <button className={styles.navButton} onClick={goBack}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 22V12h6v10" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className={styles.navButton}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
              </svg>
            </button>
            <button className={styles.navButton}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3V2z"></path>
              </svg>
            </button>
            <button className={styles.navButton}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </button>
            <button className={`${styles.navButton} ${styles.activeNavButton}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          </div>
        </div>
        
        <h1 className={styles.pageTitle}>User Profile</h1>
        
        {/* Profile content container */}
        <div className={styles.profileContentContainer}>
          {loading ? (
            <div className={styles.loadingMessage}>Loading profile data...</div>
          ) : error ? (
            <div className={styles.errorMessage}>{error}</div>
          ) : (
            <div className={styles.profileContent}>
              {/* Left panel - User info and skills */}
              <div className={styles.leftPanel}>
                <div className={styles.userPhotoContainer}>
                  <div className={styles.userPhoto}>
                    <Image
                      src="/profilepic.jpg" 
                      alt="User profile" 
                      width={150} 
                      height={150} 
                      className={styles.profileImage}
                      onError={(e) => {
                        // Fallback for missing profile image
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/150?text=Profile';
                      }}
                    />
                    <button className={styles.editPhotoButton}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </div>
                  <div className={styles.userName}>{userProfile?.name || `${userData.firstName} ${userData.lastName}`}</div>
                </div>
                
                {authToken ? (
                  <UserStatus token={authToken} />
                ) : (
                  <div className={styles.noAuth}>Sign in to view your skills</div>
                )}
              </div>
              
              {/* Right panel - User details form */}
              <div className={styles.rightPanel}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>First name</label>
                  <div className={styles.formInput}>
                    <span>{userData.firstName}</span>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Last name</label>
                  <div className={styles.formInput}>
                    <span>{userData.lastName}</span>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email</label>
                  <div className={styles.formInput}>
                    <span>{userProfile?.email || userData.email}</span>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Phone Number</label>
                  <div className={styles.formInput}>
                    <span>{userData.phoneNumber}</span>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Education</label>
                  <div className={styles.formInput}>
                    <span>{userData.education}</span>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Country</label>
                  <div className={styles.formInput}>
                    <span>{userData.country}</span>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>State</label>
                  <div className={styles.formInput}>
                    <span>{userData.state}</span>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>City</label>
                  <div className={styles.formInput}>
                    <span>{userData.city}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <ProtectedRoute>
      <UserProfileContent />
    </ProtectedRoute>
  );
}
