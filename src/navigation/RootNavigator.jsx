import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AuthNavigator from './AuthNavigator';
import CustomerStack from './CustomerStack';
import DriverNavigator from './DriverNavigator';
import ManagerNavigator from './ManagerNavigator';
import AdminNavigator from './AdminNavigator';
import { useAuth } from '../app/providers/AuthProvider';

export default function RootNavigator() {
  const { isAuthenticated, userRole, isLoading } = useAuth();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Handle routing based on authentication and user role
  if (isAuthenticated) {
    switch (userRole) {
      case 'customer':
        return <CustomerStack />;
      case 'driver':
        return <DriverNavigator />;
      case 'manager':
        return <ManagerNavigator />;
      case 'admin':
        return <AdminNavigator />;
      default:
        // If role is unknown but authenticated, default to Auth or a generic error
        return <AuthNavigator />;
    }
  }

  // Otherwise show Auth screens
  return <AuthNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
