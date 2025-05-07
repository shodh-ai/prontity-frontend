/**
 * API client for essay service backend
 */
import axios from 'axios';
import { Essay, Comment, Grade } from './types';

/**
 * Creates an API client for the essay service
 * @param baseUrl - Base URL for the API (e.g., http://localhost:3001)
 */
export const createEssayApi = (baseUrl: string = 'http://localhost:3001') => {
  const api = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const essayApi = {
    // Create a new essay
    create: async (userId: string, title: string, content: any): Promise<{ id: string }> => {
      console.log('API create essay params:', { userId, title });
      console.log('Content being sent:', JSON.stringify(content));
      // Ensure we're sending the exact format expected by the backend
      const payload = {
        userId, // Required by the backend
        title,
        content // Tiptap JSON content
      };
      const response = await api.post('/essays', payload);
      return response.data;
    },

    // Get an essay by ID
    getById: async (id: string): Promise<Essay> => {
      const response = await api.get(`/essays/${id}`);
      return response.data;
    },

    // Update an essay
    update: async (id: string, data: { title?: string; content?: any }): Promise<Essay> => {
      const response = await api.patch(`/essays/${id}`, data);
      return response.data;
    },

    // Get comments for an essay
    getComments: async (essayId: string): Promise<Comment[]> => {
      const response = await api.get(`/essays/${essayId}/comments`);
      return response.data;
    },

    // Analyze essay with AI
    analyze: async (essayId: string): Promise<{ message: string; comments: Comment[] }> => {
      const response = await api.post(`/essays/${essayId}/analyze`);
      return response.data;
    },

    // Submit essay for grading
    submitForGrading: async (essayId: string): Promise<{ message: string }> => {
      const response = await api.post(`/essays/${essayId}/submit`);
      return response.data;
    },

    // Get grade for an essay
    getGrade: async (essayId: string): Promise<Grade | null> => {
      try {
        const response = await api.get(`/essays/${essayId}/grade`);
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null; // No grade yet
        }
        throw error;
      }
    },
  };

  return essayApi;
};

export default createEssayApi;
