import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * RestaurantManagementScreen - View and manage all restaurants
 */
const RestaurantManagementScreen = ({ navigation }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, inactive, pending

  useEffect(() => {
    fetchRestaurants();
  }, [filter]);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/manager/restaurants', { params });
      setRestaurants(response.data?.restaurants || []);
    } catch (error) {
      console.warn('Failed to fetch restaurants:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = restaurants.filter((r) =>
    r.name?.toLowerCase().includes(search.toLowerCase())
  );

  const renderRestaurant = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoText}>{(item.name || 'R')[0]}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.category}>{item.cuisine || 'Restaurant'}</Text>
          <Text style={styles.address}>{item.address || 'N/A'}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'active' ? styles.active : item.status === 'pending' ? styles.pending : styles.inactive]}>
          <Text style={styles.statusText}>{item.status || 'active'}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.stat}>{item.total_orders || 0} orders</Text>
        <Text style={styles.stat}>⭐ {item.rating || '0.0'}</Text>
        <Text style={styles.stat}>ETB {item.revenue || 0}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Restaurants</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search restaurants..."
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filters}>
        {['all', 'active', 'inactive', 'pending'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderRestaurant}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No restaurants found</Text>}
        onRefresh={fetchRestaurants}
        refreshing={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', padding: 20, paddingBottom: 8 },
  searchInput: { marginHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 8 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 6 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  filterActive: { backgroundColor: '#3B82F6' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  logoPlaceholder: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logoText: { fontSize: 18, fontWeight: '700', color: '#D97706' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  category: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  address: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  active: { backgroundColor: '#ECFDF5' },
  pending: { backgroundColor: '#FFF7ED' },
  inactive: { backgroundColor: '#FEF2F2' },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  stat: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default RestaurantManagementScreen;
