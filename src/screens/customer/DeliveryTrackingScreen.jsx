import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useOSRMETAUpdates from '../../hooks/useOSRMETAUpdates';
import api from '../../services/api';

/**
 * DeliveryTrackingScreen - Detailed delivery tracking with driver info
 */
const DeliveryTrackingScreen = ({ navigation, route }) => {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const { etaText, distance } = useOSRMETAUpdates({
    origin: order?.driverLocation,
    destination: order?.deliveryLocation,
    enabled: !!order?.driverLocation && !!order?.deliveryLocation,
    refreshInterval: 15000,
  });

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      setOrder(response.data);
    } catch (error) {
      console.warn('Tracking fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><Text>Loading tracking...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Delivery Tracking</Text>

        {etaText && (
          <View style={styles.etaBanner}>
            <Text style={styles.etaValue}>{etaText}</Text>
            {distance && <Text style={styles.etaDist}>{distance} km away</Text>}
          </View>
        )}

        {order?.driver && (
          <View style={styles.driverCard}>
            <Text style={styles.driverName}>{order.driver.name}</Text>
            <Text style={styles.driverPhone}>{order.driver.phone}</Text>
            <Text style={styles.driverVehicle}>{order.driver.vehicle}</Text>
          </View>
        )}

        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{order?.status || 'Unknown'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  etaBanner: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  etaValue: { fontSize: 24, fontWeight: '800', color: '#FF6B35' },
  etaDist: { fontSize: 13, color: '#9A3412', marginTop: 4 },
  driverCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, marginBottom: 16 },
  driverName: { fontSize: 16, fontWeight: '700', color: '#166534' },
  driverPhone: { fontSize: 14, color: '#166534', marginTop: 4 },
  driverVehicle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  statusSection: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16 },
  statusLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  statusValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
});

export default DeliveryTrackingScreen;
