import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuth } from '../../../app/providers/AuthProvider';

export default function Pending() {
  const navigation = useNavigation();
  const { fetchAdminStatus, adminStatus, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    const data = await fetchAdminStatus();
    setLastChecked(new Date());
    setChecking(false);

    if (data?.admin_status === 'active') {
      // Navigate to dashboard when approved
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AdminMain' }],
        })
      );
    }
  }, [fetchAdminStatus, navigation]);

  // Auto-check status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleLogout = async () => {
    await logout();
  };

  const getStatusMessage = () => {
    switch (adminStatus) {
      case 'pending':
        return 'Your restaurant is under review. We\'ll notify you once approved.';
      case 'suspended':
        return 'Your account has been suspended. Please contact support.';
      case 'rejected':
        return 'Your application was rejected. Please contact support for more information.';
      default:
        return 'Your restaurant is under review. We\'ll notify you once approved.';
    }
  };

  const getStatusEmoji = () => {
    switch (adminStatus) {
      case 'pending':
        return '⏳';
      case 'suspended':
        return '🚫';
      case 'rejected':
        return '❌';
      default:
        return '⏳';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={checking}
            onRefresh={checkStatus}
            colors={['#22c55e']}
            tintColor="#22c55e"
          />
        }
      >
        <View style={styles.content}>
          <Text style={styles.emoji}>{getStatusEmoji()}</Text>
          <Text style={styles.title}>
            {adminStatus === 'pending' ? 'Approval Pending' : 
             adminStatus === 'suspended' ? 'Account Suspended' :
             adminStatus === 'rejected' ? 'Application Rejected' : 'Approval Pending'}
          </Text>
          <Text style={styles.subtitle}>{getStatusMessage()}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What happens next?</Text>
            <Text style={styles.infoStep}>1. Our team reviews your restaurant details</Text>
            <Text style={styles.infoStep}>2. We verify your documents</Text>
            <Text style={styles.infoStep}>3. You'll receive a notification when approved</Text>
            <Text style={styles.infoStep}>4. Start managing your restaurant! 🎉</Text>
          </View>

          <TouchableOpacity 
            style={[styles.refreshBtn, checking && styles.refreshBtnDisabled]} 
            onPress={checkStatus}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.refreshBtnText}>Check Status</Text>
            )}
          </TouchableOpacity>

          {lastChecked && (
            <Text style={styles.lastChecked}>
              Last checked: {lastChecked.toLocaleTimeString()}
            </Text>
          )}

          <Text style={styles.pullHint}>Pull down to refresh</Text>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 12,
  },
  infoStep: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
    paddingLeft: 4,
  },
  refreshBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  refreshBtnDisabled: {
    opacity: 0.7,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  lastChecked: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
  },
  pullHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  logoutBtn: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
