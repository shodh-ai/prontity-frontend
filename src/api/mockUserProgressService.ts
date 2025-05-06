import { v4 as uuidv4 } from 'uuid';

// Safe localStorage wrapper to handle server-side rendering
const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};

// Simple in-memory storage
const users: Record<string, any> = {
  // Example pre-registered users for testing
  'test@example.com': {
    userId: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '$2a$10$rQnpe.2eAWfzF6jgSklqR.Y7XoMYvXVR0JhZ6LyQj3.ytNOCjSCgG', // password: "password"
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

// Internal mock of user progress
const userProgress: Record<string, any[]> = {};
const userTokens: Record<string, string> = {};

// Mock API client for the User Progress Service
const mockUserProgressApi = {
  // Authentication
  login: async (email: string, password: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const user = users[email];
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Simple password check (in a real app, would use bcrypt.compare)
    // Here we're accepting "password" for demo purposes
    if (password !== 'password') {
      throw new Error('Invalid email or password');
    }
    
    // Generate a mock token
    const token = `mock-token-${uuidv4()}`;
    userTokens[email] = token;
    safeStorage.setItem('token', token);
    
    return {
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    };
  },

  // Register a new user
  register: async (name: string, email: string, password: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (users[email]) {
      throw new Error('Email already in use');
    }
    
    const userId = `user-${uuidv4()}`;
    const now = new Date().toISOString();
    
    const newUser = {
      userId,
      name,
      email,
      passwordHash: 'mock-hash', // In real implementation, would use bcrypt.hash
      createdAt: now,
      updatedAt: now
    };
    
    users[email] = newUser;
    userProgress[userId] = [];
    
    // Generate a mock token
    const token = `mock-token-${uuidv4()}`;
    userTokens[email] = token;
    safeStorage.setItem('token', token);
    
    return {
      token,
      user: {
        userId: newUser.userId,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      }
    };
  },

  // Get current user profile
  getUserProfile: async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const token = safeStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Find user by token (simplified for mock)
    const email = Object.keys(userTokens).find(key => userTokens[key] === token);
    if (!email || !users[email]) {
      throw new Error('User not found');
    }
    
    const user = users[email];
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  },

  // Get user's progress
  getUserProgress: async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const userProfile = await mockUserProgressApi.getUserProfile();
    return userProgress[userProfile.userId] || [];
  },

  // Record task completion
  recordTaskCompletion: async (taskId: string, score?: number, performanceData?: any, srsItemId?: string, srsCorrect?: boolean) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const userProfile = await mockUserProgressApi.getUserProfile();
    
    const completionRecord = {
      userId: userProfile.userId,
      taskId,
      completedAt: new Date().toISOString(),
      score: score || 0,
      performanceData: performanceData || {}
    };
    
    if (!userProgress[userProfile.userId]) {
      userProgress[userProfile.userId] = [];
    }
    
    userProgress[userProfile.userId].push(completionRecord);
    return completionRecord;
  },

  // Get next task
  getNextTask: async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Mock task data
    return {
      taskId: `task-${uuidv4()}`,
      taskType: "lesson",
      contentRefId: "intro-lesson-1",
      difficultyLevel: 1
    };
  },

  // Get SRS review items
  getSrsReviewItems: async (itemType: string, limit: number = 10) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get user profile first
    const userProfile = await mockUserProgressApi.getUserProfile();
    
    // Mock SRS items
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      userId: userProfile.userId,
      itemId: `${itemType}-${i+1}`,
      itemType,
      nextReviewAt: new Date(Date.now() + 86400000 * (i+1)).toISOString()
    }));
  },

  // Logout (client-side only)
  logout: () => {
    safeStorage.removeItem('token');
  }
};

export default mockUserProgressApi;
