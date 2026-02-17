import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.6;

/**
 * SwipeToDeliver - Swipe button to confirm delivery actions
 * @param {Object} props - { onSwipeComplete, text, color }
 */
const SwipeToDeliver = ({
  onSwipeComplete,
  text = 'Swipe to Deliver',
  color = '#10B981',
  disabled = false,
}) => {
  const pan = useRef(new Animated.Value(0)).current;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx > 0) {
        pan.setValue(Math.min(gestureState.dx, SWIPE_THRESHOLD));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx >= SWIPE_THRESHOLD) {
        Animated.timing(pan, {
          toValue: SWIPE_THRESHOLD,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onSwipeComplete?.();
          // Reset after completion
          setTimeout(() => {
            Animated.timing(pan, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start();
          }, 500);
        });
      } else {
        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const progress = pan.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: `${color}20` }]}>
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: color,
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.6],
            }),
            width: pan,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.thumb,
          { backgroundColor: color },
          { transform: [{ translateX: pan }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.thumbText}>→</Text>
      </Animated.View>
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 30,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 2,
    elevation: 4,
  },
  thumbText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  text: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 60,
  },
});

export default SwipeToDeliver;
