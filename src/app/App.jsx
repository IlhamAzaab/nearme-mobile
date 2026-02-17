import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './providers/AuthProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import RootNavigator from '../navigation/RootNavigator';
import pushNotificationService from '../services/pushNotificationService';

export default function App() {
  const navigationRef = useRef(null);

  // Initialize push notifications when app starts (if user is logged in)
  useEffect(() => {
    const initPushOnStart = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token && navigationRef.current) {
        console.log('🔔 App: Auto-initializing push notifications...');
        pushNotificationService.setNavigationRef(navigationRef.current);
        await pushNotificationService.initialize(token);
      }
    };

    // Small delay to ensure navigation is ready
    const timer = setTimeout(initPushOnStart, 1500);

    return () => {
      clearTimeout(timer);
      pushNotificationService.cleanup();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
