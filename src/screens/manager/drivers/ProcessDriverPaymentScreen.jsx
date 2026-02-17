import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * ProcessDriverPaymentScreen - Process a specific driver payment
 */
const ProcessDriverPaymentScreen = ({ navigation, route }) => {
  const { paymentId, driverId } = route.params || {};
  const [driver, setDriver] = useState(null);
  const [payment, setPayment] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [driverRes, paymentRes] = await Promise.all([
        api.get(`/manager/drivers/${driverId}`),
        paymentId ? api.get(`/manager/driver-payments/${paymentId}`) : Promise.resolve({ data: null }),
      ]);
      setDriver(driverRes.data);
      if (paymentRes.data) {
        setPayment(paymentRes.data);
        setAmount(String(paymentRes.data.amount || ''));
      }
    } catch (error) {
      console.warn('Failed to fetch data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setProcessing(true);
    try {
      await api.post(`/manager/driver-payments/process`, {
        driver_id: driverId,
        amount: Number(amount),
      });
      Alert.alert('Success', 'Payment processed', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
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
        <Text style={styles.title}>Process Payment</Text>

        {driver && (
          <View style={styles.driverCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(driver.name || 'D')[0]}</Text>
            </View>
            <View>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverPhone}>{driver.phone}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Payment Amount (ETB)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
          />
        </View>

        {payment && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Payment Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Period</Text>
              <Text style={styles.detailValue}>{payment.period || 'Current'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Deliveries</Text>
              <Text style={styles.detailValue}>{payment.delivery_count || 0}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Earnings</Text>
              <Text style={styles.detailValue}>ETB {payment.total_earnings || 0}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.processBtn, processing && styles.disabled]}
          onPress={handleProcess}
          disabled={processing}
        >
          <Text style={styles.processBtnText}>{processing ? 'Processing...' : 'Process Payment'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 24 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#3B82F6' },
  driverName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  driverPhone: { fontSize: 13, color: '#6B7280' },
  section: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, fontSize: 18, fontWeight: '700', color: '#1a1a1a', borderWidth: 1, borderColor: '#E5E7EB', textAlign: 'center' },
  detailCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 24 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  processBtn: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  processBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ProcessDriverPaymentScreen;
