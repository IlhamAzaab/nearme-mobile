import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';

/**
 * CustomerReportsScreen - Customer analytics and reports
 */
const CustomerReportsScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await api.get('/manager/reports/customers');
      setData(response.data);
    } catch (error) {
      console.warn('Failed to fetch customer reports:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, color = '#3B82F6' }) => (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Customer Reports</Text>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <View style={styles.grid}>
              <StatCard title="Total Customers" value={data?.totalCustomers || 0} color="#3B82F6" />
              <StatCard title="Active (30d)" value={data?.activeCustomers || 0} color="#10B981" />
              <StatCard title="New This Month" value={data?.newCustomers || 0} color="#8B5CF6" />
              <StatCard title="Retention Rate" value={`${data?.retentionRate || 0}%`} color="#F59E0B" />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Customers</Text>
              {(data?.topCustomers || []).map((customer, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{customer.name || 'Customer'}</Text>
                    <Text style={styles.rowSub}>{customer.total_orders || 0} orders</Text>
                  </View>
                  <Text style={styles.rowValue}>ETB {customer.total_spent || 0}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Insights</Text>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Avg orders/customer</Text>
                <Text style={styles.insightValue}>{data?.avgOrdersPerCustomer || 0}</Text>
              </View>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Avg order value</Text>
                <Text style={styles.insightValue}>ETB {data?.avgOrderValue || 0}</Text>
              </View>
              <View style={styles.insightRow}>
                <Text style={styles.insightLabel}>Repeat order rate</Text>
                <Text style={styles.insightValue}>{data?.repeatRate || 0}%</Text>
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
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: '47%', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16 },
  statTitle: { fontSize: 12, color: '#6B7280' },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  statSubtitle: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 6 },
  rank: { fontSize: 16, fontWeight: '800', color: '#D1D5DB', width: 28 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowSub: { fontSize: 12, color: '#9CA3AF' },
  rowValue: { fontSize: 14, fontWeight: '700', color: '#059669' },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  insightLabel: { fontSize: 14, color: '#6B7280' },
  insightValue: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default CustomerReportsScreen;
