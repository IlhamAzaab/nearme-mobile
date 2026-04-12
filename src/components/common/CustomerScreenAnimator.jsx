import { useMemo } from "react";
import { Animated, StyleSheet } from "react-native";
import usePageEnterAnimation from "../../hooks/usePageEnterAnimation";

export default function CustomerScreenAnimator({ children }) {
  const pageEnterStyle = usePageEnterAnimation({
    duration: 50,
    translateY: 6,
    animateOpacity: false,
  });

  const combinedStyle = useMemo(
    () => [styles.container, pageEnterStyle],
    [pageEnterStyle],
  );

  return <Animated.View style={combinedStyle}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
