import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * DriverDepositsScreen - Driver's deposit history
 */
const DriverDepositsScreen = ({ navigation }) => {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    try {
      const response = await api.get('/driver/deposits');
      setDeposits(response.data?.deposits || []);
    } catch (error) {
      console.warn('Failed to fetch deposits:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDeposit = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.amount}>ETB {item.amount}</Text>
        <Text style={[styles.status, item.status === 'completed' ? styles.statusCompleted : styles.statusPending]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
      <Text style={styles.ref}>Ref: {item.reference || 'N/A'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Deposits</Text>
      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : deposits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💰</Text>
          <Text style={styles.emptyText}>No deposits yet</Text>
        </View>
      ) : (
        <FlatList
          data={deposits}
          renderItem={renderDeposit}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onRefresh={fetchDeposits}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', padding: 20, paddingBottom: 12 },
  list: { paddingHorizontal: 16 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  status: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusCompleted: { backgroundColor: '#ECFDF5', color: '#059669' },
  statusPending: { backgroundColor: '#FFF7ED', color: '#D97706' },
  date: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  ref: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});

export default DriverDepositsScreen;
