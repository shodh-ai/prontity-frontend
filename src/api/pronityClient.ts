/**
 * Pronity Backend API Client
 *
 * This module provides functions to interact with the Pronity Backend API,
 * which provides access to user authentication, interests, topics, words,
 * speaking practice, and writing practice.
 */

// The base URL for the Pronity backend API
export const PRONITY_API_URL = process.env.NEXT_PUBLIC_PRONITY_API_URL || 'http://localhost:8000';

/**
 * Error class for Pronity API related errors
 */
export class PronityApiError extends Error {
  statusCode: number;
  details?: any; // Optional field for more detailed error info (e.g., validation errors)

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'PronityApiError';
    this.statusCode = statusCode;
    this.details = details;
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

// --- Helper function to handle API responses ---
async function handleApiResponse<T>(response: Response, operationName: string): Promise<T> {
  if (!response.ok) {
    let errorMessage = `${operationName} failed: ${response.statusText}`;
    let errorDetails;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorDetails = errorData.details || errorData; // Capture full error response if possible
    } catch (e) {
      // If response is not JSON, use the text
      try {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      } catch (textError) {
        // Fallback if text() also fails
      }
    }
    console.error(`${operationName} Error: Status ${response.status}, Message: ${errorMessage}`, errorDetails);
    throw new PronityApiError(errorMessage, response.status, errorDetails);
  }
  try {
    return await response.json() as T;
  } catch (e) {
    console.error(`Error parsing JSON response for ${operationName}:`, e);
    throw new PronityApiError(`Invalid JSON response from server for ${operationName}.`, response.status);
  }
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return await handleApiResponse<AuthResponse>(response, 'Login');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    console.error('Network error during login:', error);
    throw new PronityApiError(`Network error during login: ${(error as Error).message}. Check server at ${PRONITY_API_URL}.`, 0);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return await handleApiResponse<AuthResponse>(response, 'Registration');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
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
    const response = await fetch(`${PRONITY_API_URL}/user/info`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await handleApiResponse<User>(response, 'Fetch User Profile');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching user profile: ${(error as Error).message}`, 0);
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
    return await handleApiResponse<Interest[]>(response, 'Fetch Interests');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching interests: ${(error as Error).message}`, 0);
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
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await handleApiResponse<Interest[]>(response, 'Fetch User Interests');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching user interests: ${(error as Error).message}`, 0);
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
    return await handleApiResponse<Interest[]>(response, 'Fetch All Interests');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching all interests: ${(error as Error).message}`, 0);
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ interestName: name })
    });
    return await handleApiResponse<Interest>(response, 'Add Interest');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error adding interest: ${(error as Error).message}`, 0);
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ interestId })
    });
    return await handleApiResponse<Interest>(response, 'Delete Interest');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error deleting interest: ${(error as Error).message}`, 0);
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
    return await handleApiResponse<Topic[]>(response, `Fetch Topics for Interest ${interestId}`);
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching topics: ${(error as Error).message}`, 0);
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
    return await handleApiResponse<Word[]>(response, `Fetch Words for Topic ${topicId}`);
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching words: ${(error as Error).message}`, 0);
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
    return await handleApiResponse<Word>(response, `Fetch Word ${wordId}`);
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching word: ${(error as Error).message}`, 0);
  }
}


// --- SPEAKING PRACTICE ---

/**
 * Interface for speaking practice data
 */
export interface SpeakingPracticeData {
  userId: string;
  questionText?: string;
  transcription: string;
  duration?: number;
  practiceDate?: string;
  topicId?: string;
  taskId?: string;
}

/**
 * Interface for the transcription response data from the backend
 */
export interface TranscriptionData {
  id: string;
  userId: string;
  questionText?: string;
  transcription: string;
  duration?: number;
  practiceDate: string;
  topicId?: string;
  taskId?: string;
  audioUrl?: string; // URL to the saved audio file, if available
}

/**
 * Saves transcription data to the backend
 * @param data The speaking practice data containing the transcription
 * @param token JWT authentication token
 * @returns Promise resolving to the saved practice data including an ID and potentially audioUrl
 * @throws PronityApiError if the request fails
 */
export async function saveTranscription(data: SpeakingPracticeData, token: string): Promise<TranscriptionData> {
  try {
    console.log('Saving transcription data:', { /* ...logging details... */ });
    const response = await fetch(`${PRONITY_API_URL}/speaking/save-transcription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return await handleApiResponse<TranscriptionData>(response, 'Save Transcription');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error saving transcription: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches the most recent transcription data for a specific task/topic from the backend
 * @param topicId The ID of the topic associated with the transcription
 * @param taskId The ID of the task associated with the transcription
 * @param token JWT authentication token
 * @returns Promise resolving to the transcription data
 * @throws PronityApiError if the request fails
 */
