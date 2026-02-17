import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * PastOrderDetailsScreen - Shows details of a completed order
 */
const PastOrderDetailsScreen = ({ navigation, route }) => {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.warn('Failed to fetch order details:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Order not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.orderId}>Order #{order.id}</Text>
          <Text style={styles.status}>{order.status}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant</Text>
          <Text style={styles.restaurantName}>{order.restaurantName || 'N/A'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {(order.items || []).map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.quantity}x {item.name}</Text>
              <Text style={styles.itemPrice}>ETB {item.price * item.quantity}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>ETB {order.subtotal || 0}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery Fee</Text>
            <Text style={styles.totalValue}>ETB {order.deliveryFee || 0}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>ETB {order.total || 0}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.reorderBtn} onPress={() => {/* TODO: Reorder */}}>
          <Text style={styles.reorderText}>Reorder</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  orderId: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  status: { fontSize: 14, fontWeight: '600', color: '#10B981', backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  restaurantName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemName: { fontSize: 15, color: '#374151' },
  itemPrice: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  totalSection: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 24 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 14, color: '#6B7280' },
  totalValue: { fontSize: 14, fontWeight: '500', color: '#374151' },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4, marginBottom: 0 },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  grandTotalValue: { fontSize: 16, fontWeight: '800', color: '#FF6B35' },
  reorderBtn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center' },
  reorderText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 16, color: '#EF4444', marginBottom: 16 },
  backBtn: { padding: 12, backgroundColor: '#F3F4F6', borderRadius: 8 },
  backBtnText: { color: '#374151', fontWeight: '600' },
});

export default PastOrderDetailsScreen;
