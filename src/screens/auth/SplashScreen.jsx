import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';

/**
 * SplashScreen - App loading/splash screen
 */
const SplashScreen = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      onFinish?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.logo}>🍔</Text>
        <Text style={styles.title}>NearMe</Text>
        <Text style={styles.subtitle}>Food delivered to your door</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
  },
  logo: { fontSize: 80, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#ffffffcc', marginTop: 8, textAlign: 'center' },
});

export default SplashScreen;