export async function fetchTranscription(topicId: string, taskId: string, token: string): Promise<TranscriptionData> {
  try {
    console.log('Fetching transcription data for:', { topicId, taskId });
    // This logic for trying multiple endpoints can be complex.
    // A single, reliable backend endpoint is preferred.
    // Assuming the backend provides: GET /speaking/transcriptions?topicId=...&taskId=...
    // Or: GET /speaking/transcriptions/user (and filter client-side)
    // For this example, let's assume the query parameter endpoint.
    const urlWithQuery = `${PRONITY_API_URL}/speaking/transcriptions?topicId=${encodeURIComponent(topicId)}&taskId=${encodeURIComponent(taskId)}`;
    const response = await fetch(urlWithQuery, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });

    // If response is 404, it means no specific transcription found for topicId/taskId.
    // Your original code had more complex fallback logic (fetching all and picking one).
    // You might want to re-implement that if needed, or ensure the backend handles "not found" gracefully.
    if (response.status === 404) {
        throw new PronityApiError(`Transcription not found for topicId '${topicId}' and taskId '${taskId}'`, 404);
    }
    return await handleApiResponse<TranscriptionData>(response, 'Fetch Transcription');

  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching transcription: ${(error as Error).message}`, 0);
  }
}

/**
 * Uploads an audio recording to the backend
 * @param audioBlob The audio recording as a Blob
 * @param practiceId ID of the associated speaking practice (from saveTranscription)
 * @param token JWT authentication token
 * @returns Promise resolving to the upload result (backend should define this, e.g., { audioUrl: string })
 * @throws PronityApiError if the request fails
 */
export async function uploadAudioRecording(audioBlob: Blob, practiceId: string, token: string): Promise<{ audioUrl: string; message?: string }> {
  try {
    console.log('Uploading audio recording:', { practiceId, blobSize: audioBlob.size });
    const formData = new FormData();
    const fileExtension = audioBlob.type.includes('webm') ? 'webm' : 'mp3';
    formData.append('audio', audioBlob, `recording_${practiceId}_${Date.now()}.${fileExtension}`);
    formData.append('practiceId', practiceId);

    const response = await fetch(`${PRONITY_API_URL}/speaking/upload-audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }, // Content-Type is set by FormData
      body: formData
    });
    return await handleApiResponse<{ audioUrl: string; message?: string }>(response, 'Upload Audio Recording');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error uploading audio: ${(error as Error).message}`, 0);
  }
}


// --- WRITING PRACTICE ---

/**
 * Interface for writing practice data to be sent to the backend
 */
export interface WritingPracticeData {
  userId: string;
  questionText?: string;
  writtenText: string;  // User's essay (HTML or plain text)
  duration?: number;
  practiceDate?: string; // ISO date string
  topicId?: string;
  taskId?: string;
  wordCount?: number; // Optional: if calculated client-side
}

/**
 * Interface for the writing submission response data from the backend
 */
export interface WritingSubmissionData {
  id: string; // Unique ID of the saved writing submission
  userId: string;
  questionText?: string;
  writtenText: string;
  duration?: number;
  practiceDate: string;
  topicId?: string;
  taskId?: string;
  wordCount?: number;
  // Potentially other fields like analysis results if processed by backend
}

/**
 * Saves writing submission data to the backend
 * @param data The writing practice data
 * @param token JWT authentication token
 * @returns Promise resolving to the saved practice data including an ID
 * @throws PronityApiError if the request fails
 */
export async function saveWritingSubmission(data: WritingPracticeData, token: string): Promise<WritingSubmissionData> {
  try {
    console.log('Saving writing submission data:', { /* ...logging details... */ });
    const response = await fetch(`${PRONITY_API_URL}/writing/save-submission`, { // Ensure this endpoint exists
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return await handleApiResponse<WritingSubmissionData>(response, 'Save Writing Submission');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error saving writing submission: ${(error as Error).message}`, 0);
  }
}

/**
 * Fetches the most recent writing submission data for a specific task/topic from the backend
 * @param topicId The ID of the topic associated with the writing submission
 * @param taskId The ID of the task associated with the writing submission
 * @param token JWT authentication token
 * @returns Promise resolving to the writing submission data
 * @throws PronityApiError if the request fails
 */
