import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Driver Onboarding Step 3 - Document Upload
 */
const OnboardingStep3Screen = ({ navigation, route }) => {
  const prevData = route.params || {};
  const [idUploaded, setIdUploaded] = useState(false);
  const [licenseUploaded, setLicenseUploaded] = useState(false);
  const [insuranceUploaded, setInsuranceUploaded] = useState(false);

  const handleUpload = (docType) => {
    // TODO: Integrate with expo-image-picker
    Alert.alert('Upload', `${docType} upload will be implemented with image picker`);
    if (docType === 'ID') setIdUploaded(true);
    if (docType === 'License') setLicenseUploaded(true);
    if (docType === 'Insurance') setInsuranceUploaded(true);
  };

  const handleNext = () => {
    if (!idUploaded || !licenseUploaded) {
      alert('Please upload required documents');
      return;
    }
    navigation.navigate('DriverOnboardingStep4', { ...prevData, documents: { id: idUploaded, license: licenseUploaded, insurance: insuranceUploaded } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 3 of 5</Text>
        <Text style={styles.title}>Upload Documents</Text>
        <Text style={styles.subtitle}>We need these to verify your identity</Text>

        {[
          { label: 'National ID *', type: 'ID', uploaded: idUploaded },
          { label: "Driver's License *", type: 'License', uploaded: licenseUploaded },
          { label: 'Vehicle Insurance (optional)', type: 'Insurance', uploaded: insuranceUploaded },
        ].map((doc) => (
          <TouchableOpacity
            key={doc.type}
            style={[styles.uploadCard, doc.uploaded && styles.uploadCardDone]}
            onPress={() => handleUpload(doc.type)}
          >
            <View>
              <Text style={styles.uploadLabel}>{doc.label}</Text>
              <Text style={styles.uploadHint}>{doc.uploaded ? '✅ Uploaded' : 'Tap to upload'}</Text>
            </View>
            <Text style={styles.uploadIcon}>{doc.uploaded ? '✓' : '📷'}</Text>
          </TouchableOpacity>
        ))}

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
  uploadCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  uploadCardDone: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  uploadLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  uploadHint: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  uploadIcon: { fontSize: 24 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  backBtnText: { color: '#6B7280', fontWeight: '600' },
  nextBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#FF6B35', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700' },
});

export default OnboardingStep3Screen;
