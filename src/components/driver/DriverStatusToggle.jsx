import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';

/**
 * DriverStatusToggle - Toggle between online/offline status
 */
const DriverStatusToggle = ({ isOnline = false, onToggle, disabled = false }) => {
  return (
    <View style={[styles.container, isOnline ? styles.online : styles.offline]}>
      <View style={styles.content}>
        <View style={[styles.indicator, isOnline ? styles.indicatorOnline : styles.indicatorOffline]} />
        <Text style={[styles.text, isOnline ? styles.textOnline : styles.textOffline]}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
      <Switch
        value={isOnline}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
        thumbColor={isOnline ? '#10B981' : '#9CA3AF'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  online: { backgroundColor: '#ECFDF5' },
  offline: { backgroundColor: '#F3F4F6' },
  content: { flexDirection: 'row', alignItems: 'center' },
  indicator: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  indicatorOnline: { backgroundColor: '#10B981' },
  indicatorOffline: { backgroundColor: '#9CA3AF' },
  text: { fontSize: 16, fontWeight: '600' },
  textOnline: { color: '#059669' },
  textOffline: { color: '#6B7280' },
});

export default DriverStatusToggle;
