import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from '../../services/pushNotificationService';

const NotificationContext = createContext(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const appState = useRef(AppState.currentState);
  const navigationRef = useRef(null);

  // Check push notification permission status on mount
  useEffect(() => {
    checkPushStatus();
  }, []);

  // Handle app state changes (background -> foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - refresh notification status
        checkPushStatus();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const checkPushStatus = async () => {
    const status = await pushNotificationService.getPermissionStatus();
    setPushEnabled(status === 'granted');
    
    const token = await AsyncStorage.getItem('expoPushToken');
    setPushToken(token);
  };

  // Set navigation reference for push notification handling
  const setNavigationRef = useCallback((ref) => {
    navigationRef.current = ref;
    pushNotificationService.setNavigationRef(ref);
  }, []);

  // Initialize push notifications (call after login)
  const initializePushNotifications = useCallback(async (authToken) => {
    console.log('📲 NotificationProvider: Initializing push notifications...');
    const result = await pushNotificationService.initialize(authToken);
    
    if (result.success) {
      setPushEnabled(true);
      const token = await AsyncStorage.getItem('expoPushToken');
      setPushToken(token);
    }
    
    return result;
  }, []);

  // Cleanup push notifications (call on logout)
  const cleanupPushNotifications = useCallback(async (authToken) => {
    console.log('📲 NotificationProvider: Cleaning up push notifications...');
    await pushNotificationService.unregisterToken(authToken);
    pushNotificationService.cleanup();
    setPushToken(null);
  }, []);

  // Request push notification permission
  const requestPushPermission = useCallback(async () => {
    const granted = await pushNotificationService.requestPermission();
    setPushEnabled(granted);
    return granted;
  }, []);

  // Show alert to enable notifications
  const showEnableNotificationsAlert = useCallback(() => {
    pushNotificationService.showEnableNotificationsAlert();
  }, []);

  // Add in-app notification (local)
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now().toString(),
      ...notification,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  };

  const markAsRead = (notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    // Also clear badge
    pushNotificationService.setBadgeCount(0);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    pushNotificationService.clearAllNotifications();
  };

  // Send test notification (for debugging)
  const sendTestNotification = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      return await pushNotificationService.sendTestNotification(token);
    }
  }, []);

  // Schedule a local notification
  const scheduleLocalNotification = useCallback(async (title, body, data = {}) => {
    await pushNotificationService.scheduleLocalNotification(title, body, data);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        // In-app notifications
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        // Push notifications
        pushEnabled,
        pushToken,
        setNavigationRef,
        initializePushNotifications,
        cleanupPushNotifications,
        requestPushPermission,
        showEnableNotificationsAlert,
        sendTestNotification,
        scheduleLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
