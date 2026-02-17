import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Driver Onboarding Step 2 - Vehicle Information
 */
const OnboardingStep2Screen = ({ navigation, route }) => {
  const prevData = route.params || {};
  const [vehicleType, setVehicleType] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  const vehicleTypes = ['Motorcycle', 'Bicycle', 'Car'];

  const handleNext = () => {
    if (!vehicleType || !licensePlate.trim()) {
      alert('Please fill in required fields');
      return;
    }
    navigation.navigate('DriverOnboardingStep3', { ...prevData, vehicleType, licensePlate, vehicleModel });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 2 of 5</Text>
        <Text style={styles.title}>Vehicle Information</Text>

        <Text style={styles.label}>Vehicle Type *</Text>
        <View style={styles.typeRow}>
          {vehicleTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeBtn, vehicleType === type && styles.typeBtnActive]}
              onPress={() => setVehicleType(type)}
            >
              <Text style={[styles.typeText, vehicleType === type && styles.typeTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>License Plate *</Text>
        <TextInput style={styles.input} value={licensePlate} onChangeText={setLicensePlate} placeholder="e.g., AA-1234" autoCapitalize="characters" />

        <Text style={styles.label}>Vehicle Model</Text>
        <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g., Honda CBR" />

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
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#F9FAFB', marginBottom: 16 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  typeBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF7ED' },
  typeText: { fontWeight: '600', color: '#6B7280' },
  typeTextActive: { color: '#FF6B35' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  backBtnText: { color: '#6B7280', fontWeight: '600' },
  nextBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#FF6B35', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700' },
});

export default OnboardingStep2Screen;
