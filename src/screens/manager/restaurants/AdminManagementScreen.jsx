import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * AdminManagementScreen - Manage restaurant admins
 */
const AdminManagementScreen = ({ navigation }) => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await api.get('/manager/admins');
      setAdmins(response.data?.admins || []);
    } catch (error) {
      console.warn('Failed to fetch admins:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = admins.filter((a) =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.restaurant_name?.toLowerCase().includes(search.toLowerCase())
  );

  const renderAdmin = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name || 'A')[0]}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.restaurant}>{item.restaurant_name || 'No restaurant'}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <View style={[styles.statusBadge, item.status === 'active' ? styles.active : styles.inactive]}>
        <Text style={styles.statusText}>{item.status || 'active'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Management</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddAdmin')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search admins or restaurants..."
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        renderItem={renderAdmin}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No admins found</Text>}
        onRefresh={fetchAdmins}
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
  searchInput: { marginHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#D97706' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  restaurant: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  email: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  active: { backgroundColor: '#ECFDF5' },
  inactive: { backgroundColor: '#FEF2F2' },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default AdminManagementScreen;
