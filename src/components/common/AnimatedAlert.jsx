import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

/**
 * AnimatedAlert - A slide-down/fade-in alert component
 * @param {Object} props - { visible, type, title, message, onDismiss, duration }
 */
const AnimatedAlert = ({
  visible = false,
  type = 'info', // info, success, warning, error
  title = '',
  message = '',
  onDismiss,
  duration = 4000,
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const colors = {
    info: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      dismiss();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors[type] || colors.info },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={styles.content}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <TouchableOpacity onPress={dismiss} style={styles.dismissBtn}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: { flex: 1 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 2 },
  message: { color: '#ffffffcc', fontSize: 13 },
  dismissBtn: { padding: 4, marginLeft: 8 },
  dismissText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});

export default AnimatedAlert;
