import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * SalesReportsScreen - Sales analytics and trends
 */
const SalesReportsScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/manager/reports/sales', { params: { period } });
      setData(response.data);
    } catch (error) {
      console.warn('Failed to fetch sales reports:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Sales Reports</Text>

        <View style={styles.periodRow}>
          {['today', 'week', 'month', 'year'].map((p) => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Total Sales</Text>
              <Text style={styles.heroValue}>ETB {data?.totalSales || 0}</Text>
              <Text style={styles.heroChange}>
                {data?.changePercent > 0 ? '↑' : '↓'} {Math.abs(data?.changePercent || 0)}% vs previous
              </Text>
            </View>

            <View style={styles.grid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Orders</Text>
                <Text style={styles.metricValue}>{data?.totalOrders || 0}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Avg Basket</Text>
                <Text style={styles.metricValue}>ETB {data?.avgBasket || 0}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Selling Items</Text>
              {(data?.topItems || []).map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name || 'Item'}</Text>
                    <Text style={styles.itemSub}>{item.quantity || 0} sold</Text>
                  </View>
                  <Text style={styles.itemRevenue}>ETB {item.revenue || 0}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sales by Category</Text>
              {(data?.salesByCategory || []).map((cat, i) => (
                <View key={i} style={styles.catRow}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catValue}>ETB {cat.total || 0}</Text>
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
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  periodActive: { backgroundColor: '#3B82F6' },
  periodText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  periodTextActive: { color: '#fff' },
  heroCard: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  heroLabel: { fontSize: 14, color: '#1E40AF' },
  heroValue: { fontSize: 36, fontWeight: '800', color: '#1D4ED8', marginVertical: 4 },
  heroChange: { fontSize: 13, color: '#3B82F6' },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  metricCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, alignItems: 'center' },
  metricLabel: { fontSize: 12, color: '#6B7280' },
  metricValue: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 4 },
  rank: { fontSize: 16, fontWeight: '800', color: '#D1D5DB', width: 28 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  itemSub: { fontSize: 12, color: '#9CA3AF' },
  itemRevenue: { fontSize: 14, fontWeight: '700', color: '#059669' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  catName: { fontSize: 14, color: '#374151' },
  catValue: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default SalesReportsScreen;
