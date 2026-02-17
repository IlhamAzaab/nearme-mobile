import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_URL } from '../../../config/env';

const CONTRACT_VERSION = '1.0.0';

// Contract content as structured data for React Native
const CONTRACT_SECTIONS = [
  {
    title: 'NearMe Restaurant Partner Terms & Conditions (v1.0.0)',
    isHeader: true,
  },
  {
    title: '1. Partnership Agreement',
    content:
      'By accepting these terms, you agree to become an authorized NearMe restaurant partner. Your restaurant will be listed on the NearMe platform and made available to customers for food delivery and pickup services.',
  },
  {
    title: '2. Accuracy of Information',
    content:
      'You confirm that all submitted information including restaurant details, owner information, bank account details, and KYC documents are accurate and authentic. Any false or misleading information may result in account termination.',
  },
  {
    title: '3. Food Safety & Compliance',
    content:
      'You agree to comply with all local food safety regulations, health codes, and hygiene standards. Your restaurant must maintain valid licenses and permits required by law.',
  },
  {
    title: '4. Service Standards',
    content:
      'You commit to maintaining timely order preparation and delivery standards, accurate menu information, and professional customer service. Failure to maintain service standards may result in warnings or account suspension.',
  },
  {
    title: '5. Bank Account & Payments',
    content:
      'You authorize NearMe to route all payments to the bank account specified in your application. You are responsible for maintaining accurate and updated bank information. Any issues with payouts due to incorrect bank details are your responsibility.',
  },
  {
    title: '6. Account Verification',
    content:
      'Your account will remain in pending status until a NearMe manager reviews and verifies all submitted documents and information. This process typically takes 2-5 business days.',
  },
  {
    title: '7. Data & Privacy',
    content:
      'NearMe may collect and store data related to your account, transactions, and customer interactions. This data will be protected according to our privacy policy and will not be shared with third parties without your consent.',
  },
  {
    title: '8. Termination & Suspension',
    content:
      'NearMe reserves the right to suspend or terminate your account if you violate these terms, engage in fraudulent activity, or fail to maintain service standards. Suspended accounts will not receive orders or payments.',
  },
  {
    title: '9. Governing Law',
    content:
      'These terms are governed by the laws of Sri Lanka and you agree to resolve disputes through appropriate legal channels.',
  },
  {
    title: 'Last Updated: January 2026',
    isFooter: true,
  },
];

