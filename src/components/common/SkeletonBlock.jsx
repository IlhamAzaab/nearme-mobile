import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

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
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 560,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0.92],
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
