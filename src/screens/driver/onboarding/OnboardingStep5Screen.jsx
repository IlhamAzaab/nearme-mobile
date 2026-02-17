import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * Driver Onboarding Step 5 - Review & Submit
 */
const OnboardingStep5Screen = ({ navigation, route }) => {
  const data = route.params || {};
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await api.post('/driver/onboarding/complete', data);
      Alert.alert('Application Submitted!', 'We will review your application and notify you once approved.', [
        { text: 'OK', onPress: () => navigation.navigate('DriverPending') },
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 5 of 5</Text>
        <Text style={styles.title}>Review & Submit</Text>
        <Text style={styles.subtitle}>Make sure everything looks correct</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          <Text style={styles.value}>{data.fullName}</Text>
          <Text style={styles.value}>{data.phone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <Text style={styles.value}>{data.vehicleType} - {data.licensePlate}</Text>
          {data.vehicleModel && <Text style={styles.value}>{data.vehicleModel}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <Text style={styles.value}>ID: {data.documents?.id ? '✅ Uploaded' : '❌ Missing'}</Text>
          <Text style={styles.value}>License: {data.documents?.license ? '✅ Uploaded' : '❌ Missing'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Details</Text>
          <Text style={styles.value}>{data.bankDetails?.bankName}</Text>
          <Text style={styles.value}>Account: {data.bankDetails?.accountNumber}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>{loading ? 'Submitting...' : 'Submit ✓'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24 },
  step: { fontSize: 13, color: '#FF6B35', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 24 },
  section: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  value: { fontSize: 15, color: '#1a1a1a', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  backBtnText: { color: '#6B7280', fontWeight: '600' },
  submitBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});

export default OnboardingStep5Screen;
