import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

const lastAnimatedAtByScreen = new Map();

export default function DriverScreenSection({
  screenKey,
  sectionIndex = 0,
  children,
  style,
  cooldownMs = 45 * 1000,
  duration = 360,
  delayStepMs = 70,
  translateY = 10,
  animateOpacity = true,
}) {
  const progress = useRef(new Animated.Value(1)).current;
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
      if (reduceMotionEnabled || !screenKey) {
        progress.setValue(1);
        return undefined;
      }

      const now = Date.now();
      const last = lastAnimatedAtByScreen.get(screenKey) || 0;
      const shouldAnimate = now - last > cooldownMs;

      if (!shouldAnimate) {
        progress.setValue(1);
        return undefined;
      }

      // Mark once so all sections in the same focus cycle use a shared cooldown.
      lastAnimatedAtByScreen.set(screenKey, now);

      progress.setValue(0);
      const transition = Animated.timing(progress, {
        toValue: 1,
        duration,
        delay: Math.max(0, sectionIndex) * delayStepMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

      transition.start();

      return () => {
        transition.stop();
      };
    }, [
      cooldownMs,
      delayStepMs,
      duration,
      progress,
      reduceMotionEnabled,
      screenKey,
      sectionIndex,
    ]),
  );

  const animatedStyle = useMemo(
    () => ({
      opacity: animateOpacity ? progress : 1,
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: reduceMotionEnabled ? [0, 0] : [translateY, 0],
          }),
        },
      ],
    }),
    [animateOpacity, progress, reduceMotionEnabled, translateY],
  );

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
