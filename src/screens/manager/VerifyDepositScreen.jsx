import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * VerifyDepositScreen - Verify/approve a deposit submission
 */
const VerifyDepositScreen = ({ navigation, route }) => {
  const { depositId } = route.params || {};
  const [deposit, setDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDeposit();
  }, [depositId]);

  const fetchDeposit = async () => {
    try {
      const response = await api.get(`/manager/deposits/${depositId}`);
      setDeposit(response.data);
    } catch (error) {
      console.warn('Failed to fetch deposit:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (status) => {
    setProcessing(true);
    try {
      await api.put(`/manager/deposits/${depositId}/verify`, { status });
      Alert.alert('Success', `Deposit ${status}`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to process deposit');
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
        <Text style={styles.title}>Verify Deposit</Text>

        {deposit && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Depositor</Text>
              <Text style={styles.value}>{deposit.depositor_name || 'Unknown'}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.amountValue}>ETB {deposit.amount}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Reference</Text>
              <Text style={styles.value}>{deposit.reference || 'N/A'}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{new Date(deposit.created_at).toLocaleString()}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Bank</Text>
              <Text style={styles.value}>{deposit.bank_name || 'N/A'}</Text>
            </View>

            {deposit.receipt_url && (
              <View style={styles.receiptCard}>
                <Text style={styles.label}>Receipt</Text>
                <Image source={{ uri: deposit.receipt_url }} style={styles.receipt} resizeMode="contain" />
              </View>
            )}

            {deposit.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.approveBtn]}
                  onPress={() => handleVerify('approved')}
                  disabled={processing}
                >
                  <Text style={styles.btnText}>✅ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.rejectBtn]}
                  onPress={() => handleVerify('rejected')}
                  disabled={processing}
                >
                  <Text style={styles.rejectBtnText}>❌ Reject</Text>
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
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  amountValue: { fontSize: 24, fontWeight: '800', color: '#059669' },
  receiptCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 16 },
  receipt: { width: '100%', height: 200, borderRadius: 8, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rejectBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
});

export default VerifyDepositScreen;