// Step Progress Bar Component
function StepProgress({ currentStep, totalSteps }) {
  const steps = ['Personal', 'Restaurant', 'Bank', 'Contract', 'Review'];
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.header}>
        <Text style={progressStyles.stepText}>Step {currentStep} of {totalSteps}</Text>
        <Text style={progressStyles.percentText}>{percentage}% Complete</Text>
      </View>

      {/* Progress Bar */}
      <View style={progressStyles.barContainer}>
        <View style={[progressStyles.barFill, { width: `${percentage}%` }]} />
      </View>

      {/* Step Indicators */}
      <View style={progressStyles.stepsRow}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View key={i} style={progressStyles.stepItem}>
            <View
              style={[
                progressStyles.stepCircle,
                i + 1 < currentStep && progressStyles.stepCompleted,
                i + 1 === currentStep && progressStyles.stepCurrent,
                i + 1 > currentStep && progressStyles.stepPending,
              ]}
            >
              {i + 1 < currentStep ? (
                <Text style={progressStyles.checkmark}>✓</Text>
              ) : (
                <Text
                  style={[
                    progressStyles.stepNumber,
                    i + 1 === currentStep && progressStyles.stepNumberCurrent,
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={progressStyles.stepLabel}>{steps[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
  },
  barContainer: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 5,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCompleted: {
    backgroundColor: '#22c55e',
  },
  stepCurrent: {
    backgroundColor: '#16a34a',
    borderWidth: 4,
    borderColor: '#bbf7d0',
  },
  stepPending: {
    backgroundColor: '#d1d5db',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepNumberCurrent: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
});

export default function Step4() {
  const navigation = useNavigation();

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ipAddress, setIpAddress] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState('');

  // Fetch IP address on component mount
  useEffect(() => {
    const getIpAddress = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        setIpAddress(data.ip);
      } catch (e) {
        console.error('Failed to fetch IP address:', e);
      }
    };
    getIpAddress();

    // Get device info for user agent equivalent
    const deviceString = `${Device.brand || 'Unknown'} ${Device.modelName || 'Device'} - ${Platform.OS} ${Platform.Version} - Expo ${Constants.expoVersion || 'SDK'}`;
    setDeviceInfo(deviceString);
  }, []);

  const handleSubmit = async () => {
    if (!accepted) {
      Alert.alert('Required', 'Please accept the contract to continue');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');

      const res = await fetch(`${API_URL}/restaurant-onboarding/step-4`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contractAccepted: true,
          contractVersion: CONTRACT_VERSION,
          ipAddress: ipAddress || null,
          userAgent: deviceInfo,
          acceptedAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data?.message || 'Failed to submit contract');
        return;
      }

      // Navigate to pending screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'AdminOnboardingPending' }],
      });
    } catch (err) {
      console.error('Step4 submit error', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderContractSection = (section, index) => {
    if (section.isHeader) {
      return (
        <Text key={index} style={styles.contractHeader}>
          {section.title}
        </Text>
      );
    }

    if (section.isFooter) {
      return (
        <Text key={index} style={styles.contractFooter}>
          {section.title}
        </Text>
      );
    }

    return (
      <View key={index} style={styles.contractSection}>
        <Text style={styles.contractTitle}>{section.title}</Text>
        <Text style={styles.contractContent}>{section.content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background Decorations */}
      <View style={styles.bgDecoration1} />
      <View style={styles.bgDecoration2} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>📋</Text>
          </View>
          <Text style={styles.headerTitle}>Contract Acceptance</Text>
          <Text style={styles.headerSubtitle}>
            Review and accept the partner terms to finish onboarding
          </Text>
        </View>

        {/* Progress Bar */}
        <StepProgress currentStep={4} totalSteps={5} />

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Contract Content */}
          <View style={styles.contractContainer}>
            <ScrollView
              style={styles.contractScroll}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {CONTRACT_SECTIONS.map(renderContractSection)}
            </ScrollView>
          </View>

          {/* Accept Checkbox */}
          <TouchableOpacity
            style={[
              styles.checkboxContainer,
              accepted && styles.checkboxContainerActive,
            ]}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkbox,
                accepted && styles.checkboxChecked,
              ]}
            >
              {accepted && <Text style={styles.checkboxIcon}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              I have read and accept the terms above.
            </Text>
          </TouchableOpacity>

          {/* IP Address Info */}
          {ipAddress && (
            <View style={styles.ipContainer}>
              <Text style={styles.ipIcon}>🔒</Text>
              <Text style={styles.ipText}>
                Submission will be recorded with IP:{' '}
                <Text style={styles.ipAddress}>{ipAddress}</Text>
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!accepted || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!accepted || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.submitButtonText}>Accept & Finish</Text>
                  <Text style={styles.buttonArrow}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16a34a',
  },
  bgDecoration1: {
    position: 'absolute',
    top: 100,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  bgDecoration2: {
    position: 'absolute',
    bottom: 100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerIconText: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  contractContainer: {
    height: 300,
    borderWidth: 2,
    borderColor: '#dcfce7',
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    marginBottom: 20,
    overflow: 'hidden',
  },
  contractScroll: {
    flex: 1,
    padding: 16,
  },
  contractHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 16,
    textAlign: 'center',
  },
  contractSection: {
    marginBottom: 16,
  },
  contractTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  contractContent: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  contractFooter: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#dcfce7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  checkboxContainerActive: {
    borderColor: '#22c55e',
    backgroundColor: '#dcfce7',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#9ca3af',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkboxIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  ipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ipIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  ipText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  ipAddress: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: '#374151',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#86efac',
    shadowOpacity: 0.1,
  },
  buttonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLoading: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonArrow: {
    fontSize: 18,
    color: '#ffffff',
    marginLeft: 8,
  },
});
