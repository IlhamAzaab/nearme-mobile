import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * PendingDeliveriesScreen - View deliveries awaiting driver assignment
 */
const PendingDeliveriesScreen = ({ navigation }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const response = await api.get('/manager/deliveries/pending');
      setDeliveries(response.data?.deliveries || []);
    } catch (error) {
      console.warn('Failed to fetch pending deliveries:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDelivery = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.orderId}>Order #{item.order_id}</Text>
          <Text style={styles.restaurant}>{item.restaurant_name || 'Restaurant'}</Text>
        </View>
        <Text style={styles.time}>{item.waiting_time || '—'} min</Text>
      </View>
      <Text style={styles.address}>📍 {item.delivery_address || 'N/A'}</Text>
      <TouchableOpacity style={styles.assignBtn}>
        <Text style={styles.assignBtnText}>Assign Driver</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Pending Deliveries</Text>
      <Text style={styles.subtitle}>{deliveries.length} deliveries awaiting assignment</Text>

      <FlatList
        data={deliveries}
        renderItem={renderDelivery}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>All deliveries assigned</Text>
          </View>
        }
        onRefresh={fetchPending}
        refreshing={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', paddingHorizontal: 20, paddingTop: 20 },
  subtitle: { fontSize: 14, color: '#6B7280', paddingHorizontal: 20, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  restaurant: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  time: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  address: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  assignBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  assignBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});

export default PendingDeliveriesScreen;
