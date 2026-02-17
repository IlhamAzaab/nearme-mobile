import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * DeliveryNotificationOverlay - Full-screen overlay for incoming delivery requests
 */
const DeliveryNotificationOverlay = ({
  visible = false,
  delivery = {},
  onAccept,
  onReject,
  timeRemaining = 30,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.header}>🛵 New Delivery Request!</Text>

        <View style={styles.timer}>
          <Text style={styles.timerText}>{timeRemaining}s</Text>
        </View>

        <View style={styles.details}>
          <View style={styles.row}>
            <Text style={styles.label}>Restaurant</Text>
            <Text style={styles.value}>{delivery.restaurantName || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pickup</Text>
            <Text style={styles.value} numberOfLines={2}>{delivery.pickupAddress || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Dropoff</Text>
            <Text style={styles.value} numberOfLines={2}>{delivery.dropoffAddress || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Distance</Text>
            <Text style={styles.value}>{delivery.distance ? `${delivery.distance} km` : 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Earnings</Text>
            <Text style={[styles.value, styles.earnings]}>ETB {delivery.earnings || '0'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  header: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  timer: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: { fontSize: 20, fontWeight: '800', color: '#D97706' },
  details: { marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: { fontSize: 14, color: '#6B7280', flex: 1 },
  value: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 2, textAlign: 'right' },
  earnings: { color: '#10B981', fontSize: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  rejectBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  rejectText: { color: '#DC2626', fontWeight: '700', fontSize: 16 },
  acceptBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default DeliveryNotificationOverlay;
