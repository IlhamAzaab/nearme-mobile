import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * FinancialReportsScreen - Platform financial overview
 */
const FinancialReportsScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/manager/reports/financial', { params: { period } });
      setData(response.data);
    } catch (error) {
      console.warn('Failed to fetch financial reports:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Financial Reports</Text>

        <View style={styles.periodRow}>
          {['week', 'month', 'quarter', 'year'].map((p) => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Net Revenue</Text>
              <Text style={styles.summaryAmount}>ETB {data?.netRevenue || 0}</Text>
            </View>

            <View style={styles.grid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Gross Revenue</Text>
                <Text style={[styles.metricValue, { color: '#3B82F6' }]}>ETB {data?.grossRevenue || 0}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Commission</Text>
                <Text style={[styles.metricValue, { color: '#10B981' }]}>ETB {data?.totalCommission || 0}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Restaurant Payouts</Text>
                <Text style={[styles.metricValue, { color: '#F59E0B' }]}>ETB {data?.restaurantPayouts || 0}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Driver Payouts</Text>
                <Text style={[styles.metricValue, { color: '#8B5CF6' }]}>ETB {data?.driverPayouts || 0}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Breakdown</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total Orders</Text>
                <Text style={styles.breakdownValue}>{data?.totalOrders || 0}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Avg Order Value</Text>
                <Text style={styles.breakdownValue}>ETB {data?.avgOrderValue || 0}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Delivery Fees Collected</Text>
                <Text style={styles.breakdownValue}>ETB {data?.deliveryFees || 0}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Refunds</Text>
                <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>ETB {data?.refunds || 0}</Text>
              </View>
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
  summaryCard: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  summaryLabel: { fontSize: 14, color: '#166534' },
  summaryAmount: { fontSize: 36, fontWeight: '800', color: '#059669', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  metricCard: { width: '47%', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14 },
  metricLabel: { fontSize: 12, color: '#6B7280' },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  breakdownLabel: { fontSize: 14, color: '#6B7280' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default FinancialReportsScreen;
