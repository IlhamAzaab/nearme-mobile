import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * AddAdminScreen - Add a new restaurant admin
 */
const AddAdminScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    restaurantName: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key, value) => setForm({ ...form, [key]: value });

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.phone || !form.restaurantName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/manager/admins', form);
      Alert.alert('Success', 'Restaurant admin added', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add admin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Add Restaurant Admin</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} value={form.fullName} onChangeText={(v) => handleChange('fullName', v)} placeholder="Admin full name" />

        <Text style={styles.label}>Email *</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={(v) => handleChange('email', v)} placeholder="admin@example.com" keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Phone *</Text>
        <TextInput style={styles.input} value={form.phone} onChangeText={(v) => handleChange('phone', v)} placeholder="+251..." keyboardType="phone-pad" />

        <Text style={styles.label}>Restaurant Name *</Text>
        <TextInput style={styles.input} value={form.restaurantName} onChangeText={(v) => handleChange('restaurantName', v)} placeholder="Restaurant name" />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Adding...' : 'Add Admin'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  submitBtn: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  disabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default AddAdminScreen;
