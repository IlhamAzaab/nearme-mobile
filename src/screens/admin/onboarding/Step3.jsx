import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../../../config/env';

const SRI_LANKAN_BANKS = [
  'Bank of Ceylon',
  'Commercial Bank of Ceylon',
  'Sampath Bank',
  'DFCC Bank',
  'Seylan Bank',
  'Nations Trust Bank',
  'Pan Asia Bank',
  'Hatton National Bank',
  'Indian Bank',
  'Sri Lanka Savings Bank',
  'Axis Bank',
  'ICICI Bank',
  'HSBC Bank',
  'Citibank',
  'Standard Chartered Bank',
  'Amana Bank',
  'Warehouse Finance Company',
  'ACME Capital',
  "People's Bank",
  'Cooperative Rural Bank',
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

export default function Step3() {
  const navigation = useNavigation();

  const [form, setForm] = useState({
    accountHolderName: '',
    bankName: '',
    branch: '',
    accountNumber: '',
    accountNumberConfirm: '',
  });

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredBanks, setFilteredBanks] = useState(SRI_LANKAN_BANKS);

  // Filter banks based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = SRI_LANKAN_BANKS.filter((bank) =>
        bank.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredBanks(filtered);
    } else {
      setFilteredBanks(SRI_LANKAN_BANKS);
    }
  }, [searchTerm]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validate all required fields
    if (!form.accountHolderName || !form.bankName || !form.accountNumber) {
      Alert.alert('Validation Error', 'All fields are required');
      return;
    }

    // Validate account numbers match
    if (form.accountNumber !== form.accountNumberConfirm) {
      Alert.alert('Validation Error', 'Account numbers do not match');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');

      const res = await fetch(`${API_URL}/restaurant-onboarding/step-3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountHolderName: form.accountHolderName,
          bankName: form.bankName,
          branch: form.branch,
          accountNumber: form.accountNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data?.message || 'Failed to save bank details');
        return;
      }
      navigation.navigate('AdminOnboardingStep4');
    } catch (err) {
      console.error('Step3 submit error', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBank = (bank) => {
    updateField('bankName', bank);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const renderBankItem = ({ item }) => (
    <TouchableOpacity
      style={styles.bankItem}
      onPress={() => handleSelectBank(item)}
      activeOpacity={0.7}
    >
      <View style={styles.bankIcon}>
        <Text style={styles.bankIconText}>🏦</Text>
      </View>
      <Text style={styles.bankItemText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background Decorations */}
      <View style={styles.bgDecoration1} />
      <View style={styles.bgDecoration2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>🍴</Text>
            </View>
            <Text style={styles.headerTitle}>Bank Details</Text>
            <Text style={styles.headerSubtitle}>
              Payments will be routed to this account
            </Text>
          </View>

          {/* Progress Bar */}
          <StepProgress currentStep={3} totalSteps={5} />

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Account Holder Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Holder Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={form.accountHolderName}
                  onChangeText={(value) => updateField('accountHolderName', value)}
                  placeholder="Enter account holder name"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            {/* Bank Name with Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bank Name</Text>
              <TouchableOpacity
                style={styles.inputWrapper}
                onPress={() => setShowDropdown(true)}
                activeOpacity={0.8}
              >
                <View style={styles.selectContainer}>
                  <Text
                    style={[
                      styles.selectText,
                      !form.bankName && styles.selectPlaceholder,
                    ]}
                  >
                    {form.bankName || 'Select your bank'}
                  </Text>
                  <Text style={styles.dropdownIcon}>▼</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Branch Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Branch Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={form.branch}
                  onChangeText={(value) => updateField('branch', value)}
                  placeholder="Enter branch name"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            {/* Account Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Number</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={form.accountNumber}
                  onChangeText={(value) => updateField('accountNumber', value)}
                  placeholder="Enter account number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>
            </View>

            {/* Confirm Account Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Account Number</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={form.accountNumberConfirm}
                  onChangeText={(value) => updateField('accountNumberConfirm', value)}
                  placeholder="Re-enter account number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>
            </View>

            {/* Mismatch Warning */}
            {form.accountNumber &&
              form.accountNumberConfirm &&
              form.accountNumber !== form.accountNumberConfirm && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningIcon}>⚠️</Text>
                  <Text style={styles.warningText}>Account numbers do not match</Text>
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
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View style={styles.buttonLoading}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.submitButtonText}>Saving...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.submitButtonText}>Save & Continue</Text>
                    <Text style={styles.buttonArrow}>→</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bank Selection Modal */}
      <Modal
        visible={showDropdown}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowDropdown(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search banks..."
                placeholderTextColor="#9ca3af"
                autoFocus
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Bank List */}
            {filteredBanks.length > 0 ? (
              <FlatList
                data={filteredBanks}
                renderItem={renderBankItem}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                style={styles.bankList}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No banks found</Text>
                <Text style={styles.emptySubtitle}>Try a different search term</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 2,
    borderColor: '#dcfce7',
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  selectPlaceholder: {
    color: '#9ca3af',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#6b7280',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  clearIcon: {
    fontSize: 14,
    color: '#9ca3af',
    padding: 4,
  },
  bankList: {
    paddingHorizontal: 12,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  bankIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bankIconText: {
    fontSize: 18,
  },
  bankItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
