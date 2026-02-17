import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OrderStatusLayout from '../../components/customer/OrderStatusLayout';
import useETAUpdates from '../../hooks/useETAUpdates';
import api from '../../services/api';

/**
 * TrackOrderScreen - Real-time order tracking with map and status
 */
const TrackOrderScreen = ({ navigation, route }) => {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const { etaText, distance } = useETAUpdates({
    orderId,
    origin: order?.driverLocation,
    destination: order?.deliveryLocation,
    enabled: !!order?.driverLocation,
  });

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.warn('Failed to fetch order:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Loading tracking info...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Track Order #{orderId}</Text>

        {etaText && (
          <View style={styles.etaCard}>
            <Text style={styles.etaLabel}>Estimated Arrival</Text>
            <Text style={styles.etaValue}>{etaText}</Text>
            {distance && <Text style={styles.etaDistance}>{distance} km away</Text>}
          </View>
        )}

        <OrderStatusLayout currentStatus={order?.status}>
          <View style={styles.orderInfo}>
            <Text style={styles.restaurantName}>{order?.restaurantName || 'Restaurant'}</Text>
            {order?.driverName && (
              <View style={styles.driverInfo}>
                <Text style={styles.driverLabel}>Your Driver</Text>
                <Text style={styles.driverName}>{order.driverName}</Text>
              </View>
            )}
          </View>
        </OrderStatusLayout>

        {/* TODO: Add map view showing driver location */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  etaCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  etaLabel: { fontSize: 12, color: '#9A3412', fontWeight: '500' },
  etaValue: { fontSize: 28, fontWeight: '800', color: '#FF6B35', marginTop: 4 },
  etaDistance: { fontSize: 13, color: '#9A3412', marginTop: 4 },
  orderInfo: { marginTop: 16 },
  restaurantName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  driverInfo: { marginTop: 12, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10 },
  driverLabel: { fontSize: 12, color: '#166534' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#166534', marginTop: 2 },
});

export default TrackOrderScreen;
