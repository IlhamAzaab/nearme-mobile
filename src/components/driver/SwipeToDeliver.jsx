import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const KNOB_SIZE = 60;
const TRACK_HORIZONTAL_PADDING = 8;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.62;

/**
 * SwipeToDeliver - Swipe button to confirm delivery actions
 * @param {Object} props - { onSwipeComplete, text, color }
 */
const SwipeToDeliver = ({
  onSwipeComplete,
  text = "Swipe to Deliver",
  color = "#06C168",
  disabled = false,
  textStyle,
}) => {
  const pan = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(SWIPE_THRESHOLD);

  const maxTranslate = useMemo(() => {
    const effectiveTrackWidth = Math.max(
      KNOB_SIZE,
      containerWidth - TRACK_HORIZONTAL_PADDING * 2,
    );
    return Math.max(0, effectiveTrackWidth - KNOB_SIZE);
  }, [containerWidth]);

  const completionThreshold = useMemo(
    () => Math.max(6, maxTranslate * 0.08),
    [maxTranslate],
  );

  const finishSwipe = () => {
    Animated.timing(pan, {
      toValue: maxTranslate,
      duration: 100,
      useNativeDriver: false,
    }).start(() => {
      onSwipeComplete?.();
      Animated.timing(pan, {
        toValue: 0,
        duration: 120,
        useNativeDriver: false,
      }).start();
    });
  };

  const resetSwipe = () => {
    Animated.spring(pan, {
      toValue: 0,
      tension: 90,
      friction: 10,
      useNativeDriver: false,
    }).start();
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: (_, gestureState) =>
      !disabled &&
      Math.abs(gestureState.dx) > 5 &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx > 0) {
        pan.setValue(Math.min(gestureState.dx, maxTranslate));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      const currentValue = Number(pan.__getValue?.() || 0);
      const swipeDistance = Math.max(currentValue, gestureState.dx || 0);
      const shouldComplete =
        swipeDistance >= completionThreshold ||
        (gestureState.vx > 0.2 && swipeDistance >= completionThreshold * 0.5) ||
        swipeDistance >= 3;

      if (shouldComplete) {
        finishSwipe();
      } else {
        resetSwipe();
      }
    },
    onPanResponderTerminate: () => {
      const currentValue = Number(pan.__getValue?.() || 0);
      if (currentValue >= completionThreshold || currentValue >= 3) {
        finishSwipe();
      } else {
        resetSwipe();
      }
    },
  });

  const progress = pan.interpolate({
    inputRange: [0, Math.max(1, maxTranslate)],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const effectiveTrackWidth = Math.max(
    KNOB_SIZE,
    containerWidth - TRACK_HORIZONTAL_PADDING * 2,
  );

  const fillWidth = pan.interpolate({
    inputRange: [0, Math.max(1, maxTranslate)],
    outputRange: [KNOB_SIZE, effectiveTrackWidth],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[styles.container, { opacity: disabled ? 0.6 : 1 }]}
      onLayout={(event) => {
        const nextWidth = event?.nativeEvent?.layout?.width;
        if (Number.isFinite(nextWidth) && nextWidth > 0) {
          setContainerWidth(nextWidth);
        }
      }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: color,
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.18, 1],
            }),
            width: fillWidth,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.thumb,
          { backgroundColor: "#fff" },
          { transform: [{ translateX: pan }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={[styles.thumbText, { color }]}>›</Text>
      </Animated.View>
      <Text style={[styles.text, textStyle]}>{text}</Text>
      <Text style={[styles.chevrons, { color }]}>› › ›</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 76,
    borderRadius: 38,
    justifyContent: "center",
    marginVertical: 10,
    overflow: "hidden",
    paddingHorizontal: TRACK_HORIZONTAL_PADDING,
    backgroundColor: "#E5E7EB",
  },
  track: {
    position: "absolute",
    left: TRACK_HORIZONTAL_PADDING,
    top: TRACK_HORIZONTAL_PADDING,
    bottom: TRACK_HORIZONTAL_PADDING,
    borderRadius: 30,
  },
  thumb: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    left: TRACK_HORIZONTAL_PADDING,
    elevation: 4,
  },
  thumbText: { fontSize: 30, fontWeight: "700", lineHeight: 32 },
  text: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: "#065F46",
    marginLeft: 34,
  },
  chevrons: {
    position: "absolute",
    right: 16,
    fontSize: 26,
    lineHeight: 30,
    color: "#06C168",
    fontWeight: "700",
  },
});

export default SwipeToDeliver;
