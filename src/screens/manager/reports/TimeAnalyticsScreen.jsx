import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * TimeAnalyticsScreen - Time-based analytics (peak hours, busy days)
 */
const TimeAnalyticsScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/manager/reports/time-analytics', { params: { period } });
      setData(response.data);
    } catch (error) {
      console.warn('Failed to fetch time analytics:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderHourBar = (hour, orders, maxOrders) => {
    const width = maxOrders > 0 ? (orders / maxOrders) * 100 : 0;
    return (
      <View key={hour} style={styles.hourRow}>
        <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
        <View style={styles.barContainer}>
          <View style={[styles.bar, { width: `${width}%` }]} />
        </View>
        <Text style={styles.hourCount}>{orders}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Time Analytics</Text>

        <View style={styles.periodRow}>
          {['week', 'month', 'quarter'].map((p) => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Peak Hour</Text>
                <Text style={styles.summaryValue}>{data?.peakHour || '12:00'}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Busiest Day</Text>
                <Text style={styles.summaryValue}>{data?.busiestDay || 'Friday'}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Orders by Hour</Text>
              {(data?.hourlyOrders || []).map((item) => {
                const maxOrders = Math.max(...(data?.hourlyOrders || []).map((h) => h.orders));
                return renderHourBar(item.hour, item.orders, maxOrders);
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Orders by Day</Text>
              {(data?.dailyOrders || []).map((item, i) => (
                <View key={i} style={styles.dayRow}>
                  <Text style={styles.dayName}>{item.day}</Text>
                  <Text style={styles.dayOrders}>{item.orders} orders</Text>
                  <Text style={styles.dayRevenue}>ETB {item.revenue || 0}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Avg Delivery Time by Hour</Text>
              {(data?.avgDeliveryTimeByHour || []).map((item, i) => (
                <View key={i} style={styles.timeRow}>
                  <Text style={styles.timeHour}>{String(item.hour).padStart(2, '0')}:00</Text>
                  <Text style={styles.timeValue}>{item.avgTime} min</Text>
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
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#6B7280' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 },
  hourRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  hourLabel: { fontSize: 12, color: '#6B7280', width: 46 },
  barContainer: { flex: 1, height: 16, backgroundColor: '#F3F4F6', borderRadius: 4, marginHorizontal: 8 },
  bar: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },
  hourCount: { fontSize: 12, fontWeight: '600', color: '#374151', width: 30, textAlign: 'right' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dayName: { fontSize: 14, color: '#374151', width: 80 },
  dayOrders: { fontSize: 14, color: '#6B7280' },
  dayRevenue: { fontSize: 14, fontWeight: '700', color: '#059669' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  timeHour: { fontSize: 14, color: '#374151' },
  timeValue: { fontSize: 14, fontWeight: '600', color: '#3B82F6' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default TimeAnalyticsScreen;
