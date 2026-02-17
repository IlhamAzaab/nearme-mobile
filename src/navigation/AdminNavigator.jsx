import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminTabs from './AdminTabs';
import { useAuth } from '../app/providers/AuthProvider';

// Admin Screens
import AdminNotifications from '../screens/admin/AdminNotifications';
import AdminProfile from '../screens/admin/AdminProfile';
import AdminWithdrawals from '../screens/admin/AdminWithdrawals';
import Categories from '../screens/admin/Categories';
import Earnings from '../screens/admin/Earnings';
import RestaurantDetail from '../screens/admin/RestaurantDetail';
import TestNotificationScreen from '../screens/admin/TestNotificationScreen';

// Onboarding Screens
import Pending from '../screens/admin/onboarding/Pending';
import Step1 from '../screens/admin/onboarding/Step1';
import Step2 from '../screens/admin/onboarding/Step2';
import Step3 from '../screens/admin/onboarding/Step3';
import Step4 from '../screens/admin/onboarding/Step4';

const Stack = createNativeStackNavigator();

/**
 * Loading screen shown while checking admin status
 */
function AdminLoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1db95b" />
      <Text style={styles.loadingText}>Checking account status...</Text>
    </View>
  );
}

/**
 * Determines the initial route based on admin status
 * Flow:
 * 1. force_password_change → AdminProfile
 * 2. !onboarding_completed → AdminOnboardingStep{step}
 * 3. admin_status !== 'active' → AdminOnboardingPending
 * 4. admin_status === 'active' → AdminMain (Dashboard)
 */
function getInitialRoute(adminData) {
  if (!adminData) {
    return 'AdminOnboardingStep1'; // Default fallback
  }

  const { force_password_change, onboarding_completed, onboarding_step, admin_status } = adminData;

  // 1. Force password change first
  if (force_password_change) {
    return 'AdminProfile';
  }

  // 2. Onboarding not completed - go to appropriate step
  if (!onboarding_completed) {
    const step = Math.min(Math.max(onboarding_step || 1, 1), 4);
    return `AdminOnboardingStep${step}`;
  }

  // 3. Onboarding completed but not active - go to pending
  if (admin_status !== 'active') {
    return 'AdminOnboardingPending';
  }

  // 4. All checks passed - go to dashboard
  return 'AdminMain';
}

export default function AdminNavigator() {
  const { 
    fetchAdminStatus,
    adminStatus,
    forcePasswordChange,
    onboardingCompleted,
    onboardingStep,
    adminStatusLoading,
  } = useAuth();

  const [isChecking, setIsChecking] = useState(true);
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsChecking(true);
      const data = await fetchAdminStatus();
      
      if (data) {
        const route = getInitialRoute(data);
        setInitialRoute(route);
      } else {
        // If API fails, determine route from stored state
        const route = getInitialRoute({
          force_password_change: forcePasswordChange,
          onboarding_completed: onboardingCompleted,
          onboarding_step: onboardingStep,
          admin_status: adminStatus,
        });
        setInitialRoute(route);
      }
      
      setIsChecking(false);
    };

    checkAdminStatus();
  }, []);

  // Show loading while checking admin status
  if (isChecking || !initialRoute) {
    return <AdminLoadingScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* Onboarding Screens - shown first for new admins */}
      <Stack.Screen name="AdminOnboardingStep1" component={Step1} />
      <Stack.Screen name="AdminOnboardingStep2" component={Step2} />
      <Stack.Screen name="AdminOnboardingStep3" component={Step3} />
      <Stack.Screen name="AdminOnboardingStep4" component={Step4} />
      <Stack.Screen name="AdminOnboardingPending" component={Pending} />

      {/* Main Admin Tab Navigation - only accessible when status === 'active' */}
      <Stack.Screen name="AdminMain" component={AdminTabs} />
      
      {/* Secondary Admin Screens */}
      <Stack.Screen name="AdminNotifications" component={AdminNotifications} />
      <Stack.Screen name="AdminProfile" component={AdminProfile} />
      <Stack.Screen name="AdminWithdrawals" component={AdminWithdrawals} />
      <Stack.Screen name="Categories" component={Categories} />
      <Stack.Screen name="Earnings" component={Earnings} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetail} />
      
      {/* Dev/Test Screen - Remove in production */}
      <Stack.Screen 
        name="TestNotification" 
        component={TestNotificationScreen}
        options={{ headerShown: true, title: 'Test Notifications' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
});
