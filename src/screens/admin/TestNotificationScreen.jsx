/**
 * Test Notification Screen
 * 
 * Complete testing tool for push notifications.
 * One-tap setup: handles permission + token + backend registration.
 * 
 * Access: Settings > Notifications tab > Test Push Notifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import pushNotificationService from '../../services/pushNotificationService';
import { API_URL } from '../../config/env';

const isExpoGo = Constants.appOwnership === 'expo';

export default function TestNotificationScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [pushToken, setPushToken] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('checking...');
  const [deviceInfo, setDeviceInfo] = useState({});
  const [authToken, setAuthToken] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadInfo();
  }, []);

  const addLog = useCallback((message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ message, type, time }, ...prev.slice(0, 19)]);
  }, []);

  const loadInfo = async () => {
    const token = await AsyncStorage.getItem('token');
    setAuthToken(token);

    setDeviceInfo({
      brand: Device.brand || 'Unknown',
      model: Device.modelName || 'Unknown',
      os: `${Device.osName || Platform.OS} ${Device.osVersion || Platform.Version}`,
      isDevice: Device.isDevice,
      platform: Platform.OS,
    });

    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);

    const savedToken = await AsyncStorage.getItem('expoPushToken');
    if (savedToken) setPushToken(savedToken);
  };

  // ─── ONE-TAP FULL SETUP ─────────────────────────────────
  const handleFullSetup = async () => {
    if (!authToken) {
      Alert.alert('Not Logged In', 'Please log in first, then come back here.');
      return;
    }

    setLoading(true);
    setLoadingAction('Setting up notifications...');

    try {
      // Step 1: Permission
      addLog('Requesting permission...', 'info');
      const granted = await pushNotificationService.requestPermission();

      if (!granted) {
        addLog('Permission denied!', 'error');
        Alert.alert(
          'Permission Required',
          'Please allow notifications. Tap "Open Settings" and turn on notifications for Expo Go.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                Platform.OS === 'ios'
                  ? Linking.openURL('app-settings:')
                  : Linking.openSettings();
              },
            },
          ]
        );
        setLoading(false);
        return;
      }
      addLog('Permission granted!', 'success');
      setPermissionStatus('granted');

      // Step 2: Get token
      addLog('Getting push token...', 'info');
      setLoadingAction('Getting push token...');
      const token = await pushNotificationService.getExpoPushToken();

      if (!token) {
        addLog('Failed to get token. Are you on a physical device?', 'error');
        setLoading(false);
        return;
      }
      addLog(`Token: ${token.substring(0, 30)}...`, 'success');
      setPushToken(token);

      // Step 3: Register with backend
      addLog('Registering with backend...', 'info');
      setLoadingAction('Registering with backend...');
      const registered = await pushNotificationService.registerToken(authToken);

      if (registered) {
        addLog('Registered with backend!', 'success');
      } else {
        addLog('Backend registration failed (backend may not be running). Local notifications still work!', 'warning');
      }

      // Step 4: Setup listeners
      pushNotificationService.setupForegroundHandler();
      pushNotificationService.setupNotificationResponseHandler();
      addLog('Notification listeners active!', 'success');

      addLog('=== SETUP COMPLETE ===', 'success');
      Alert.alert(
        'Setup Complete!',
        'Push notifications are ready. Try the test buttons below.\n\nTo test when phone is locked:\n1. Send a test notification\n2. Lock your phone\n3. Wait for notification with sound!'
      );
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // ─── TEST: Local notification with sound ─────────────────
  const handleTestLocal = async () => {
    try {
      addLog('Sending local notification...', 'info');
      await pushNotificationService.scheduleLocalNotification(
        '🔔 NearMe Notification',
        'This is a test notification with sound! If you hear a sound, it works.',
        { type: 'test' }
      );
      addLog('Local notification sent! Check notification bar.', 'success');
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    }
  };

  // ─── TEST: Approval notification ────────────────────────
  const handleTestApproval = async () => {
    try {
      addLog('Sending approval notification...', 'info');
      await pushNotificationService.scheduleLocalNotification(
        '🎉 Restaurant Approved!',
        'Congratulations! Your restaurant "NearMe Kitchen" has been approved by the manager. You can now start receiving orders!',
        { type: 'restaurant_approval' }
      );
      addLog('Approval notification sent!', 'success');
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    }
  };

  // ─── TEST: Lock screen notification ─────────────────────
  const handleTestLockScreen = async () => {
    try {
      addLog('Scheduling notification in 5 seconds...', 'info');
      Alert.alert(
        'Lock Screen Test',
        'Notification will arrive in 5 seconds.\n\nLOCK YOUR PHONE NOW!\n\nYou should hear a sound and see the notification on your lock screen.',
        [{ text: 'OK, Locking Now!' }]
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 NearMe - Lock Screen Test',
          body: 'If you see this on your lock screen with sound, push notifications work perfectly!',
          data: { type: 'test' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android' ? { channelId: 'approvals' } : {}),
        },
        trigger: {
          type: 'timeInterval',
          seconds: 5,
        },
      });
      addLog('Notification scheduled for 5 seconds! Lock your phone!', 'success');
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    }
  };

  // ─── TEST: Remote via backend ───────────────────────────
  const handleTestRemote = async () => {
    if (!authToken) {
      Alert.alert('Not Logged In', 'Please log in first.');
      return;
    }

    setLoading(true);
    setLoadingAction('Sending via backend...');
    try {
      addLog('Sending remote test via backend...', 'info');
      const result = await pushNotificationService.sendTestNotification(authToken);
      addLog(`Backend response: ${JSON.stringify(result)}`, 'success');
    } catch (error) {
      addLog(`Remote test failed: ${error.message}. Is your backend running?`, 'error');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // ─── COPY TOKEN ─────────────────────────────────────────
  const handleCopyToken = async () => {
    if (!pushToken) {
      Alert.alert('No Token', 'Run setup first to get your push token.');
      return;
    }
    try {
      await Clipboard.setStringAsync(pushToken);
      addLog('Token copied to clipboard!', 'success');
      Alert.alert('Copied!', 'Push token copied. You can paste it at expo.dev/notifications to test.');
    } catch (e) {
      // Fallback to Share
      Share.share({ message: pushToken });
    }
  };

  // ─── CHECK BACKEND ──────────────────────────────────────
  const handleCheckBackend = async () => {
    setLoading(true);
    setLoadingAction('Checking backend...');
    try {
      addLog(`Checking ${API_URL}/push/status...`, 'info');
      const res = await fetch(`${API_URL}/push/status`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await res.json();
      addLog(`Backend: ${JSON.stringify(data)}`, res.ok ? 'success' : 'error');
    } catch (error) {
      addLog(`Backend unreachable: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const StatusDot = ({ status }) => (
    <View style={[styles.dot, { backgroundColor: status ? '#22c55e' : '#ef4444' }]} />
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>

          <View style={styles.statusRow}>
            <StatusDot status={deviceInfo.isDevice} />
            <Text style={styles.statusLabel}>Physical Device</Text>
            <Text style={styles.statusValue}>
              {deviceInfo.isDevice ? `${deviceInfo.brand} ${deviceInfo.model}` : 'NO - Push wont work!'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <StatusDot status={permissionStatus === 'granted'} />
            <Text style={styles.statusLabel}>Permission</Text>
            <Text style={styles.statusValue}>{permissionStatus}</Text>
          </View>

          <View style={styles.statusRow}>
            <StatusDot status={!!pushToken} />
            <Text style={styles.statusLabel}>Push Token</Text>
            <Text style={styles.statusValue} numberOfLines={1}>
              {pushToken ? `${pushToken.substring(0, 25)}...` : 'Not registered'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <StatusDot status={!!authToken} />
            <Text style={styles.statusLabel}>Logged In</Text>
            <Text style={styles.statusValue}>{authToken ? 'Yes' : 'No'}</Text>
          </View>

          <View style={styles.statusRow}>
            <StatusDot status={true} />
            <Text style={styles.statusLabel}>Platform</Text>
            <Text style={styles.statusValue}>{deviceInfo.os}</Text>
          </View>

          <View style={styles.statusRow}>
            <StatusDot status={!isExpoGo} />
            <Text style={styles.statusLabel}>App Type</Text>
            <Text style={styles.statusValue}>
              {isExpoGo ? 'Expo Go (limited)' : 'Dev Build (full push)'}
            </Text>
          </View>
        </View>

        {/* Expo Go Warning */}
        {isExpoGo && Platform.OS === 'android' && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Expo Go Limitation</Text>
            <Text style={styles.warningText}>
              Since SDK 53, remote push notifications do NOT work in Expo Go on Android.{'\n\n'}
              ✅ Local notifications still work (test below){'\n'}
              ❌ Remote push from backend won't work{'\n\n'}
              To get full push support, you need a <Text style={styles.bold}>Development Build</Text>.{'\n'}
              Run this on your computer:{'\n'}
              <Text style={styles.codeText}>eas build --profile development --platform android</Text>
            </Text>
          </View>
        )}

        {/* Main Setup Button */}
        <TouchableOpacity
          style={[styles.setupButton, loading && styles.buttonDisabled]}
          onPress={handleFullSetup}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.setupButtonText}>  {loadingAction}</Text>
            </View>
          ) : (
            <Text style={styles.setupButtonText}>
              {pushToken ? '🔄 Re-run Setup' : '🚀 Setup Push Notifications (One Tap)'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Test Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Test Notifications</Text>

          <TouchableOpacity style={styles.testButton} onPress={handleTestLocal}>
            <Text style={styles.testIcon}>🔔</Text>
            <View style={styles.testInfo}>
              <Text style={styles.testTitle}>Local Test (with sound)</Text>
              <Text style={styles.testDesc}>Triggers notification immediately</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={handleTestApproval}>
            <Text style={styles.testIcon}>🎉</Text>
            <View style={styles.testInfo}>
              <Text style={styles.testTitle}>Approval Notification</Text>
              <Text style={styles.testDesc}>Simulates restaurant approval</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={handleTestLockScreen}>
            <Text style={styles.testIcon}>🔒</Text>
            <View style={styles.testInfo}>
              <Text style={styles.testTitle}>Lock Screen Test (5 sec delay)</Text>
              <Text style={styles.testDesc}>Lock phone, notification arrives in 5s</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.testButton, styles.testButtonRemote]} onPress={handleTestRemote}>
            <Text style={styles.testIcon}>🌐</Text>
            <View style={styles.testInfo}>
              <Text style={styles.testTitle}>Remote Test (via Backend)</Text>
              <Text style={styles.testDesc}>Sends through your server → Expo → phone</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Token Actions */}
        {pushToken && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Push Token</Text>
            <Text style={styles.tokenText}>{pushToken}</Text>
            <View style={styles.tokenActions}>
              <TouchableOpacity style={styles.smallButton} onPress={handleCopyToken}>
                <Text style={styles.smallButtonText}>📋 Copy Token</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallButton} onPress={handleCheckBackend}>
                <Text style={styles.smallButtonText}>🔍 Check Backend</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* How it works */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How It Works</Text>
          <Text style={styles.howText}>
            {`1. You login as admin in the app
2. App gets a Push Token (unique ID for your phone)
3. App sends token to your backend server
4. Backend saves: "Admin X uses token ABC"
5. Manager approves your restaurant
6. Backend sends notification via Expo Push API
7. Expo routes it to FCM (Android) or APNs (iOS)
8. Your phone shows notification with sound!

Even when your phone is locked! 🔒🔔`}
          </Text>
        </View>

        {/* Expo Push Tool */}
        <View style={[styles.card, styles.expoCard]}>
          <Text style={styles.cardTitle}>🌐 Test via Expo Website</Text>
          <Text style={styles.howText}>
            {`You can also test from a website:

1. Copy your Push Token (button above)
2. Open browser: expo.dev/notifications
3. Paste your token in the "Expo Push Token" field
4. Type a title and message
5. Click "Send a Notification"
6. Your phone will get the notification!

This proves notifications work even from outside your app.`}
          </Text>
        </View>

        {/* Activity Log */}
        {logs.length > 0 && (
          <View style={styles.card}>
            <View style={styles.logHeader}>
              <Text style={styles.cardTitle}>Activity Log</Text>
              <TouchableOpacity onPress={() => setLogs([])}>
                <Text style={styles.clearLog}>Clear</Text>
              </TouchableOpacity>
            </View>
            {logs.map((log, i) => (
              <View key={i} style={styles.logRow}>
                <Text style={styles.logTime}>{log.time}</Text>
                <View style={[styles.logDot, {
                  backgroundColor: log.type === 'success' ? '#22c55e'
                    : log.type === 'error' ? '#ef4444'
                    : log.type === 'warning' ? '#f59e0b'
                    : '#6b7280'
                }]} />
                <Text style={[styles.logText, {
                  color: log.type === 'error' ? '#ef4444' : '#374151'
                }]} numberOfLines={3}>
                  {log.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  expoCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
    width: 100,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'right',
  },

  // Setup button
  setupButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Test buttons
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  testButtonRemote: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  testIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  testInfo: {
    flex: 1,
  },
  testTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  testDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // Token
  tokenText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#166534',
    backgroundColor: '#dcfce7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  tokenActions: {
    flexDirection: 'row',
    gap: 10,
  },
  smallButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  // How it works
  howText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },

  // Log
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearLog: {
    fontSize: 13,
    color: '#6b7280',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  logTime: {
    fontSize: 10,
    color: '#9ca3af',
    width: 60,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    marginRight: 6,
  },
  logText: {
    fontSize: 12,
    flex: 1,
    color: '#374151',
  },

  // Warning card
  warningCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    backgroundColor: '#fde68a',
    color: '#78350f',
  },
});
