import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config/env';
import pushNotificationService from '../../services/pushNotificationService';

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
  const [profileCompleted, setProfileCompleted] = useState(false);
  
  // Admin-specific state
  const [adminStatus, setAdminStatus] = useState(null); // 'pending', 'active', 'suspended'
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [adminStatusLoading, setAdminStatusLoading] = useState(false);

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
      const profileDone = await AsyncStorage.getItem('profileCompleted');
      
      if (token && role) {
        setUser({ id: userId, email: userEmail, name: userName, role });
        setUserRole(role);
        setIsAuthenticated(true);
        setProfileCompleted(profileDone === 'true');
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
        setUser(null);
        setProfileCompleted(false);
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

  // Fetch admin status from API (for admin role only)
  const fetchAdminStatus = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    const role = await AsyncStorage.getItem('role');
    
    if (!token || role !== 'admin') {
      return null;
    }

    setAdminStatusLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_URL}/restaurant-onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn('Admin status check failed:', res.status);
        return null;
      }

      const data = await res.json();
      
      // Update admin-specific state
      setForcePasswordChange(data.force_password_change || false);
      setOnboardingCompleted(data.onboarding_completed || false);
      setOnboardingStep(data.onboarding_step || 1);
      setAdminStatus(data.admin_status || 'pending');
      
      // Also update profileCompleted based on onboarding
      const completed = data.onboarding_completed && data.admin_status === 'active';
      setProfileCompleted(completed);
      await AsyncStorage.setItem('profileCompleted', completed ? 'true' : 'false');

      return data;
    } catch (error) {
      console.error('Admin status fetch error:', error);
      return null;
    } finally {
      setAdminStatusLoading(false);
    }
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
    // Unregister push notification token before logout
    const token = await AsyncStorage.getItem('token');
    if (token) {
      await pushNotificationService.unregisterToken(token);
      pushNotificationService.cleanup();
    }
    
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('role');
    await AsyncStorage.removeItem('userEmail');
    await AsyncStorage.removeItem('userName');
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('profileCompleted');
    setUser(null);
    setUserRole(null);
    setIsAuthenticated(false);
    setProfileCompleted(false);
    // Reset admin-specific state
    setAdminStatus(null);
    setForcePasswordChange(false);
    setOnboardingCompleted(false);
    setOnboardingStep(1);
  };

  const markProfileCompleted = async () => {
    await AsyncStorage.setItem('profileCompleted', 'true');
    setProfileCompleted(true);
  };

  // Initialize push notifications after login
  const initializePushNotifications = useCallback(async (navigationRef) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      console.log('🔔 AuthProvider: Initializing push notifications...');
      if (navigationRef) {
        pushNotificationService.setNavigationRef(navigationRef);
      }
      const result = await pushNotificationService.initialize(token);
      console.log('Push notifications initialized:', result.success);
      return result;
    }
    return { success: false };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      isAuthenticated, 
      userRole,
      profileCompleted,
      // Admin-specific
      adminStatus,
      forcePasswordChange,
      onboardingCompleted,
      onboardingStep,
      adminStatusLoading,
      // Methods
      login, 
      signup, 
      logout,
      refreshAuthState,
      markProfileCompleted,
      fetchAdminStatus,
      setOnboardingStep,
      setOnboardingCompleted,
      setAdminStatus,
      initializePushNotifications,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
