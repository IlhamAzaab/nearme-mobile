import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, StatusBar, Animated } from "react-native";
import Svg, { G, Path } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const LOGO_SIZE = SCREEN_WIDTH * 1.1;

// ─── M Letter SVG (left piece) ───
function MLetterSvg({ size }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 6000 6000"
      style={{ position: "absolute" }}
    >
      <G transform="translate(0,6000) scale(1,-1)" stroke="none">
        <Path
          fill="#000000"
          d="M2392 3486 c-24 -6 -40 -15 -36 -19 4 -4 2 -7 -3 -7 -18 0 -78 -63
-92 -98 -7 -17 -18 -32 -23 -32 -5 0 -7 -4 -4 -9 4 -5 1 -11 -4 -13 -6 -2
-12 -10 -13 -18 -1 -8 -22 -51 -46 -95 -25 -44 -44 -82 -43 -85 0 -3 -5 -12
-12 -20 -7 -8 -24 -37 -37 -65 -13 -27 -27 -52 -31 -55 -4 -3 -32 -53 -61
-110 -88 -170 -131 -252 -160 -301 -25 -43 -26 -47 -10 -53 10 -4 92 -6 183
-5 161 2 260 17 260 39 0 6 7 10 17 10 9 0 14 2 11 6 -3 3 8 20 26 38 17 19
51 73 76 121 54 104 61 117 80 141 13 16 13 17 0 9 -8 -4 -6 2 6 16 11 13 33
51 49 84 32 67 69 105 102 105 25 0 93 -37 93 -52 0 -5 4 -7 9 -4 5 3 11 -1
15 -9 3 -8 12 -15 21 -15 8 0 15 -3 15 -8 0 -4 18 -18 39 -32 22 -13 37 -29
34 -34 -4 -6 -3 -8 1 -4 5 4 25 -4 46 -17 27 -17 40 -21 48 -13 6 6 19 12 29
13 18 2 74 25 83 35 3 3 21 13 40 22 59 29 195 91 200 92 3 1 31 15 64 31 53
27 110 74 112 93 2 14 18 47 41 84 13 21 23 45 23 53 0 9 5 13 10 10 6 -3 10
1 10 9 0 8 11 35 24 60 l24 46 -26 -7 c-15 -3 -64 -25 -109 -48 -45 -23 -93
-45 -107 -49 -14 -3 -26 -11 -26 -17 0 -6 -4 -7 -10 -4 -5 3 -10 2 -10 -3 0
-5 -24 -17 -54 -26 -30 -10 -60 -24 -67 -32 -6 -8 -18 -14 -27 -14 -8 0 -39
-13 -68 -30 -50 -28 -54 -29 -83 -14 -17 9 -28 20 -25 26 4 6 -2 8 -16 3 -15
-5 -20 -4 -16 3 4 6 -21 30 -56 53 -35 24 -69 49 -76 56 -7 7 -17 13 -21 13
-4 0 -17 8 -29 18 -54 45 -63 52 -71 52 -4 0 -16 9 -26 20 -10 11 -21 17 -25
15 -5 -3 -10 -2 -12 2 -17 40 -169 63 -256 39z"
        />
      </G>
    </Svg>
  );
}

// ─── I Letter SVG (right piece) ───
function ILetterSvg({ size }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 6000 6000"
      style={{ position: "absolute" }}
    >
      <G transform="translate(0,6000) scale(1,-1)" stroke="none">
        <Path
          fill="#000000"
          d="M3768 3488 c-16 -5 -28 -14 -28 -19 0 -5 -6 -9 -13 -9 -7 0 -18 -12
-24 -27 -16 -37 -104 -197 -112 -203 -3 -3 -33 -58 -65 -123 -33 -66 -70 -134
-83 -153 -12 -19 -23 -41 -23 -49 0 -8 -4 -15 -9 -15 -5 0 -13 -10 -17 -22
-3 -13 -14 -32 -23 -42 -11 -13 -12 -17 -2 -11 8 4 1 -12 -16 -36 -17 -24
-38 -62 -49 -84 -10 -22 -23 -43 -28 -47 -6 -4 -7 -8 -2 -8 5 0 2 -8 -6 -17
-24 -29 -59 -104 -53 -113 3 -5 87 -8 188 -7 171 2 185 4 232 27 47 23 95 61
95 76 0 3 10 20 22 37 12 17 23 37 24 44 1 6 13 27 27 45 36 49 43 63 26 53
-11 -7 -11 -5 1 9 18 23 82 138 146 264 26 50 51 92 57 92 6 0 8 3 4 6 -3 4 5
27 20 53 42 76 71 128 100 179 31 52 38 92 20 104 -17 11 -376 8 -409 -4z"
        />
      </G>
    </Svg>
  );
}

// ─── Splash Screen ───
export default function SplashScreen() {
  // M piece — slides in from the left
  const mTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH * 0.6)).current;
  const mOpacity = useRef(new Animated.Value(0)).current;

  // I piece — slides in from the right
  const iTranslateX = useRef(new Animated.Value(SCREEN_WIDTH * 0.6)).current;
  const iOpacity = useRef(new Animated.Value(0)).current;

  // Final unified scale pulse after merge
  const mergeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Both pieces fade in + slide to center simultaneously — ultra slow
    Animated.parallel([
      // M: fade in
      Animated.timing(mOpacity, {
        toValue: 1,
        duration: 2800,
        useNativeDriver: true,
      }),
      // M: slide from left to center
      Animated.spring(mTranslateX, {
        toValue: 0,
        friction: 60,
        tension: 2,
        useNativeDriver: true,
      }),
      // I: fade in
      Animated.timing(iOpacity, {
        toValue: 1,
        duration: 2800,
        useNativeDriver: true,
      }),
      // I: slide from right to center
      Animated.spring(iTranslateX, {
        toValue: 0,
        friction: 60,
        tension: 2,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. After merge — subtle satisfying scale pulse
      Animated.sequence([
        Animated.timing(mergeScale, {
          toValue: 1.06,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(mergeScale, {
          toValue: 1,
          friction: 20,
          tension: 30,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#06C168"
        barStyle="light-content"
        translucent={false}
      />
      <Animated.View
        style={[styles.logoWrap, { transform: [{ scale: mergeScale }] }]}
      >
        {/* M letter — from left */}
        <Animated.View
          style={[
            styles.piece,
            { opacity: mOpacity, transform: [{ translateX: mTranslateX }] },
          ]}
        >
          <MLetterSvg size={LOGO_SIZE} />
        </Animated.View>

        {/* I letter — from right */}
        <Animated.View
          style={[
            styles.piece,
            { opacity: iOpacity, transform: [{ translateX: iTranslateX }] },
          ]}
        >
          <ILetterSvg size={LOGO_SIZE} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  piece: {
    position: "absolute",
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
