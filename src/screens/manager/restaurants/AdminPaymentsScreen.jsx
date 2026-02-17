import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * AdminPaymentsScreen - Manage payments to restaurant admins
 */
const AdminPaymentsScreen = ({ navigation }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0 });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await api.get('/manager/admin-payments');
      setPayments(response.data?.payments || []);
      setSummary(response.data?.summary || { totalPaid: 0, totalPending: 0 });
    } catch (error) {
      console.warn('Failed to fetch admin payments:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPayment = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProcessAdminPayment', { paymentId: item.id, adminId: item.admin_id })}
    >
      <View style={styles.row}>
        <View>
          <Text style={styles.name}>{item.restaurant_name || 'Restaurant'}</Text>
          <Text style={styles.admin}>{item.admin_name || 'Admin'}</Text>
        </View>
        <View style={styles.rightCol}>
          <Text style={styles.amount}>ETB {item.amount}</Text>
          <Text style={[styles.status, item.status === 'paid' ? styles.paid : styles.pendingPay]}>
            {item.status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Admin Payments</Text>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
          <Text style={styles.summaryLabel}>Total Paid</Text>
          <Text style={[styles.summaryValue, { color: '#059669' }]}>ETB {summary.totalPaid}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#FFF7ED' }]}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryValue, { color: '#D97706' }]}>ETB {summary.totalPending}</Text>
        </View>
      </View>

      <FlatList
        data={payments}
        renderItem={renderPayment}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No payment records</Text>}
        onRefresh={fetchPayments}
        refreshing={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', padding: 20, paddingBottom: 8 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#6B7280' },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  admin: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  status: { fontSize: 11, fontWeight: '600', marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  paid: { backgroundColor: '#ECFDF5', color: '#059669' },
  pendingPay: { backgroundColor: '#FFF7ED', color: '#D97706' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default AdminPaymentsScreen;
