/**
 * OrderPlacedBackground — Celebratory animated hero for "Order Placed!" state.
 *
 * Features:
 *   • Dancing M-E-E-Z-O SVG letter shapes with staggered wave-bounce
 *   • Large transparent Meezo logo watermark
 *   • Floating food emojis drifting upward
 *   • Sparkle / twinkle stars
 *   • Confetti-like falling dots
 *   • Radial pulse ring behind status icon
 *   • Parallax-style layered green gradient
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Brand colours ───
const PRIMARY = "#06C168";
const BG_DARK = "#04A358";

// ═══════════════════════════════════════════════════════════
// MEEZO SVG LETTER PATHS (from official logo SVG)
// ═══════════════════════════════════════════════════════════

const PATHS = {
  M: "m455.98,475.4l-23.01,44.91c-1.96,3.83-5.1,6.86-9.03,8.71-30.64,14.45-56.96,26.84-66.45,31.3-2.31,1.09-5.25.69-7.61-1.03l-14.61-10.6-16.76-12.16-1.95-1.41c-4.49-3.26-10.24-2.47-12.57,1.71l-30.61,56.84c-7.03,13.06-20.71,20.85-36.62,20.85h-40.32c-3.86,0-6.8-4.34-5.11-7.51l41.38-76.8,21.66-40.22,3-5.57c11.39-21.13,40.35-25.25,62.84-8.93l12.1,8.78c9.65,7,19.3,14,28.95,21,3.09,2.25,6.19,4.5,9.28,6.74l82.97-39.09c1.44-.68,3.19,1.08,2.47,2.48Z",
  E1: "m564.84,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.14,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.36c2.14,0,4.76-1.74,5.85-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.7-3.88,5.84-3.88h34.77c2.13,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z",
  E2: "m674.3,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.13,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.37c2.13,0,4.75-1.74,5.84-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.71-3.88,5.84-3.88h34.77c2.14,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z",
  Z: "m796.84,470.43c2.16-2.3,1.79-4.86-.71-4.86h-101.74c-2.52,0-5.62,2.05-6.9,4.57l-17.16,33.68c-1.29,2.53-.29,4.58,2.24,4.58h27.48c2.5,0,2.88,2.56.72,4.85l-89.65,95.15c-2.16,2.29-1.78,4.85.72,4.85h112.31c2.52,0,5.62-2.04,6.9-4.57l10.68-33.68c1.29-2.53.28-4.57-2.25-4.57h-31.76c-2.5,0-2.87-2.57-.71-4.86l89.83-95.14Z",
  O: "m883.66,586.15h-68.56s.09-.07.13-.12c-1.92-.44-3.34-2.16-3.34-4.2,0-1.19.48-2.28,1.26-3.06.79-.79,1.87-1.27,3.06-1.27h60.25c1.19,0,2.27-.48,3.05-1.26.79-.78,1.27-1.86,1.27-3.06,0-2.38-1.94-4.32-4.32-4.32h-42.37s.09-.08.14-.12c-1.91-.45-3.32-2.16-3.32-4.2,0-1.19.48-2.27,1.26-3.05.79-.79,1.87-1.27,3.06-1.27h32.57c1.2,0,2.28-.48,3.06-1.26.78-.78,1.26-1.86,1.26-3.06,0-2.38-1.93-4.32-4.32-4.32h-14.84c4.43-4.21,8.72-8.5,12.77-12.92,20.38-22.25,24.31-49.41,10.74-63.1-14.41-14.57-43.15-12.8-69.81,4.29-26.28,16.84-43.27,43.87-40.63,65.46,1.87,15.19,4.5,30.02,6.94,44.95.82,5.09,1.72,10.15,2.67,15.37.6,3.31,3.07,5.55,5.92,6.22.6.15,1.21.22,1.83.22h65.52c1.19,0,2.27-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32h-52.95l.02-.02c-2.2-.2-3.92-2.06-3.92-4.3,0-1.19.48-2.27,1.26-3.06.78-.78,1.86-1.26,3.06-1.26h87.28c1.2,0,2.28-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32Zm-78.14-67.05c5-10.73,17.74-19.42,28.47-19.42s15.36,8.69,10.35,19.42c-4.99,10.71-17.74,19.41-28.46,19.41s-15.36-8.7-10.36-19.41Z",
};

// Each letter definition: path key, viewBox crop, and aspect ratio
const LETTER_H = 55;
const MEEZO_LETTERS = [
  { id: "M",  path: PATHS.M,  viewBox: "161 432 325 200", ar: 325 / 200 },
  { id: "E1", path: PATHS.E1, viewBox: "368 435 230 195", ar: 230 / 195 },
  { id: "E2", path: PATHS.E2, viewBox: "478 435 230 195", ar: 230 / 195 },
  { id: "Z",  path: PATHS.Z,  viewBox: "581 435 246 195", ar: 246 / 195 },
  { id: "O",  path: PATHS.O,  viewBox: "736 442 182 190", ar: 182 / 190 },
];

// ─── Floating emoji config ───
const FOOD_EMOJIS = ["🍔", "🍟", "🍕", "🛵", "🥡", "🍜", "🍗", "🎉", "🧁", "🍩"];

// ─── Sparkle positions (static but twinkle) ───
const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: Math.random() * SW,
  top: Math.random() * SH * 0.55,
  size: 4 + Math.random() * 6,
  delay: Math.random() * 2000,
}));

// ─── Confetti dots ───
const CONFETTI = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: Math.random() * SW,
  size: 4 + Math.random() * 5,
  color: ["#FFD700", "#FF6B6B", "#fff", "#A7F3D0", "#FBBF24", "#FB923C"][i % 6],
  delay: Math.random() * 3000,
  duration: 3000 + Math.random() * 2000,
}));

// ─── Floating emoji positions ───
const EMOJI_ITEMS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  emoji: FOOD_EMOJIS[i % FOOD_EMOJIS.length],
  left: (i / 10) * SW + Math.random() * 20 - 10,
  delay: i * 600,
  duration: 4000 + Math.random() * 2000,
  size: 22 + Math.random() * 14,
}));

/* ══════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════ */

