import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Driver Onboarding Step 1 - Personal Information
 */
const OnboardingStep1Screen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const handleNext = () => {
    if (!fullName.trim() || !phone.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    navigation.navigate('DriverOnboardingStep2', { fullName, phone, dateOfBirth });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 1 of 5</Text>
        <Text style={styles.title}>Personal Information</Text>
        <Text style={styles.subtitle}>Tell us about yourself</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Enter your full name" />

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+251 9XX XXX XXX" keyboardType="phone-pad" />

        <Text style={styles.label}>Date of Birth</Text>
        <TextInput style={styles.input} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="DD/MM/YYYY" />

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24 },
  step: { fontSize: 13, color: '#FF6B35', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#F9FAFB', marginBottom: 16 },
  nextBtn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default OnboardingStep1Screen;
