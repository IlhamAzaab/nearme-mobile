import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * OrderDeliveredScreen - Confirmation that order has been delivered
 */
const OrderDeliveredScreen = ({ navigation, route }) => {
  const { orderId } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.title}>Order Delivered!</Text>
        <Text style={styles.subtitle}>
          Your order #{orderId} has been delivered. Enjoy your meal!
        </Text>

        <TouchableOpacity style={styles.rateBtn} onPress={() => {/* TODO: Navigate to rating */}}>
          <Text style={styles.rateBtnText}>⭐ Rate Your Experience</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
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
  subtitle: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 32 },
  rateBtn: { backgroundColor: '#FFF7ED', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, marginBottom: 12, width: '100%', alignItems: 'center' },
  rateBtnText: { color: '#FF6B35', fontSize: 16, fontWeight: '700' },
  homeBtn: { paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, width: '100%', alignItems: 'center' },
  homeBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
});

export default OrderDeliveredScreen;
