import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Driver Onboarding Step 4 - Bank/Payment Information
 */
const OnboardingStep4Screen = ({ navigation, route }) => {
  const prevData = route.params || {};
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const handleNext = () => {
    if (!bankName.trim() || !accountNumber.trim()) {
      alert('Please fill in bank details');
      return;
    }
    navigation.navigate('DriverOnboardingStep5', {
      ...prevData,
      bankDetails: { bankName, accountNumber, accountHolder },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 4 of 5</Text>
        <Text style={styles.title}>Payment Details</Text>
        <Text style={styles.subtitle}>Where should we send your earnings?</Text>

        <Text style={styles.label}>Bank Name *</Text>
        <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g., Commercial Bank of Ethiopia" />

        <Text style={styles.label}>Account Number *</Text>
        <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="Enter account number" keyboardType="number-pad" />

        <Text style={styles.label}>Account Holder Name</Text>
        <TextInput style={styles.input} value={accountHolder} onChangeText={setAccountHolder} placeholder="Name on account" />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>Next →</Text>
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
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#F9FAFB', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  backBtnText: { color: '#6B7280', fontWeight: '600' },
  nextBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#FF6B35', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700' },
});

export default OnboardingStep4Screen;
