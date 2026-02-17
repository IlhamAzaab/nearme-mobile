import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * DriverManagementScreen - List and manage all drivers
 */
const DriverManagementScreen = ({ navigation }) => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, inactive, pending

  useEffect(() => {
    fetchDrivers();
  }, [filter]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/manager/drivers', { params });
      setDrivers(response.data?.drivers || []);
    } catch (error) {
      console.warn('Failed to fetch drivers:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredDrivers = drivers.filter((d) =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.phone?.includes(search)
  );

  const renderDriver = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DriverVerification', { driverId: item.id })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name || 'D')[0]}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name || 'Unknown'}</Text>
        <Text style={styles.phone}>{item.phone || 'N/A'}</Text>
        <Text style={styles.vehicle}>{item.vehicle_type || 'motorcycle'}</Text>
      </View>
      <View style={[styles.statusBadge, item.status === 'active' ? styles.active : item.status === 'pending' ? styles.pending : styles.inactive]}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Management</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddDriver')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search drivers..."
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
        data={filteredDrivers}
        renderItem={renderDriver}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No drivers found</Text>}
        onRefresh={fetchDrivers}
        refreshing={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  addBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchInput: { marginHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, fontSize: 14 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, marginVertical: 12, gap: 6 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  filterActive: { backgroundColor: '#3B82F6' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#3B82F6' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  phone: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  vehicle: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  active: { backgroundColor: '#ECFDF5' },
  pending: { backgroundColor: '#FFF7ED' },
  inactive: { backgroundColor: '#FEF2F2' },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default DriverManagementScreen;