export async function fetchWritingSubmission(topicId: string, taskId: string, token: string): Promise<WritingSubmissionData> {
  try {
    console.log('Fetching writing submission data for:', { topicId, taskId });
    // Backend needs: GET /writing/submissions?topicId=...&taskId=... (or similar)
    const urlWithQuery = `${PRONITY_API_URL}/writing/submissions?topicId=${encodeURIComponent(topicId)}&taskId=${encodeURIComponent(taskId)}`;
    const response = await fetch(urlWithQuery, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 404) {
        throw new PronityApiError(`Writing submission not found for topicId '${topicId}' and taskId '${taskId}'`, 404);
    }
    return await handleApiResponse<WritingSubmissionData>(response, 'Fetch Writing Submission');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching writing submission: ${(error as Error).message}`, 0);
  }
}


// --- USER STATUS & FLOW ---

/**
 * Interface for user status data (scores)
 */
export interface UserStatus {
  id: string;
  userId: string;
  speaking: number;
  writing: number;
  listening: number; // Assuming listening is also a score
  // reading?: number; // If you have reading scores
  updatedAt: string;
}

/**
 * Fetches the current user's status scores
 * @param token JWT authentication token
 * @returns Promise resolving to the user status data
 * @throws PronityApiError if the request fails
 */
export async function fetchUserStatus(token: string): Promise<UserStatus> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/status`, { // Endpoint for user status
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    return await handleApiResponse<UserStatus>(response, 'Fetch User Status');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching user status: ${(error as Error).message}`, 0);
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
  data: { speaking?: number; writing?: number; listening?: number; /* reading?: number; */ },
  token: string
): Promise<UserStatus> {
  try {
    const response = await fetch(`${PRONITY_API_URL}/status`, { // PUT to /status
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    return await handleApiResponse<UserStatus>(response, 'Update User Status');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error updating user status: ${(error as Error).message}`, 0);
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
    const response = await fetch(`${PRONITY_API_URL}/status/reset`, { // POST to /status/reset
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    return await handleApiResponse<UserStatus>(response, 'Reset User Status');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error resetting user status: ${(error as Error).message}`, 0);
  }
}

/**
 * Interface for flow task data (as received from backend)
 */
export interface FlowTask {
  taskId: string;
  title: string;
  description: string; // This might be the prompt or question text
  taskType: 'reading' | 'writing' | 'speaking' | 'listening' | 'vocab'; // More specific types
  difficultyLevel: number;
  topic: { // Topic details associated with the task
    topicId: string;
    name: string;
    description?: string;
    isExamTopic?: boolean;
  };
  // Add other task-specific fields if necessary, e.g.:
  // options?: string[]; // For multiple choice questions
  // passage?: string; // For reading tasks
  // preparationTime?: number; // For speaking/writing
  // responseTime?: number; // For speaking
  // writingTime?: number; // For writing
}

/**
 * Interface for flow response data from the backend
 */
export interface FlowResponse {
  currentPosition: number;
  totalTasks: number;
  currentTask: FlowTask;
  isCompleted?: boolean; // Optional: indicates if the entire flow is done
}


/**
 * Fetches the current flow task for the user
 * @param token JWT authentication token
 * @returns Promise resolving to the flow task data
 * @throws PronityApiError if the request fails
 */
export async function fetchFlowTask(token: string): Promise<FlowResponse> {
  try {
    const url = `${PRONITY_API_URL}/flow/tasks/current`; // Adjusted endpoint for clarity
    console.log('Fetching current flow task from:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    return await handleApiResponse<FlowResponse>(response, 'Fetch Current Flow Task');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error fetching flow task: ${(error as Error).message}`, 0);
  }
}

/**
 * Moves to the next flow task for the user
 * @param token JWT authentication token
 * @param lastTaskResult Optional: data about the result of the completed task
 * @returns Promise resolving to the next flow task data, or an indication of completion
 * @throws PronityApiError if the request fails
 */
export async function nextFlowTask(token: string, lastTaskResult?: any): Promise<FlowResponse> {
  try {
    const url = `${PRONITY_API_URL}/flow/tasks/next`; // Adjusted endpoint
    console.log('Moving to next flow task:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(lastTaskResult || {}), // Send result of previous task if any
    });
    return await handleApiResponse<FlowResponse>(response, 'Move to Next Flow Task');
  } catch (error) {
    if (error instanceof PronityApiError) throw error;
    throw new PronityApiError(`Network error moving to next flow task: ${(error as Error).message}`, 0);
  }
}

/**
 * Resets the user's progress in the current flow
 * @param token JWT authentication token
 * @returns Promise resolving to the first task of the reset flow
 * @throws PronityApiError if the request fails
 */
export async function resetFlow(token: string): Promise<FlowResponse> {
    try {
        const url = `${PRONITY_API_URL}/flow/tasks/reset`;
        console.log('Resetting flow task progress:', url);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
        return await handleApiResponse<FlowResponse>(response, 'Reset Flow');
    } catch (error) {
        if (error instanceof PronityApiError) throw error;
        throw new PronityApiError(`Network error resetting flow: ${(error as Error).message}`, 0);
    }
}