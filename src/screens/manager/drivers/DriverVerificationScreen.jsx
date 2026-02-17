import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * DriverVerificationScreen - Review and verify driver documents
 */
const DriverVerificationScreen = ({ navigation, route }) => {
  const { driverId } = route.params || {};
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDriver();
  }, [driverId]);

  const fetchDriver = async () => {
    try {
      const response = await api.get(`/manager/drivers/${driverId}`);
      setDriver(response.data);
    } catch (error) {
      console.warn('Failed to fetch driver:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (status) => {
    const action = status === 'approved' ? 'approve' : 'reject';
    Alert.alert(`${action.charAt(0).toUpperCase() + action.slice(1)} Driver`, `Are you sure you want to ${action} this driver?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setProcessing(true);
          try {
            await api.put(`/manager/drivers/${driverId}/verify`, { status });
            Alert.alert('Success', `Driver ${status}`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } catch (error) {
            Alert.alert('Error', 'Failed to update driver status');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><Text>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Driver Verification</Text>

        {driver && (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(driver.name || 'D')[0]}</Text>
              </View>
              <Text style={styles.name}>{driver.name}</Text>
              <Text style={styles.phone}>{driver.phone}</Text>
              <Text style={styles.email}>{driver.email}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vehicle Info</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type:</Text>
                <Text style={styles.infoValue}>{driver.vehicle_type || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>License Plate:</Text>
                <Text style={styles.infoValue}>{driver.license_plate || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Documents</Text>
              {(driver.documents || []).length > 0 ? (
                driver.documents.map((doc, i) => (
                  <View key={i} style={styles.docCard}>
                    <Text style={styles.docName}>{doc.type || `Document ${i + 1}`}</Text>
                    {doc.url && <Image source={{ uri: doc.url }} style={styles.docImage} resizeMode="contain" />}
                    <Text style={[styles.docStatus, doc.verified ? styles.docVerified : styles.docPending]}>
                      {doc.verified ? 'Verified' : 'Pending review'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDoc}>No documents uploaded</Text>
              )}
            </View>

            {driver.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.approveBtn]}
                  onPress={() => handleVerify('approved')}
                  disabled={processing}
                >
                  <Text style={styles.btnText}>Approve Driver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.rejectBtn]}
                  onPress={() => handleVerify('rejected')}
                  disabled={processing}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  profileCard: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#3B82F6' },
  name: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  phone: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  email: { fontSize: 14, color: '#6B7280' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  docCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  docName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  docImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 8 },
  docStatus: { fontSize: 12, fontWeight: '600' },
  docVerified: { color: '#059669' },
  docPending: { color: '#D97706' },
  noDoc: { fontSize: 14, color: '#9CA3AF' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  btnText: { color: '#fff', fontWeight: '700' },
  rejectBtnText: { color: '#DC2626', fontWeight: '700' },
});

export default DriverVerificationScreen;
