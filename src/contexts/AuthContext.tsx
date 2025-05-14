'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login, register, fetchUserProfile, User, LoginCredentials, RegisterData } from '@/api/pronityClient';

// Define the shape of the authentication context
interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

// Provider component that wraps the app and makes auth object available
export function AuthContextProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if we have a token on first render
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      fetchUserData(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch user data with the stored token
  const fetchUserData = async (authToken: string) => {
    try {
      setIsLoading(true);
      const userData = await fetchUserProfile(authToken);
      setUser(userData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      // If the token is invalid, clear it
      if (err.statusCode === 401) {
        logoutUser();
      }
      setError(err.message || 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Login the user
  const loginUser = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await login(credentials);
      
      // Store the token in localStorage and state
      localStorage.setItem('authToken', response.token);
      setToken(response.token);
      setUser(response.user);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed');
      throw err; // Re-throw to allow handling in the UI
    } finally {
      setIsLoading(false);
    }
  };

  // Register a new user
  const registerUser = async (userData: RegisterData) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await register(userData);
      
      // Store the token in localStorage and state
      localStorage.setItem('authToken', response.token);
      setToken(response.token);
      setUser(response.user);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed');
      throw err; // Re-throw to allow handling in the UI
    } finally {
      setIsLoading(false);
    }
  };

  // Logout the user
  const logoutUser = () => {
    // Remove token from localStorage
    localStorage.removeItem('authToken');
    // Reset state
    setToken(null);
    setUser(null);
    setError(null);
  };

  // Value object that will be shared
  const value = {
    token,
    user,
    isAuthenticated: !!token,
    isLoading,
    error,
    login: loginUser,
    register: registerUser,
    logout: logoutUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContextProvider;
