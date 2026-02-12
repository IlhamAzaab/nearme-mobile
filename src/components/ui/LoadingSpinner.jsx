import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

export default function LoadingSpinner({ size = 'large', message }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color="#2563eb" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  message: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
});
