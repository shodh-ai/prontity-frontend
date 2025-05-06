import axios from 'axios';

// User Progress Service API base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance with auth token handling
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add request interceptor to inject the auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API client for the User Progress Service
const userProgressApi = {
  // Authentication
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      // Store the token in localStorage
      localStorage.setItem('token', response.data.token);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        throw new Error('Invalid credentials');
      }
      throw error;
    }
  },

  // Register a new user
  register: async (name: string, email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { name, email, password });
      // Store the token in localStorage
      localStorage.setItem('token', response.data.token);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 409) {
        throw new Error('Email already in use');
      }
      throw error;
    }
  },

  // Get current user profile
  getUserProfile: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user's progress
  getUserProgress: async () => {
    try {
      const response = await api.get('/users/me/progress');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Record task completion
  recordTaskCompletion: async (taskId: string, score?: number, performanceData?: any, srsItemId?: string, srsCorrect?: boolean) => {
    try {
      const payload: any = { taskId };
      
      if (score !== undefined) payload.score = score;
      if (performanceData) payload.performanceData = performanceData;
      if (srsItemId) payload.srsItemId = srsItemId;
      if (srsCorrect !== undefined) payload.srsCorrect = srsCorrect;
      
      const response = await api.post('/users/me/progress', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get next task
  getNextTask: async () => {
    try {
      const response = await api.get('/users/me/next-task');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get SRS review items
  getSrsReviewItems: async (itemType: string, limit: number = 10) => {
    try {
      const response = await api.get(`/users/me/srs/review-items?itemType=${itemType}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Logout (client-side only, no API call needed)
  logout: () => {
    localStorage.removeItem('token');
  }
};

export default userProgressApi;
