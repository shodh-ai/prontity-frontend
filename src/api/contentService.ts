import axios from 'axios';

// Content Service API base URL
const API_BASE_URL = 'http://localhost:3001';

// API client for the Content Service
const contentApi = {
  // Fetch vocabulary word
  getVocabWord: async (wordId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content/vocab/${wordId}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        throw new Error('Vocabulary word not found');
      }
      throw error;
    }
  },
  
  // Fetch speaking topic
  getSpeakingTopic: async (topicId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content/speaking/topic/${topicId}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        throw new Error('Speaking topic not found');
      }
      throw error;
    }
  },
  
  // Fetch writing prompt
  getWritingPrompt: async (promptId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/content/writing/prompt/${promptId}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        throw new Error('Writing prompt not found');
      }
      throw error;
    }
  }
};

export default contentApi;