export default function OrderPlacedBackground() {
  return (
    <View style={styles.root}>
      {/* Layer 0 — gradient bg */}
      <View style={styles.bgGradient1} />
      <View style={styles.bgGradient2} />
      <View style={styles.bgGradient3} />

      {/* Layer 1 — large transparent Meezo watermark */}
      <WatermarkLogo />

      {/* Layer 2 — confetti dots falling */}
      <ConfettiDots />

      {/* Layer 3 — floating food emojis rising */}
      <FloatingEmojis />

      {/* Layer 4 — sparkle twinkle stars */}
      <Sparkles />

      {/* Layer 5 — dancing MEEZO letters */}
      <DancingLetters />

      {/* Layer 6 — status icon */}
      <StatusCheckIcon />
    </View>
  );
}

/* ─── Watermark: faint full Meezo logo centered ─── */
const WatermarkLogo = React.memo(() => {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const scale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.05],
  });
  const opacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.12],
  });

  const W = SW * 1.1;
  const H = W * (220 / 780);

  return (
    <Animated.View
      style={[
        styles.watermark,
        { transform: [{ scale }], opacity },
      ]}
    >
      <Svg width={W} height={H} viewBox="150 420 780 220">
        <Path fill="#fff" d={PATHS.M} />
        <Path fill="#fff" d={PATHS.E1} />
        <Path fill="#fff" d={PATHS.E2} />
        <Path fill="#fff" d={PATHS.Z} />
        <Path fill="#fff" d={PATHS.O} />
      </Svg>
    </Animated.View>
  );
});

