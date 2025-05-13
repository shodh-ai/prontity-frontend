'use client';

import { useState, useEffect } from 'react';
import { fetchUserStatus, updateUserStatus, resetUserStatus, UserStatus } from '@/api/pronityClient';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import styles from './status-test.module.css';

function StatusTestContent() {
  const [token, setToken] = useState<string>('');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Input values for updating scores
  const [speakingInput, setSpeakingInput] = useState<number>(0);
  const [writingInput, setWritingInput] = useState<number>(0);
  const [listeningInput, setListeningInput] = useState<number>(0);
  
  // Action results
  const [actionStatus, setActionStatus] = useState<{
    action: string;
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    // Get token from localStorage when component mounts
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      // Fetch status once we have a token
      handleFetchStatus();
    }
  }, []);

  const handleFetchStatus = async () => {
    if (!token) {
      setError('No authentication token found. Please log in first.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setActionStatus(null);
      
      const status = await fetchUserStatus(token);
      setUserStatus(status);
      
      // Update input fields with current values
      setSpeakingInput(status.speaking);
      setWritingInput(status.writing);
      setListeningInput(status.listening);
      
      setActionStatus({
        action: 'Fetch Status',
        success: true,
        message: 'User status fetched successfully'
      });
    } catch (error) {
      console.error('Error fetching status:', error);
      setError(`Failed to fetch status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setActionStatus({
        action: 'Fetch Status',
        success: false,
        message: 'Failed to fetch user status'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!token) {
      setError('No authentication token found. Please log in first.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setActionStatus(null);
      
      const updatedStatus = await updateUserStatus({
        speaking: speakingInput,
        writing: writingInput,
        listening: listeningInput
      }, token);
      
      setUserStatus(updatedStatus);
      
      setActionStatus({
        action: 'Update Status',
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      console.error('Error updating status:', error);
      setError(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setActionStatus({
        action: 'Update Status',
        success: false,
        message: 'Failed to update user status'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetStatus = async () => {
    if (!token) {
      setError('No authentication token found. Please log in first.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setActionStatus(null);
      
      const resetStatus = await resetUserStatus(token);
      setUserStatus(resetStatus);
      
      // Update input fields with reset values
      setSpeakingInput(0);
      setWritingInput(0);
      setListeningInput(0);
      
      setActionStatus({
        action: 'Reset Status',
        success: true,
        message: 'User status reset successfully'
      });
    } catch (error) {
      console.error('Error resetting status:', error);
      setError(`Failed to reset status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setActionStatus({
        action: 'Reset Status',
        success: false,
        message: 'Failed to reset user status'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h1 className={styles.title}>User Status Test Page</h1>
        <p className={styles.description}>
          Use this page to test the user status API functionality.
        </p>
        <Link href="/profilepage" className={styles.link}>
          Go to profile page →
        </Link>
      </div>
      
      {!token && (
        <div className={styles.tokenWarning}>
          No authentication token found. Please <Link href="/loginpage" className={styles.link}>log in</Link> first.
        </div>
      )}
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {actionStatus && (
        <div className={actionStatus.success ? styles.successMessage : styles.errorMessage}>
          <strong>{actionStatus.action}:</strong> {actionStatus.message}
        </div>
      )}
      
      <div className={styles.actionsSection}>
        <h2>Actions</h2>
        <div className={styles.buttonGroup}>
          <button 
            className={styles.actionButton}
            onClick={handleFetchStatus}
            disabled={loading || !token}
          >
            {loading ? 'Loading...' : 'Fetch Current Status'}
          </button>
          
          <button 
            className={`${styles.actionButton} ${styles.resetButton}`}
            onClick={handleResetStatus}
            disabled={loading || !token}
          >
            Reset Status to Zero
          </button>
        </div>
      </div>
      
      <div className={styles.currentStatus}>
        <h2>Current Status</h2>
        {userStatus ? (
          <div className={styles.statusValues}>
            <div className={styles.statusItem}>
              <span className={styles.label}>Speaking:</span>
              <span className={styles.value}>{userStatus.speaking}/10</span>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{width: `${userStatus.speaking * 10}%`}}
                ></div>
              </div>
            </div>
            
            <div className={styles.statusItem}>
              <span className={styles.label}>Writing:</span>
              <span className={styles.value}>{userStatus.writing}/10</span>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{width: `${userStatus.writing * 10}%`}}
                ></div>
              </div>
            </div>
            
            <div className={styles.statusItem}>
              <span className={styles.label}>Listening:</span>
              <span className={styles.value}>{userStatus.listening}/10</span>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{width: `${userStatus.listening * 10}%`}}
                ></div>
              </div>
            </div>
            
            <div className={styles.updatedAt}>
              Last updated: {new Date(userStatus.updatedAt).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className={styles.noStatus}>
            No status data loaded. Click "Fetch Current Status" to load your data.
          </div>
        )}
      </div>
      
      <div className={styles.updateSection}>
        <h2>Update Status</h2>
        <div className={styles.inputGroup}>
          <div className={styles.inputItem}>
            <label htmlFor="speakingInput">Speaking (0-10):</label>
            <input
              id="speakingInput"
              type="number"
              min="0"
              max="10"
              value={speakingInput}
              onChange={(e) => setSpeakingInput(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              className={styles.numberInput}
              disabled={loading}
            />
          </div>
          
          <div className={styles.inputItem}>
            <label htmlFor="writingInput">Writing (0-10):</label>
            <input
              id="writingInput"
              type="number"
              min="0"
              max="10"
              value={writingInput}
              onChange={(e) => setWritingInput(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              className={styles.numberInput}
              disabled={loading}
            />
          </div>
          
          <div className={styles.inputItem}>
            <label htmlFor="listeningInput">Listening (0-10):</label>
            <input
              id="listeningInput"
              type="number"
              min="0"
              max="10"
              value={listeningInput}
              onChange={(e) => setListeningInput(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              className={styles.numberInput}
              disabled={loading}
            />
          </div>
        </div>
        
        <button
          className={`${styles.actionButton} ${styles.updateButton}`}
          onClick={handleUpdateStatus}
          disabled={loading || !token}
        >
          {loading ? 'Updating...' : 'Update Status'}
        </button>
      </div>
    </div>
  );
}

export default function StatusTestPage() {
  return (
    <ProtectedRoute>
      <StatusTestContent />
    </ProtectedRoute>
  );
}
