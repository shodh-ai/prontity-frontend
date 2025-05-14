'use client';

import { useState, useEffect } from 'react';
import { fetchUserStatus, updateUserStatus, UserStatus as UserStatusType } from '@/api/pronityClient';
import styles from './UserStatus.module.css';

interface UserStatusProps {
  token: string; // Require token for the real API
}

const UserStatus: React.FC<UserStatusProps> = ({ token }) => {
  const [userStatus, setUserStatus] = useState<UserStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Form state for editing scores
  const [speakingScore, setSpeakingScore] = useState(0);
  const [writingScore, setWritingScore] = useState(0);
  const [listeningScore, setListeningScore] = useState(0);

  useEffect(() => {
    const loadUserStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const status = await fetchUserStatus(token);
        setUserStatus(status);
        
        // Initialize form values
        setSpeakingScore(status.speaking);
        setWritingScore(status.writing);
        setListeningScore(status.listening);
      } catch (error) {
        console.error('Error fetching user status:', error);
        setError('Failed to load your skill scores. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadUserStatus();
    }
  }, [token]);

  const handleSaveScores = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedStatus = await updateUserStatus({
        speaking: speakingScore,
        writing: writingScore,
        listening: listeningScore
      }, token);
      
      setUserStatus(updatedStatus);
      setEditMode(false);
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update your skill scores. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form values to current status
    if (userStatus) {
      setSpeakingScore(userStatus.speaking);
      setWritingScore(userStatus.writing);
      setListeningScore(userStatus.listening);
    }
    setEditMode(false);
  };

  if (loading && !userStatus) {
    return <div className={styles.loading}>Loading your skills...</div>;
  }

  if (error && !userStatus) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.userStatusContainer}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Your Current Skills</h3>
        {!editMode ? (
          <button 
            className={styles.editButton}
            onClick={() => setEditMode(true)}
          >
            Edit
          </button>
        ) : (
          <div className={styles.buttonGroup}>
            <button 
              className={styles.saveButton}
              onClick={handleSaveScores}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button 
              className={styles.cancelButton}
              onClick={handleCancelEdit}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <div className={styles.skillsContainer}>
        <div className={styles.skillItem}>
          <div className={styles.skillName}>Speaking Skills</div>
          {editMode ? (
            <input
              type="number"
              min="0"
              max="10"
              value={speakingScore}
              onChange={(e) => setSpeakingScore(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              className={styles.scoreInput}
            />
          ) : (
            <>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{width: `${(userStatus?.speaking || 0) * 10}%`}}
                ></div>
              </div>
              <span className={styles.scoreValue}>{userStatus?.speaking || 0}/10</span>
            </>
          )}
        </div>
        
        <div className={styles.skillItem}>
          <div className={styles.skillName}>Writing Skills</div>
          {editMode ? (
            <input
              type="number"
              min="0"
              max="10"
              value={writingScore}
              onChange={(e) => setWritingScore(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              className={styles.scoreInput}
            />
          ) : (
            <>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{width: `${(userStatus?.writing || 0) * 10}%`}}
                ></div>
              </div>
              <span className={styles.scoreValue}>{userStatus?.writing || 0}/10</span>
            </>
          )}
        </div>
        
        <div className={styles.skillItem}>
          <div className={styles.skillName}>Listening Skills</div>
          {editMode ? (
            <input
              type="number"
              min="0"
              max="10"
              value={listeningScore}
              onChange={(e) => setListeningScore(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              className={styles.scoreInput}
            />
          ) : (
            <>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{width: `${(userStatus?.listening || 0) * 10}%`}}
                ></div>
              </div>
              <span className={styles.scoreValue}>{userStatus?.listening || 0}/10</span>
            </>
          )}
        </div>
      </div>
      
      <div className={styles.lastUpdated}>
        Last updated: {userStatus?.updatedAt ? new Date(userStatus.updatedAt).toLocaleString() : 'Never'}
      </div>
    </div>
  );
};

export default UserStatus;
