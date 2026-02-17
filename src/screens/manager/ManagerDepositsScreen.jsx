import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * ManagerDepositsScreen - View and manage all deposits
 */
const ManagerDepositsScreen = ({ navigation }) => {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, completed

  useEffect(() => {
    fetchDeposits();
  }, [filter]);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/manager/deposits', { params });
      setDeposits(response.data?.deposits || []);
    } catch (error) {
      console.warn('Failed to fetch deposits:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDeposit = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('VerifyDeposit', { depositId: item.id })}
    >
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.name}>{item.restaurant_name || item.driver_name || 'Unknown'}</Text>
          <Text style={styles.type}>{item.type || 'deposit'}</Text>
        </View>
        <View style={styles.rightCol}>
          <Text style={styles.amount}>ETB {item.amount}</Text>
          <Text style={[styles.status, item.status === 'verified' ? styles.verified : styles.pendingStatus]}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Deposits</Text>

      <View style={styles.filters}>
        {['all', 'pending', 'completed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={deposits}
        renderItem={renderDeposit}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No deposits found</Text>}
        onRefresh={fetchDeposits}
        refreshing={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', padding: 20, paddingBottom: 8 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: '#3B82F6' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  type: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  status: { fontSize: 11, fontWeight: '600', marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  verified: { backgroundColor: '#ECFDF5', color: '#059669' },
  pendingStatus: { backgroundColor: '#FFF7ED', color: '#D97706' },
  date: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default ManagerDepositsScreen;
