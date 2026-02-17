import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * DriverAcceptedScreen - Shows details of an accepted delivery
 */
const DriverAcceptedScreen = ({ navigation, route }) => {
  const { deliveryId } = route.params || {};
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDelivery();
  }, [deliveryId]);

  const fetchDelivery = async () => {
    try {
      const response = await api.get(`/deliveries/${deliveryId}`);
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
        <View style={styles.center}><Text>Loading delivery details...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Delivery Accepted ✅</Text>

        {delivery && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pickup</Text>
              <Text style={styles.restaurantName}>{delivery.restaurantName || 'Restaurant'}</Text>
              <Text style={styles.address}>{delivery.pickupAddress || 'N/A'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Dropoff</Text>
              <Text style={styles.customerName}>{delivery.customerName || 'Customer'}</Text>
              <Text style={styles.address}>{delivery.dropoffAddress || 'N/A'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Order Details</Text>
              <Text style={styles.items}>{delivery.itemCount || 0} items</Text>
              <Text style={styles.earnings}>Earnings: ETB {delivery.earnings || 0}</Text>
            </View>

            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => navigation.navigate('DriverMap', { deliveryId })}
            >
              <Text style={styles.navigateBtnText}>🗺️ Navigate to Pickup</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  restaurantName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  customerName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  address: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  items: { fontSize: 15, color: '#374151' },
  earnings: { fontSize: 16, fontWeight: '700', color: '#10B981', marginTop: 4 },
  navigateBtn: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  navigateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default DriverAcceptedScreen;
