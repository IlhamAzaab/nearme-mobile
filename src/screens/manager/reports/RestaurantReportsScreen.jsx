import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * RestaurantReportsScreen - Restaurant performance analytics
 */
const RestaurantReportsScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await api.get('/manager/reports/restaurants');
      setData(response.data);
    } catch (error) {
      console.warn('Failed to fetch restaurant reports:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Restaurant Reports</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <View style={styles.grid}>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>Total Restaurants</Text>
                <Text style={[styles.statValue, { color: '#3B82F6' }]}>{data?.totalRestaurants || 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>Active</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>{data?.activeRestaurants || 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>Avg Rating</Text>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>⭐ {data?.avgRating || 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>Avg Prep Time</Text>
                <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{data?.avgPrepTime || 0}m</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Performing</Text>
              {(data?.topRestaurants || []).map((r, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{r.name || 'Restaurant'}</Text>
                    <Text style={styles.rowSub}>{r.total_orders || 0} orders • ⭐ {r.rating || 0}</Text>
                  </View>
                  <Text style={styles.rowValue}>ETB {r.revenue || 0}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category Breakdown</Text>
              {(data?.categories || []).map((cat, i) => (
                <View key={i} style={styles.catRow}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catCount}>{cat.count} restaurants</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: '47%', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16 },
  statTitle: { fontSize: 12, color: '#6B7280' },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 6 },
  rank: { fontSize: 16, fontWeight: '800', color: '#D1D5DB', width: 28 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowSub: { fontSize: 12, color: '#9CA3AF' },
  rowValue: { fontSize: 14, fontWeight: '700', color: '#059669' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  catName: { fontSize: 14, color: '#374151' },
  catCount: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default RestaurantReportsScreen;
