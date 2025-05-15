import { UserStatus } from './pronityClient';

// Mock interface matching the actual API
const STORAGE_KEY = 'mock_user_status';

const getDefaultStatus = (userId: string): UserStatus => ({
  id: 'mock-status-id',
  userId,
  speaking: 6, // Default value out of 10
  writing: 7,  // Default value out of 10
  listening: 8, // Default value out of 10
  updatedAt: new Date().toISOString()
});

/**
 * Get the user status from localStorage
 */
export const fetchUserStatus = async (): Promise<UserStatus> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    const storedStatus = localStorage.getItem(STORAGE_KEY);
    if (storedStatus) {
      return JSON.parse(storedStatus);
    }
    
    // If not found, create a default status
    const userId = localStorage.getItem('userId') || 'mock-user-id';
    const defaultStatus = getDefaultStatus(userId);
    
    // Store it for future use
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStatus));
    
    return defaultStatus;
  } catch (error) {
    console.error('Error fetching mock user status:', error);
    throw new Error('Failed to fetch user status');
  }
};

/**
 * Update the user status in localStorage
 */
export const updateUserStatus = async (data: {
  speaking?: number;
  writing?: number;
  listening?: number;
}): Promise<UserStatus> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  try {
    // Get current status
    let currentStatus: UserStatus;
    const storedStatus = localStorage.getItem(STORAGE_KEY);
    
    if (storedStatus) {
      currentStatus = JSON.parse(storedStatus);
    } else {
      const userId = localStorage.getItem('userId') || 'mock-user-id';
      currentStatus = getDefaultStatus(userId);
    }
    
    // Update fields
    const updatedStatus: UserStatus = {
      ...currentStatus,
      speaking: data.speaking !== undefined ? data.speaking : currentStatus.speaking,
      writing: data.writing !== undefined ? data.writing : currentStatus.writing,
      listening: data.listening !== undefined ? data.listening : currentStatus.listening,
      updatedAt: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStatus));
    
    return updatedStatus;
  } catch (error) {
    console.error('Error updating mock user status:', error);
    throw new Error('Failed to update user status');
  }
};

/**
 * Reset the user status to zero in localStorage
 */
export const resetUserStatus = async (): Promise<UserStatus> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 600));
  
  try {
    // Get current status
    let currentStatus: UserStatus;
    const storedStatus = localStorage.getItem(STORAGE_KEY);
    
    if (storedStatus) {
      currentStatus = JSON.parse(storedStatus);
    } else {
      const userId = localStorage.getItem('userId') || 'mock-user-id';
      currentStatus = getDefaultStatus(userId);
    }
    
    // Reset scores to zero
    const resetStatus: UserStatus = {
      ...currentStatus,
      speaking: 0,
      writing: 0,
      listening: 0,
      updatedAt: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetStatus));
    
    return resetStatus;
  } catch (error) {
    console.error('Error resetting mock user status:', error);
    throw new Error('Failed to reset user status');
  }
};

export default {
  fetchUserStatus,
  updateUserStatus,
  resetUserStatus
};
