import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ children, style }) => (
  <View style={[styles.container, style]}>
    <Text style={styles.text}>🗺️</Text>
    <Text style={styles.label}>Map View</Text>
    <Text style={styles.sublabel}>Maps are available on mobile only</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  text: {
    fontSize: 32,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  sublabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});

export const Marker = ({ children }) => <View>{children}</View>;
export const Polyline = () => null;
export const UrlTile = () => null;

export default MapView;
