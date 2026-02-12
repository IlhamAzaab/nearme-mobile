import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const role = await AsyncStorage.getItem('role');
      const userName = await AsyncStorage.getItem('userName');
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userId = await AsyncStorage.getItem('userId');
      
      if (token && role) {
        setUser({ id: userId, email: userEmail, name: userName, role });
        setUserRole(role);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Call this after login to refresh auth state
  const refreshAuthState = useCallback(async () => {
    await checkAuthState();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      // TODO: Implement login API call
      const mockUser = { id: 1, email, name: 'User', role: 'customer' };
      await AsyncStorage.setItem('token', 'mock-token');
      await AsyncStorage.setItem('role', 'customer');
      await AsyncStorage.setItem('userEmail', email);
      setUser(mockUser);
      setUserRole('customer');
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email, password, name) => {
    setIsLoading(true);
    try {
      // TODO: Implement signup API call
      console.log('Signup:', { email, name });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('role');
    await AsyncStorage.removeItem('userEmail');
    await AsyncStorage.removeItem('userName');
    await AsyncStorage.removeItem('userId');
    setUser(null);
    setUserRole(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      isAuthenticated, 
      userRole,
      login, 
      signup, 
      logout,
      refreshAuthState 
    }}>
      {children}
    </AuthContext.Provider>
  );
}
