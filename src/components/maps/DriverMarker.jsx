import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export default function DriverMarker({ driver }) {
  return (
    <View style={styles.container}>
      <View style={styles.marker}>
        <Text style={styles.markerText}>🚗</Text>
      </View>
      {driver?.name && (
        <Text style={styles.driverName}>{driver.name}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerText: {
    fontSize: 20,
  },
  driverName: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
});
