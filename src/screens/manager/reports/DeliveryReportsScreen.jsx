import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * DeliveryReportsScreen - Delivery performance analytics
 */
const DeliveryReportsScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await api.get('/manager/reports/deliveries');
      setData(response.data);
    } catch (error) {
      console.warn('Failed to fetch delivery reports:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, color = '#3B82F6' }) => (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Delivery Reports</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <View style={styles.grid}>
              <StatCard title="Total Deliveries" value={data?.totalDeliveries || 0} color="#3B82F6" />
              <StatCard title="Avg Delivery Time" value={`${data?.avgDeliveryTime || 0} min`} color="#10B981" />
              <StatCard title="Success Rate" value={`${data?.successRate || 0}%`} color="#059669" />
              <StatCard title="Active Drivers" value={data?.activeDrivers || 0} color="#8B5CF6" />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Performance</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>On-time delivery rate</Text>
                <Text style={styles.metricValue}>{data?.onTimeRate || 0}%</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Avg pickup time</Text>
                <Text style={styles.metricValue}>{data?.avgPickupTime || 0} min</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Cancelled deliveries</Text>
                <Text style={styles.metricValue}>{data?.cancelledDeliveries || 0}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Avg distance</Text>
                <Text style={styles.metricValue}>{data?.avgDistance || 0} km</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Drivers</Text>
              {(data?.topDrivers || []).map((driver, i) => (
                <View key={i} style={styles.driverRow}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.name || 'Driver'}</Text>
                    <Text style={styles.driverStat}>{driver.deliveries || 0} deliveries • ⭐ {driver.rating || 0}</Text>
                  </View>
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
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  metricLabel: { fontSize: 14, color: '#6B7280' },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  driverRow: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 4 },
  rank: { fontSize: 16, fontWeight: '800', color: '#D1D5DB', width: 28 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  driverStat: { fontSize: 12, color: '#9CA3AF' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default DeliveryReportsScreen;
