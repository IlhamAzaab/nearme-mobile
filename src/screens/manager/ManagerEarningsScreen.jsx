import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * ManagerEarningsScreen - Overview of platform earnings
 */
const ManagerEarningsScreen = ({ navigation }) => {
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week'); // today, week, month

  useEffect(() => {
    fetchEarnings();
  }, [period]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/manager/earnings', { params: { period } });
      setEarnings(response.data);
    } catch (error) {
      console.warn('Failed to fetch earnings:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Earnings Overview</Text>

        <View style={styles.periodRow}>
          {['today', 'week', 'month'].map((p) => (
            <Text
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          ))}
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Revenue</Text>
              <Text style={styles.totalAmount}>ETB {earnings?.totalRevenue || 0}</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard title="Commission" value={`ETB ${earnings?.commission || 0}`} color="#3B82F6" />
              <StatCard title="Delivery Fees" value={`ETB ${earnings?.deliveryFees || 0}`} color="#10B981" />
              <StatCard title="Restaurant Payouts" value={`ETB ${earnings?.restaurantPayouts || 0}`} color="#F59E0B" />
              <StatCard title="Driver Payouts" value={`ETB ${earnings?.driverPayouts || 0}`} color="#8B5CF6" />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Orders</Text>
                <Text style={styles.summaryValue}>{earnings?.totalOrders || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Avg Order Value</Text>
                <Text style={styles.summaryValue}>ETB {earnings?.avgOrderValue || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net Profit</Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>ETB {earnings?.netProfit || 0}</Text>
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
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', fontSize: 13, fontWeight: '600', color: '#6B7280', overflow: 'hidden' },
  periodBtnActive: { backgroundColor: '#3B82F6', color: '#fff' },
  totalCard: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 14, color: '#166534' },
  totalAmount: { fontSize: 36, fontWeight: '800', color: '#059669', marginTop: 4 },
  statsGrid: { gap: 10, marginBottom: 20 },
  statCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, borderLeftWidth: 4 },
  statTitle: { fontSize: 13, color: '#6B7280' },
  statValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  summaryCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default ManagerEarningsScreen;
