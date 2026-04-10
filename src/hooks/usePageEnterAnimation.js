import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

export default function usePageEnterAnimation({
  duration = 600,
  translateY = 12,
  useNativeDriver = true,
  animateOpacity = false,
} = {}) {
  const anim = useRef(new Animated.Value(1)).current;
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotionEnabled(Boolean(enabled));
      })
      .catch(() => {
        if (mounted) setReduceMotionEnabled(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotionEnabled(Boolean(enabled));
      },
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (reduceMotionEnabled) {
        anim.setValue(1);
        return undefined;
      }

      anim.setValue(0);
      const transition = Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      });

      transition.start();

      return () => {
        transition.stop();
      };
    }, [anim, duration, reduceMotionEnabled, useNativeDriver]),
  );

  return useMemo(
    () => ({
      opacity: animateOpacity ? anim : 1,
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: reduceMotionEnabled ? [0, 0] : [translateY, 0],
          }),
        },
      ],
    }),
    [anim, animateOpacity, reduceMotionEnabled, translateY],
  );
}
