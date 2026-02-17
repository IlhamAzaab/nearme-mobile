import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

/**
 * NotificationToast - A floating toast notification
 */
const NotificationToast = ({
  visible = false,
  title = '',
  message = '',
  type = 'info',
  onPress,
  onDismiss,
  duration = 3000,
  position = 'top', // top or bottom
}) => {
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          hide();
        }, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [visible]);

  const hide = () => {
    Animated.timing(translateY, {
      toValue: position === 'top' ? -100 : 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss?.());
  };

  if (!visible) return null;

  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', delivery: '🛵' };

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
        { transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        style={styles.inner}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <Text style={styles.icon}>{icons[type] || icons.info}</Text>
        <View style={styles.textContainer}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message} numberOfLines={2}>{message}</Text> : null}
        </View>
        <TouchableOpacity onPress={hide}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  top: { top: 60 },
  bottom: { bottom: 60 },
  inner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  icon: { fontSize: 24, marginRight: 12 },
  textContainer: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  message: { fontSize: 12, color: '#666' },
  dismiss: { fontSize: 16, color: '#999', padding: 4 },
});

export default NotificationToast;
