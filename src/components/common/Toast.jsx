import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

/**
 * Toast - Simple toast message at bottom of screen
 * @param {Object} props - { visible, message, type, duration, onHide }
 */
const Toast = ({
  visible = false,
  message = '',
  type = 'info', // info, success, error
  duration = 2500,
  onHide,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  const colors = {
    info: '#333',
    success: '#10B981',
    error: '#EF4444',
  };

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={[styles.toast, { backgroundColor: colors[type] || colors.info }]}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 32,
    right: 32,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '500', textAlign: 'center' },
});

export default Toast;
