/**
 * Pronity Backend API Client
 * 
 * This module provides functions to interact with the Pronity Backend API,
 * which provides access to user authentication, interests, topics, and words.
 */

// The base URL for the Pronity backend API
const PRONITY_API_URL = process.env.NEXT_PUBLIC_PRONITY_API_URL || 'http://localhost:8000';

/**
 * Error class for Pronity API related errors
 */
export class PronityApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'PronityApiError';
    this.statusCode = statusCode;
  }
}

// Define interfaces for the different data models
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interest {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  interestId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Word {
  id: string;
  wordText: string;
  definition: string;
  pronunciation: string;
  topicId: string;
  createdAt: string;
  updatedAt: string;
}

// Auth-related interfaces
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Handles authentication with the Pronity backend
 * @param credentials Login credentials (email and password)
 * @returns Promise resolving to the authentication response with token and user data
 * @throws PronityApiError if the request fails
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  console.log(`Attempting to connect to API at: ${PRONITY_API_URL}/auth/login`);
  
  try {
    const response = await fetch(`${PRONITY_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    console.log('Login response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Invalid email or password', 401);
      }
      throw new PronityApiError(`Login error: ${response.statusText}`, response.status);
    }
    
    const result = await response.json();
    console.log('Login successful, token received');
    return result;
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    
    console.error('Network error during login:', error);
    // More descriptive network error message
    throw new PronityApiError(
      `Network error during login: ${(error as Error).message}. ` +
      `Please check if the backend server (${PRONITY_API_URL}) is running and accessible.`, 
      0
    );
  }
}

/**
 * Registers a new user with the Pronity backend
 * @param userData Registration data (name, email, and password)
 * @returns Promise resolving to the authentication response with token and user data
 * @throws PronityApiError if the request fails
 */
export async function register(userData: RegisterData): Promise<AuthResponse> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      if (response.status === 409) {
        throw new PronityApiError('User with this email already exists', 409);
      }
      throw new PronityApiError(`Registration error: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error during registration: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches the current user's profile using the authentication token
 * @param token JWT authentication token
 * @returns Promise resolving to the user data
 * @throws PronityApiError if the request fails
 */
export async function fetchUserProfile(token: string): Promise<User> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error fetching user profile: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching user profile: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches all interests
 * @returns Promise resolving to an array of interests
 * @throws PronityApiError if the request fails
 */
export async function fetchInterests(): Promise<Interest[]> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/interest`);
    
    if (!response.ok) {
      throw new PronityApiError(`Error fetching interests: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching interests: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches interests for the currently logged in user
 * @param token JWT authentication token
 * @returns Promise resolving to an array of interests
 * @throws PronityApiError if the request fails
 */
export async function fetchUserInterests(token: string): Promise<Interest[]> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/interest/user`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error fetching interests: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching interests: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches all interests in the system (admin function)
 * @returns Promise resolving to an array of interests
 * @throws PronityApiError if the request fails
 */
export async function fetchAllInterests(): Promise<Interest[]> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/interest/all`);
    
    if (!response.ok) {
      throw new PronityApiError(`Error fetching all interests: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching all interests: ${(error as Error).message}`, 0);
  }
}

/**
 * Adds a new interest
 * @param name Name of the interest to add
 * @param token JWT authentication token
 * @returns Promise resolving to the created interest
 * @throws PronityApiError if the request fails
 */
export async function addInterest(name: string, token: string): Promise<Interest> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/interest/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ interestName: name })
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error adding interest: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when adding interest: ${(error as Error).message}`, 0);
  }
}

/**
 * Deletes an interest
 * @param interestId ID of the interest to delete
 * @param token JWT authentication token
 * @returns Promise resolving to the deleted interest
 * @throws PronityApiError if the request fails
 */
export async function deleteInterest(interestId: string, token: string): Promise<Interest> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/interest/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ interestId })
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      } else if (response.status === 404) {
        throw new PronityApiError(`Interest with ID '${interestId}' not found`, 404);
      }
      throw new PronityApiError(`Error deleting interest: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when deleting interest: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches topics for a specific interest
 * @param interestId ID of the interest
 * @returns Promise resolving to an array of topics
 * @throws PronityApiError if the request fails
 */
export async function fetchTopicsByInterest(interestId: string): Promise<Topic[]> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/topic/byInterest/${interestId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new PronityApiError(`Interest '${interestId}' not found`, 404);
      }
      throw new PronityApiError(`Error fetching topics: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching topics: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches words for a specific topic
 * @param topicId ID of the topic
 * @returns Promise resolving to an array of words
 * @throws PronityApiError if the request fails
 */
export async function fetchWordsByTopic(topicId: string): Promise<Word[]> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/word/byTopic/${topicId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new PronityApiError(`Topic '${topicId}' not found`, 404);
      }
      throw new PronityApiError(`Error fetching words: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching words: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches a specific word by ID
 * @param wordId ID of the word
 * @returns Promise resolving to the word data
 * @throws PronityApiError if the request fails
 */
export async function fetchWord(wordId: string): Promise<Word> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/word/${wordId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new PronityApiError(`Word '${wordId}' not found`, 404);
      }
      throw new PronityApiError(`Error fetching word: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching word: ${(error as Error).message}`, 0);
  }
}

