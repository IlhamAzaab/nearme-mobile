import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OrderMapLayout from '../../components/customer/OrderMapLayout';

/**
 * DeliveryMapScreen - Full-screen map showing delivery in progress
 */
const DeliveryMapScreen = ({ navigation, route }) => {
  const { orderId, driverLocation, deliveryLocation, restaurantLocation } = route.params || {};

  // TODO: Integrate with react-native-maps for live driver tracking

  return (
    <SafeAreaView style={styles.container}>
      <OrderMapLayout
        mapContent={
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapText}>🗺️ Map View</Text>
            <Text style={styles.mapSubtext}>Live tracking will appear here</Text>
          </View>
        }
        bottomContent={
          <View style={styles.info}>
            <Text style={styles.title}>Delivery in Progress</Text>
            <Text style={styles.orderId}>Order #{orderId}</Text>
            {/* TODO: Add driver info, ETA, etc. */}
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapText: { fontSize: 40, marginBottom: 8 },
  mapSubtext: { fontSize: 14, color: '#6B7280' },
  info: { padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  orderId: { fontSize: 14, color: '#6B7280', marginTop: 4 },
});

export default DeliveryMapScreen;
