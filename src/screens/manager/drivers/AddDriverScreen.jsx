import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * AddDriverScreen - Register a new driver to the platform
 */
const AddDriverScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    vehicleType: 'motorcycle',
    licensePlate: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key, value) => setForm({ ...form, [key]: value });

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/manager/drivers', form);
      Alert.alert('Success', 'Driver added successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add driver');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Add New Driver</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(v) => handleChange('fullName', v)}
          placeholder="Enter full name"
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(v) => handleChange('email', v)}
          placeholder="driver@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Phone *</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(v) => handleChange('phone', v)}
          placeholder="+251..."
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Vehicle Type</Text>
        <View style={styles.vehicleRow}>
          {['motorcycle', 'bicycle', 'car'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.vehicleBtn, form.vehicleType === type && styles.vehicleBtnActive]}
              onPress={() => handleChange('vehicleType', type)}
            >
              <Text style={[styles.vehicleText, form.vehicleType === type && styles.vehicleTextActive]}>
                {type === 'motorcycle' ? '🏍️' : type === 'bicycle' ? '🚲' : '🚗'} {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>License Plate</Text>
        <TextInput
          style={styles.input}
          value={form.licensePlate}
          onChangeText={(v) => handleChange('licensePlate', v)}
          placeholder="AA-1234"
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Adding...' : 'Add Driver'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#E5E7EB' },
  vehicleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  vehicleBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  vehicleBtnActive: { backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#3B82F6' },
  vehicleText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  vehicleTextActive: { color: '#1D4ED8' },
  submitBtn: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default AddDriverScreen;
