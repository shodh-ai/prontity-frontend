import axios from 'axios';

// Content Service API base URL
const API_BASE_URL = 'http://localhost:3001';

// Adding default timeout and retry logic
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// API client for the Content Service
const contentApi = {
  // Fetch vocabulary word
  getVocabWord: async (wordId: string) => {
    try {
      const response = await axiosInstance.get(`/content/vocab/${wordId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching vocab word ${wordId}:`, error);
      
      // Return fallback data if service is unavailable
      if (!error.response || error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
        console.log('Content service unavailable, returning fallback data');
        return {
          id: wordId,
          word: wordId,
          definition: 'Sample definition. Content service is currently unavailable.',
          example: 'This is a sample example sentence.',
          level: 'intermediate',
          partOfSpeech: 'noun'
        };
      }
      
      if (error.response && error.response.status === 404) {
        throw new Error('Vocabulary word not found');
      }
      throw error;
    }
  },
  
  // Fetch speaking topic
  getSpeakingTopic: async (topicId: string) => {
    try {
      const response = await axiosInstance.get(`/content/speaking/topic/${topicId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching speaking topic ${topicId}:`, error);
      
      // Return fallback data if service is unavailable
      if (!error.response || error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
        console.log('Content service unavailable, returning fallback data');
        return {
          id: topicId,
          title: 'Sample Speaking Topic',
          description: 'This is a sample speaking topic. Content service is currently unavailable.',
          difficulty: 'intermediate',
          timeLimit: 120,
          questions: [
            'What are your thoughts on this topic?',
            'Can you describe your experience with this?'
          ]
        };
      }
      
      if (error.response && error.response.status === 404) {
        throw new Error('Speaking topic not found');
      }
      throw error;
    }
  },
  
  // Fetch writing prompt
  getWritingPrompt: async (promptId: string) => {
    try {
      const response = await axiosInstance.get(`/content/writing/prompt/${promptId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching writing prompt ${promptId}:`, error);
      
      // Return fallback data if service is unavailable
      if (!error.response || error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
        console.log('Content service unavailable, returning fallback data');
        return {
          id: promptId,
          title: 'Sample Writing Prompt',
          prompt: 'Write about a topic that interests you. Content service is currently unavailable.',
          difficulty: 'intermediate',
          timeLimit: 1800,
          minWords: 150,
          maxWords: 300
        };
      }
      
      if (error.response && error.response.status === 404) {
        throw new Error('Writing prompt not found');
      }
      throw error;
    }
  }
};

export default contentApi;
