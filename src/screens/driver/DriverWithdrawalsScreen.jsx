import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * DriverWithdrawalsScreen - Driver withdrawal requests and history
 */
const DriverWithdrawalsScreen = ({ navigation }) => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [withdrawalRes, balanceRes] = await Promise.all([
        api.get('/driver/withdrawals'),
        api.get('/driver/balance'),
      ]);
      setWithdrawals(withdrawalRes.data?.withdrawals || []);
      setBalance(balanceRes.data?.balance || 0);
    } catch (error) {
      console.warn('Failed to fetch withdrawals:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = () => {
    if (balance <= 0) {
      Alert.alert('No Balance', 'You don\'t have any earnings to withdraw');
      return;
    }
    // TODO: Navigate to withdrawal request form
    Alert.alert('Request Withdrawal', `Available balance: ETB ${balance}`);
  };

  const renderWithdrawal = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.amount}>ETB {item.amount}</Text>
        <Text style={[styles.status, item.status === 'completed' ? styles.completed : item.status === 'pending' ? styles.pending : styles.failed]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Withdrawals</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>ETB {balance}</Text>
        <TouchableOpacity style={styles.withdrawBtn} onPress={handleRequestWithdrawal}>
          <Text style={styles.withdrawBtnText}>Request Withdrawal</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={withdrawals}
        renderItem={renderWithdrawal}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No withdrawal history</Text>}
        onRefresh={fetchData}
        refreshing={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', padding: 20, paddingBottom: 12 },
  balanceCard: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, margin: 16, alignItems: 'center' },
  balanceLabel: { fontSize: 13, color: '#166534' },
  balanceAmount: { fontSize: 32, fontWeight: '800', color: '#059669', marginVertical: 8 },
  withdrawBtn: { backgroundColor: '#059669', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  withdrawBtnText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  status: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  completed: { backgroundColor: '#ECFDF5', color: '#059669' },
  pending: { backgroundColor: '#FFF7ED', color: '#D97706' },
  failed: { backgroundColor: '#FEF2F2', color: '#DC2626' },
  date: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default DriverWithdrawalsScreen;
