import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * ActiveDeliveryScreen - Shows the currently active delivery for customer
 */
const ActiveDeliveryScreen = ({ navigation, route }) => {
  const { orderId } = route.params || {};
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDelivery();
    const interval = setInterval(fetchDelivery, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchDelivery = async () => {
    try {
      const response = await api.get(`/deliveries/active/${orderId}`);
      setDelivery(response.data);
    } catch (error) {
      console.warn('Failed to fetch delivery:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><Text>Loading delivery info...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Active Delivery</Text>

        {delivery ? (
          <View style={styles.card}>
            <Text style={styles.status}>{delivery.status}</Text>
            <Text style={styles.driverName}>
              Driver: {delivery.driverName || 'Assigning...'}
            </Text>
            {delivery.eta && (
              <Text style={styles.eta}>ETA: {delivery.eta} mins</Text>
            )}
            {/* TODO: Add map preview */}
          </View>
        ) : (
          <Text style={styles.emptyText}>No active delivery found</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 20 },
  status: { fontSize: 16, fontWeight: '700', color: '#FF6B35', marginBottom: 8 },
  driverName: { fontSize: 15, color: '#374151', marginBottom: 4 },
  eta: { fontSize: 14, color: '#6B7280' },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
});

export default ActiveDeliveryScreen;
