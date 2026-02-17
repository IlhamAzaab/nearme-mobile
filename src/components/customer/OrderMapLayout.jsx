import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * OrderMapLayout - Two-section layout with map on top and order info at bottom
 * @param {Object} props - { mapContent, bottomContent, mapHeight }
 */
const OrderMapLayout = ({ mapContent, bottomContent, mapHeight = SCREEN_HEIGHT * 0.5 }) => {
  return (
    <View style={styles.container}>
      <View style={[styles.mapContainer, { height: mapHeight }]}>
        {mapContent}
      </View>
      <View style={styles.bottomContainer}>
        {bottomContent}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  bottomContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingTop: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
});

export default OrderMapLayout;
