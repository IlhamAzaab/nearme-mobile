import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";
import { Animated, Easing } from "react-native";

export default function StaggeredFadeInUp({
  children,
  delay = 0,
  duration = 90,
  distance = 6,
  style,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  const clampedDelay = Math.min(Math.max(delay, 0), 60);

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(distance);

      const animation = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          delay: clampedDelay,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          delay: clampedDelay,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      animation.start();

      return () => {
        animation.stop();
      };
    }, [clampedDelay, distance, duration, opacity, translateY]),
  );

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
