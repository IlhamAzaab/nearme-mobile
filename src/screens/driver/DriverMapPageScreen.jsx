import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * DriverMapPageScreen - Full map view for driver navigation
 */
const DriverMapPageScreen = ({ navigation, route }) => {
  // TODO: Integrate react-native-maps with live route navigation

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapText}>Driver Navigation Map</Text>
        <Text style={styles.mapSubtext}>Live route navigation will appear here</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapPlaceholder: { flex: 1, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  mapIcon: { fontSize: 60, marginBottom: 12 },
  mapText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  mapSubtext: { fontSize: 14, color: '#6B7280', marginTop: 4 },
});

export default DriverMapPageScreen;
