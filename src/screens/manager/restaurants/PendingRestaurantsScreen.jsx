import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * PendingRestaurantsScreen - Restaurants awaiting approval
 */
const PendingRestaurantsScreen = ({ navigation }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const response = await api.get('/manager/restaurants/pending');
      setRestaurants(response.data?.restaurants || []);
    } catch (error) {
      console.warn('Failed to fetch pending restaurants:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await api.put(`/manager/restaurants/${id}/${action}`);
      Alert.alert('Success', `Restaurant ${action}d`);
      fetchPending();
    } catch (error) {
      Alert.alert('Error', `Failed to ${action} restaurant`);
    }
  };

  const renderRestaurant = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.owner}>Owner: {item.owner_name || 'N/A'}</Text>
      <Text style={styles.address}>{item.address || 'No address'}</Text>
      <Text style={styles.date}>Applied: {new Date(item.created_at).toLocaleDateString()}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.approveBtn]}
          onPress={() => handleAction(item.id, 'approve')}
        >
          <Text style={styles.approveBtnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.rejectBtn]}
          onPress={() => handleAction(item.id, 'reject')}
        >
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Pending Restaurants</Text>
      <Text style={styles.subtitle}>{restaurants.length} awaiting review</Text>

      <FlatList
        data={restaurants}
        renderItem={renderRestaurant}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>All caught up!</Text>
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
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  owner: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  address: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  date: { fontSize: 12, color: '#D1D5DB', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  approveBtnText: { color: '#fff', fontWeight: '700' },
  rejectBtnText: { color: '#DC2626', fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});

export default PendingRestaurantsScreen;
