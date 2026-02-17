import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/**
 * Skeleton - Shimmer loading placeholder
 * @param {Object} props - { width, height, borderRadius, style }
 */
const Skeleton = ({ width = '100%', height = 20, borderRadius = 8, style }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
};

/**
 * Skeleton group for cards
 */
export const SkeletonCard = ({ style }) => (
  <View style={[styles.card, style]}>
    <Skeleton width={60} height={60} borderRadius={12} />
    <View style={styles.cardContent}>
      <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="50%" height={12} style={{ marginBottom: 6 }} />
      <Skeleton width="30%" height={12} />
    </View>
  </View>
);

/**
 * Skeleton list
 */
export const SkeletonList = ({ count = 3, style }) => (
  <View style={style}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} style={{ marginBottom: 12 }} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
  },
  card: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
});

export default Skeleton;
