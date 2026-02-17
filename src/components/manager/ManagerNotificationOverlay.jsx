import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * ManagerNotificationOverlay - Full-screen overlay for critical manager alerts
 */
const ManagerNotificationOverlay = ({
  visible = false,
  title = '',
  message = '',
  type = 'info',
  actions = [],
  onDismiss,
}) => {
  if (!visible) return null;

  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '🚨',
    success: '✅',
    driver: '🛵',
    restaurant: '🏪',
    payment: '💰',
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.icon}>{icons[type] || icons.info}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.actions}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionBtn, action.primary && styles.primaryBtn]}
              onPress={action.onPress}
            >
              <Text style={[styles.actionText, action.primary && styles.primaryText]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          {actions.length === 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={onDismiss}>
              <Text style={styles.actionText}>Dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  primaryBtn: { backgroundColor: '#1E293B' },
  actionText: { fontWeight: '700', fontSize: 14, color: '#374151' },
  primaryText: { color: '#fff' },
});

export default ManagerNotificationOverlay;