/* ─── Dancing MEEZO SVG letters with wave bounce ─── */
const DancingLetters = React.memo(() => {
  const count = MEEZO_LETTERS.length;
  const anims = useRef(MEEZO_LETTERS.map(() => new Animated.Value(0))).current;
  const scaleAnims = useRef(MEEZO_LETTERS.map(() => new Animated.Value(1))).current;
  const rotateAnims = useRef(MEEZO_LETTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    MEEZO_LETTERS.forEach((_, i) => {
      // Wave bounce (translateY)
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(anims[i], {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anims[i], {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay((count - 1 - i) * 150 + 400),
        ]),
      ).start();

      // Scale pop
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(scaleAnims[i], {
            toValue: 1.2,
            duration: 300,
            easing: Easing.out(Easing.back(3)),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnims[i], {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay((count - 1 - i) * 150 + 400),
        ]),
      ).start();

      // Subtle rotation wobble
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(rotateAnims[i], {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnims[i], {
            toValue: -1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnims[i], {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.delay((count - 1 - i) * 150 + 400),
        ]),
      ).start();
    });
  }, []);

  return (
    <View style={styles.lettersRow}>
      {MEEZO_LETTERS.map((letter, i) => {
        const w = LETTER_H * letter.ar;
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -22],
        });
        const rotate = rotateAnims[i].interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ["-8deg", "0deg", "8deg"],
        });
        return (
          <Animated.View
            key={letter.id}
            style={{
              transform: [
                { translateY },
                { scale: scaleAnims[i] },
                { rotate },
              ],
              shadowColor: "#000",
              shadowOffset: { width: 1, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Svg
              width={w}
              height={LETTER_H}
              viewBox={letter.viewBox}
            >
              <Path fill={letter.id === "O" ? "#fff" : "#000"} d={letter.path} />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
});

/* ─── Floating emojis rising from bottom ─── */
const FloatingEmojis = React.memo(() => {
  const anims = useRef(EMOJI_ITEMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    EMOJI_ITEMS.forEach((item, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(item.delay),
          Animated.timing(anims[i], {
            toValue: 1,
            duration: item.duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anims[i], {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, []);

  return (
    <>
      {EMOJI_ITEMS.map((item, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [SH * 0.5, -SH * 0.2],
        });
        const translateX = anims[i].interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, 15, -10, 12, 0],
        });
        const opacity = anims[i].interpolate({
          inputRange: [0, 0.1, 0.8, 1],
          outputRange: [0, 0.6, 0.5, 0],
        });
        return (
          <Animated.Text
            key={item.id}
            style={[
              styles.floatingEmoji,
              {
                left: item.left,
                fontSize: item.size,
                transform: [{ translateY }, { translateX }],
                opacity,
              },
            ]}
          >
            {item.emoji}
          </Animated.Text>
        );
      })}
    </>
  );
});

/* ─── Sparkle twinkle stars ─── */
const Sparkles = React.memo(() => {
  const anims = useRef(SPARKLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    SPARKLES.forEach((sp, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(sp.delay),
          Animated.timing(anims[i], {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anims[i], {
            toValue: 0,
            duration: 600,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(1000 + Math.random() * 1500),
        ]),
      ).start();
    });
  }, []);

  return (
    <>
      {SPARKLES.map((sp, i) => {
        const scale = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        });
        const opacity = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.9],
        });
        return (
          <Animated.Text
            key={sp.id}
            style={[
              styles.sparkle,
              {
                left: sp.left,
                top: sp.top,
                fontSize: sp.size + 6,
                transform: [{ scale }],
                opacity,
              },
            ]}
          >
            ✦
          </Animated.Text>
        );
      })}
    </>
  );
});

/* ─── Confetti dots falling ─── */
const ConfettiDots = React.memo(() => {
  const anims = useRef(CONFETTI.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    CONFETTI.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(dot.delay),
          Animated.timing(anims[i], {
            toValue: 1,
            duration: dot.duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(anims[i], {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, []);

  return (
    <>
      {CONFETTI.map((dot, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-20, SH * 0.6],
        });
        const rotate = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        });
        const opacity = anims[i].interpolate({
          inputRange: [0, 0.1, 0.7, 1],
          outputRange: [0, 0.7, 0.5, 0],
        });
        return (
          <Animated.View
            key={dot.id}
            style={[
              styles.confetti,
              {
                left: dot.left,
                width: dot.size,
                height: dot.size * 1.6,
                backgroundColor: dot.color,
                borderRadius: dot.size / 2,
                transform: [{ translateY }, { rotate }],
                opacity,
              },
            ]}
          />
        );
      })}
    </>
  );
});

/* ─── Central status check icon ─── */
const StatusCheckIcon = React.memo(() => {
  const pop = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance pop
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

    // Gentle continuous rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const scale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const rotateZ = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "3deg"],
  });

  return (
    <Animated.View
      style={[
        styles.statusIconGlyph,
        { transform: [{ scale }, { rotate: rotateZ }] },
      ]}
    >
      <Svg
        width={44}
        height={44}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#06C168"
        strokeWidth="2.5"
      >
        <Path
          d="M5 13l4 4L19 7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
});

/* ══════════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── layered green background ── */
  bgGradient1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PRIMARY,
  },
  bgGradient2: {
    position: "absolute",
    top: 0,
    left: -SW * 0.2,
    width: SW * 1.4,
    height: SH * 0.45,
    borderBottomLeftRadius: SW,
    borderBottomRightRadius: SW,
    backgroundColor: BG_DARK,
    opacity: 0.35,
  },
  bgGradient3: {
    position: "absolute",
    bottom: 0,
    left: -SW * 0.1,
    width: SW * 1.2,
    height: SH * 0.35,
    borderTopLeftRadius: SW * 0.8,
    borderTopRightRadius: SW * 0.8,
    backgroundColor: "#03944E",
    opacity: 0.2,
  },

  /* ── watermark logo ── */
  watermark: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── dancing letters ── */
  lettersRow: {
    position: "absolute",
    top: SH * 0.18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  /* ── floating emojis ── */
  floatingEmoji: {
    position: "absolute",
    bottom: 0,
  },

  /* ── sparkles ── */
  sparkle: {
    position: "absolute",
    color: "#FFD700",
    textShadowColor: "#FFD700",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  /* ── confetti dots ── */
  confetti: {
    position: "absolute",
    top: -10,
  },

  /* ── status check icon ── */
  statusIconGlyph: {
    alignItems: "center",
    justifyContent: "center",
  },
});