/**
 * Interface for speaking practice data
 */
export interface SpeakingPracticeData {
  userId: string;
  questionText?: string;
  transcription: string;
  duration?: number;
  practiceDate?: string;
  topicId?: string; // Added for compatibility with /user/add-report endpoint
}

/**
 * Interface for user status data (scores)
 */
export interface UserStatus {
  id: string;
  userId: string;
  speaking: number;
  writing: number;
  listening: number;
  updatedAt: string;
}

/**
 * Saves transcription data to the backend
 * @param data The speaking practice data containing the transcription
 * @param token JWT authentication token
 * @returns Promise resolving to the saved practice data including an ID
 * @throws PronityApiError if the request fails
 */
export async function saveTranscription(data: SpeakingPracticeData, token: string): Promise<any> {
  try {
    console.log('Saving transcription data:', {
      userId: data.userId,
      questionText: data.questionText,
      transcriptionLength: data.transcription.length,
      duration: data.duration,
      practiceDate: data.practiceDate
    });
    
    const response = await fetch(`${PRONITY_API_URL}/speaking/save-transcription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error saving transcription: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when saving transcription: ${(error as Error).message}`, 0);
  }
}

/**
 * Uploads an audio recording to the backend
 * @param audioBlob The audio recording as a Blob
 * @param practiceId ID of the associated speaking practice (from saveTranscription)
 * @param token JWT authentication token
 * @returns Promise resolving to the upload result
 * @throws PronityApiError if the request fails
 */
export async function uploadAudioRecording(audioBlob: Blob, practiceId: string, token: string): Promise<any> {
  try {
    console.log('Uploading audio recording:', {
      practiceId: practiceId,
      blobType: audioBlob.type,
      blobSize: `${Math.round(audioBlob.size / 1024)} KB`
    });
    
    // Create a FormData instance to send the file
    const formData = new FormData();
    
    // Append the audio blob as a file with a specific name and type
    // Use .webm extension if the blob's type is audio/webm, otherwise use .mp3
    const fileExtension = audioBlob.type.includes('webm') ? 'webm' : 'mp3';
    formData.append('audio', audioBlob, `recording_${Date.now()}.${fileExtension}`);
    
    // Add the practice ID to associate the audio with the transcription
    formData.append('practiceId', practiceId);
    
    const response = await fetch(`${PRONITY_API_URL}/speaking/upload-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type here, it will be automatically set with the boundary
      },
      body: formData
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error uploading audio: ${response.statusText}`, response.status);
    }
    
    const result = await response.json();
    console.log('Audio uploaded successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in uploadAudioRecording:', error);
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when uploading audio: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches the current user's status scores
 * @param token JWT authentication token
 * @returns Promise resolving to the user status data
 * @throws PronityApiError if the request fails
 */
export async function fetchUserStatus(token: string): Promise<UserStatus> {
  try {
    console.log('Fetching user status');
    
    const response = await fetch(`${PRONITY_API_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error fetching user status: ${response.statusText}`, response.status);
    }
    
    const result = await response.json();
    console.log('User status fetched successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in fetchUserStatus:', error);
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when fetching user status: ${(error as Error).message}`, 0);
  }
}

/**
 * Updates the user's status scores
 * @param data The scores to update (speaking, writing, listening)
 * @param token JWT authentication token
 * @returns Promise resolving to the updated user status
 * @throws PronityApiError if the request fails
 */
export async function updateUserStatus(
  data: {
    speaking?: number;
    writing?: number;
    listening?: number;
  },
  token: string
): Promise<UserStatus> {
  try {
    console.log('Updating user status:', data);
    
    const response = await fetch(`${PRONITY_API_URL}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error updating user status: ${response.statusText}`, response.status);
    }
    
    const result = await response.json();
    console.log('User status updated successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in updateUserStatus:', error);
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when updating user status: ${(error as Error).message}`, 0);
  }
}

/**
 * Resets the user's status scores to zero
 * @param token JWT authentication token
 * @returns Promise resolving to the reset user status
 * @throws PronityApiError if the request fails
 */
export async function resetUserStatus(token: string): Promise<UserStatus> {
  try {
    console.log('Resetting user status');
    
    const response = await fetch(`${PRONITY_API_URL}/status/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Unauthorized, please login again', 401);
      }
      throw new PronityApiError(`Error resetting user status: ${response.statusText}`, response.status);
    }
    
    const result = await response.json();
    console.log('User status reset successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in resetUserStatus:', error);
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error when resetting user status: ${(error as Error).message}`, 0);
  }
}
