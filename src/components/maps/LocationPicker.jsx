import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LocationPicker({ onLocationSelect }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Location</Text>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.placeholderText}>Tap to select location</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
  },
});
