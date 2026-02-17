import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * NotificationBar - Persistent top banner for notifications
 */
const NotificationBar = ({
  message = '',
  type = 'info', // info, success, warning, error
  visible = false,
  onPress,
  onDismiss,
}) => {
  if (!visible || !message) return null;

  const colors = {
    info: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors[type] || colors.info }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '500' },
  dismissBtn: { padding: 4, marginLeft: 8 },
  dismissText: { color: '#fff', fontSize: 16 },
});

export default NotificationBar;
