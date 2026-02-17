import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * PlacingOrderScreen - Shown while order is being placed/processed
 */
const PlacingOrderScreen = ({ navigation, route }) => {
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.8, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // Dot animations
    const animateDots = () => {
      Animated.stagger(200, [
        Animated.sequence([
          Animated.timing(dotAnim1, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim1, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotAnim2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim2, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotAnim3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotAnim3, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start(() => animateDots());
    };
    animateDots();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.Text style={[styles.icon, { transform: [{ scale: scaleAnim }] }]}>
          📝
        </Animated.Text>
        <Text style={styles.title}>Placing Your Order</Text>
        <Text style={styles.subtitle}>Please wait while we confirm your order...</Text>
        <View style={styles.dots}>
          {[dotAnim1, dotAnim2, dotAnim3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  dots: { flexDirection: 'row', marginTop: 24, gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6B35' },
});

export default PlacingOrderScreen;
