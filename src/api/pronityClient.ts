/**
 * Pronity Backend API Client
 * 
 * This module provides functions to interact with the Pronity Backend API,
 * which provides access to user authentication, interests, topics, and words.
 */

// The base URL for the Pronity backend API
const PRONITY_API_URL = process.env.NEXT_PUBLIC_PRONITY_API_URL || 'http://localhost:8080';

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
  try {
    const response = await fetch(`${PRONITY_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new PronityApiError('Invalid email or password', 401);
      }
      throw new PronityApiError(`Login error: ${response.statusText}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof PronityApiError) {
      throw error;
    }
    throw new PronityApiError(`Network error during login: ${(error as Error).message}`, 0);
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
