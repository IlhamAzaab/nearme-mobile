import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * ProcessAdminPaymentScreen - Process payment to a restaurant admin
 */
const ProcessAdminPaymentScreen = ({ navigation, route }) => {
  const { paymentId, adminId } = route.params || {};
  const [admin, setAdmin] = useState(null);
  const [payment, setPayment] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [adminRes, paymentRes] = await Promise.all([
        api.get(`/manager/admins/${adminId}`),
        paymentId ? api.get(`/manager/admin-payments/${paymentId}`) : Promise.resolve({ data: null }),
      ]);
      setAdmin(adminRes.data);
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
      await api.post('/manager/admin-payments/process', {
        admin_id: adminId,
        amount: Number(amount),
      });
      Alert.alert('Success', 'Payment processed', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to process');
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
        <Text style={styles.title}>Process Admin Payment</Text>

        {admin && (
          <View style={styles.adminCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(admin.name || 'A')[0]}</Text>
            </View>
            <View>
              <Text style={styles.adminName}>{admin.name}</Text>
              <Text style={styles.restaurantName}>{admin.restaurant_name || 'Restaurant'}</Text>
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
              <Text style={styles.detailLabel}>Total Orders</Text>
              <Text style={styles.detailValue}>{payment.order_count || 0}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Revenue</Text>
              <Text style={styles.detailValue}>ETB {payment.total_revenue || 0}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Commission</Text>
              <Text style={styles.detailValue}>ETB {payment.commission || 0}</Text>
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
  adminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 24 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#D97706' },
  adminName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  restaurantName: { fontSize: 13, color: '#6B7280' },
  section: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, fontSize: 18, fontWeight: '700', borderWidth: 1, borderColor: '#E5E7EB', textAlign: 'center' },
  detailCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 24 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  processBtn: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  processBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ProcessAdminPaymentScreen;
