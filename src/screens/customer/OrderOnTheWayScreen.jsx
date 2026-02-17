import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * OrderOnTheWayScreen - Shows when driver is en route with the order
 */
const OrderOnTheWayScreen = ({ navigation, route }) => {
  const { orderId, driverName, eta } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🛵</Text>
        <Text style={styles.title}>Order On The Way!</Text>
        <Text style={styles.subtitle}>
          {driverName || 'Your driver'} is heading to you
        </Text>

        {eta && (
          <View style={styles.etaCard}>
            <Text style={styles.etaLabel}>Estimated Arrival</Text>
            <Text style={styles.etaValue}>{eta} mins</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => navigation.navigate('DeliveryMap', { orderId })}
        >
          <Text style={styles.trackBtnText}>View on Map</Text>
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
  subtitle: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 24 },
  etaCard: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 32, width: '100%' },
  etaLabel: { fontSize: 12, color: '#9A3412' },
  etaValue: { fontSize: 32, fontWeight: '800', color: '#FF6B35', marginTop: 4 },
  trackBtn: { backgroundColor: '#FF6B35', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, width: '100%', alignItems: 'center' },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default OrderOnTheWayScreen;
