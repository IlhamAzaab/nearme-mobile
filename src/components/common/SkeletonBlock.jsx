import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Reusable skeleton shimmer block.
 * Use width/height as numbers or strings ("100%", "75%").
 */
export default function SkeletonBlock({
  width: w,
  height: h,
  borderRadius: br = 12,
  style,
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  return (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          borderRadius: br,
          backgroundColor: "#CBD5E1",
          opacity,
        },
        style,
      ]}
    />
  );
}
