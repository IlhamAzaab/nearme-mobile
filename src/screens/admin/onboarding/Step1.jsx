import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../../../config/env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Step Progress Bar Component
function StepProgress({ currentStep, totalSteps }) {
  const steps = ['Personal', 'Restaurant', 'Location', 'Documents', 'Review'];
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

export default function Step1() {
  const navigation = useNavigation();
  const [userEmail, setUserEmail] = useState('');

  // Form state
  const [form, setForm] = useState({
    fullName: '',
    nicNumber: '',
    dateOfBirth: '',
    mobileNumber: '',
    homeAddress: '',
    profilePhotoUrl: '',
    nicFrontUrl: '',
    nicBackUrl: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({
    profilePhoto: false,
    nicFront: false,
    nicBack: false,
  });

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Fetch user email on mount
  useEffect(() => {
    fetchUserData();
    fetchSavedData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/auth/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUserEmail(data.email || '');
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  const fetchSavedData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/restaurant-onboarding/step-1`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setForm({
            fullName: data.fullName || '',
            nicNumber: data.nicNumber || '',
            dateOfBirth: data.dateOfBirth || '',
            mobileNumber: data.phone || '',
            homeAddress: data.homeAddress || '',
            profilePhotoUrl: data.profilePhotoUrl || '',
            nicFrontUrl: data.nicFrontUrl || '',
            nicBackUrl: data.nicBackUrl || '',
          });
          if (data.dateOfBirth) {
            setSelectedDate(new Date(data.dateOfBirth));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch saved data:', err);
    }
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // Image picker handler
  const handleImagePick = async (imageType) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: imageType === 'profilePhoto' ? [1, 1] : [16, 10],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(imageType, result.assets[0]);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadImage = async (imageType, asset) => {
    setUploading((prev) => ({ ...prev, [imageType]: true }));

    try {
      const token = await AsyncStorage.getItem('token');

      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: `${imageType}.jpg`,
      });
      formData.append('imageType', imageType);

      const res = await fetch(`${API_URL}/restaurant-onboarding/upload-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data?.message || 'Failed to upload image');
        return;
      }

      // Update form with the uploaded image URL
      const fieldMap = {
        profilePhoto: 'profilePhotoUrl',
        nicFront: 'nicFrontUrl',
        nicBack: 'nicBackUrl',
      };
      updateField(fieldMap[imageType], data.url);
    } catch (err) {
      console.error('File upload error:', err);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading((prev) => ({ ...prev, [imageType]: false }));
    }
  };

  // Date picker handler
  const handleDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      const formattedDate = date.toISOString().split('T')[0];
      updateField('dateOfBirth', formattedDate);
    }
  };

  // Validation functions
  const validateNIC = (nic) => {
    const oldNIC = /^[0-9]{9}[vVxX]$/;
    const newNIC = /^[0-9]{12}$/;
    return oldNIC.test(nic) || newNIC.test(nic);
  };

  const validateMobile = (mobile) => {
    const sriLankanMobile = /^(?:\+94|0)?7[0-9]{8}$/;
    return sriLankanMobile.test(mobile.replace(/\s/g, ''));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (form.fullName.trim().length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters';
    }

    if (!form.nicNumber.trim()) {
      newErrors.nicNumber = 'NIC number is required';
    } else if (!validateNIC(form.nicNumber)) {
      newErrors.nicNumber = 'Invalid NIC format (10-digit old or 12-digit new)';
    }

    if (!form.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }

    if (!form.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!validateMobile(form.mobileNumber)) {
      newErrors.mobileNumber = 'Invalid Sri Lankan mobile number';
    }

    if (!form.homeAddress.trim()) {
      newErrors.homeAddress = 'Home address is required';
    } else if (form.homeAddress.trim().length < 10) {
      newErrors.homeAddress = 'Address must be at least 10 characters';
    }

    if (!form.profilePhotoUrl) {
      newErrors.profilePhotoUrl = 'Profile photo is required';
    }

    if (!form.nicFrontUrl) {
      newErrors.nicFrontUrl = 'NIC front image is required';
    }

    if (!form.nicBackUrl) {
      newErrors.nicBackUrl = 'NIC back image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/restaurant-onboarding/step-1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: form.fullName,
          nicNumber: form.nicNumber,
          dateOfBirth: form.dateOfBirth,
          phone: form.mobileNumber,
          homeAddress: form.homeAddress,
          profilePhotoUrl: form.profilePhotoUrl,
          nicFrontUrl: form.nicFrontUrl,
          nicBackUrl: form.nicBackUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data?.message || 'Failed to save personal information');
        return;
      }
      navigation.navigate('AdminOnboardingStep2');
    } catch (err) {
      console.error('Step1 submit error', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderImageUploader = (label, imageType, urlField, errorField) => {
    const imageUrl = form[urlField];
    const isUploading = uploading[imageType];
    const hasError = errors[errorField];

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TouchableOpacity
          style={[styles.imageUploader, hasError && styles.imageUploaderError]}
          onPress={() => handleImagePick(imageType)}
          disabled={isUploading}
        >
          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
              <View style={styles.imageOverlay}>
                <Text style={styles.changeText}>Tap to change</Text>
              </View>
              <View style={styles.uploadedBadge}>
                <Text style={styles.uploadedBadgeText}>✓</Text>
              </View>
            </View>
          ) : isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#22c55e" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>📷</Text>
              <Text style={styles.uploadText}>Tap to upload</Text>
              <Text style={styles.uploadHint}>JPG or PNG, max 5MB</Text>
            </View>
          )}
        </TouchableOpacity>
        {hasError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{hasError}</Text>
          </View>
        )}
      </View>
    );
  };

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
              <Text style={styles.headerIconText}>👤</Text>
            </View>
            <Text style={styles.headerTitle}>Admin Onboarding</Text>
            <Text style={styles.headerSubtitle}>
              Let's get you set up with your restaurant
            </Text>
          </View>

          {/* Progress Bar */}
          <StepProgress currentStep={1} totalSteps={5} />

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIndicator} />
              <View>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <Text style={styles.sectionSubtitle}>
                  Basic details about you as the restaurant admin
                </Text>
              </View>
            </View>

            {/* Verified Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Verified Email</Text>
              <View style={styles.emailContainer}>
                <Text style={styles.emailText}>{userEmail || 'Loading...'}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedIcon}>✓</Text>
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                value={form.fullName}
                onChangeText={(value) => updateField('fullName', value)}
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
              />
              {errors.fullName && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errors.fullName}</Text>
                </View>
              )}
            </View>

            {/* NIC Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NIC Number</Text>
              <TextInput
                style={[styles.input, errors.nicNumber && styles.inputError]}
                value={form.nicNumber}
                onChangeText={(value) => updateField('nicNumber', value)}
                placeholder="eg: 123456789V or 200012345678"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
              />
              {errors.nicNumber && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errors.nicNumber}</Text>
                </View>
              )}
            </View>

            {/* Mobile Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <TextInput
                style={[styles.input, errors.mobileNumber && styles.inputError]}
                value={form.mobileNumber}
                onChangeText={(value) => updateField('mobileNumber', value)}
                placeholder="Enter your phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
              {errors.mobileNumber && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errors.mobileNumber}</Text>
                </View>
              )}
            </View>

            {/* Date of Birth */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateInput, errors.dateOfBirth && styles.inputError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text
                  style={[
                    styles.dateText,
                    !form.dateOfBirth && styles.datePlaceholder,
                  ]}
                >
                  {form.dateOfBirth || 'Select date of birth'}
                </Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </TouchableOpacity>
              {errors.dateOfBirth && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
                </View>
              )}
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}

            {/* Home Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Home Address</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  errors.homeAddress && styles.inputError,
                ]}
                value={form.homeAddress}
                onChangeText={(value) => updateField('homeAddress', value)}
                placeholder="Enter your complete home address"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {errors.homeAddress && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errors.homeAddress}</Text>
                </View>
              )}
            </View>

            {/* Image Uploads */}
            {renderImageUploader(
              'Profile Photo',
              'profilePhoto',
              'profilePhotoUrl',
              'profilePhotoUrl'
            )}
            {renderImageUploader(
              'NIC Front Image',
              'nicFront',
              'nicFrontUrl',
              'nicFrontUrl'
            )}
            {renderImageUploader(
              'NIC Back Image',
              'nicBack',
              'nicBackUrl',
              'nicBackUrl'
            )}

            {/* Submit Button */}
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
                  <Text style={styles.submitButtonText}>Next Step</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Spacing */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  sectionIndicator: {
    width: 4,
    height: 48,
    backgroundColor: '#22c55e',
    borderRadius: 2,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
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
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
  datePlaceholder: {
    color: '#9ca3af',
  },
  calendarIcon: {
    fontSize: 20,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emailText: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verifiedIcon: {
    fontSize: 12,
    color: '#16a34a',
    marginRight: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
  },
  imageUploader: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
    minHeight: 140,
  },
  imageUploaderError: {
    borderColor: '#ef4444',
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 140,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
  },
  changeText: {
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  uploadedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  uploadingContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  uploadPlaceholder: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 12,
    color: '#9ca3af',
  },
  submitButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
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
