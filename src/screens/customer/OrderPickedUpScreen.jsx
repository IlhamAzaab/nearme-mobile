import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * OrderPickedUpScreen - Shows when driver has picked up the order
 */
const OrderPickedUpScreen = ({ navigation, route }) => {
  const { orderId, driverName } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>📦</Text>
        <Text style={styles.title}>Order Picked Up!</Text>
        <Text style={styles.subtitle}>
          {driverName || 'Driver'} has collected your order from the restaurant
        </Text>
        <Text style={styles.info}>
          Your food is on its way. You'll be notified when the driver is nearby.
        </Text>

        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => navigation.navigate('TrackOrder', { orderId })}
        >
          <Text style={styles.trackBtnText}>Track Delivery</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 8 },
  info: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 32 },
  trackBtn: { backgroundColor: '#FF6B35', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, width: '100%', alignItems: 'center' },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default OrderPickedUpScreen;
