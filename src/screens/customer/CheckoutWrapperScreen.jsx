import React from 'react';
import { View, StyleSheet } from 'react-native';
import CheckoutScreen from './CheckoutScreen';

/**
 * CheckoutWrapperScreen - Wrapper for checkout flow with additional cart context
 * Handles pre-checkout validation and order preparation
 */
const CheckoutWrapperScreen = ({ navigation, route }) => {
  // TODO: Add pre-checkout validation (minimum order, delivery availability, etc.)
  return (
    <View style={styles.container}>
      <CheckoutScreen navigation={navigation} route={route} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default CheckoutWrapperScreen;
