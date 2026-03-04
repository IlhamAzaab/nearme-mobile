import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen({ navigation }) {
  const [isDark, setIsDark] = useState(false);

  const theme = useMemo(() => {
    if (isDark) {
      return {
        bgTop: "#022c22",
        bgBottom: "#064e3b",
        secondary: "#064e3b",
        cardBorder: "rgba(255,255,255,0.15)",
        text: "#FFFFFF",
        textMuted: "rgba(255,255,255,0.75)",
        pill: "rgba(255,255,255,0.35)",
      };
    }
    return {
      bgTop: "#064e3b",
      bgBottom: "#10b981",
      secondary: "#064e3b",
      cardBorder: "rgba(255,255,255,0.20)",
      text: "#FFFFFF",
      textMuted: "rgba(255,255,255,0.80)",
      pill: "rgba(255,255,255,0.30)",
    };
  }, [isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Top Header Row */}
          <View style={styles.topHeader}>
            <Text style={styles.appName}>NearMe</Text>
            <Pressable
              onPress={() => navigation.replace("Login")}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
              hitSlop={10}
            >
              <Text style={styles.skipText}>SKIP</Text>
            </Pressable>
          </View>

          <View style={styles.centerArea}>
            {/* Big circle image */}
            <View style={styles.heroCircleOuter}>
              <View style={styles.heroCircle}>
                <Image
                  source={{
                    uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuC4mlQv7mTGxGS2e63g93RW0ZNzVscsuyXn0Z5kuy4YP-UjsAUMdAWYkqYwfgtmIfdV9hganE4FV-BF2YEaPvbOIhAoS2mw5DZoMOhpQxaiir5RDZpZAwOws0V8_yoAWAQwF0Ka6JgZ0bm12AOvLTkDwlvwn-dJgkr2TS4WuByo_xq_8ZDexYnBt46NNtiYabwrdx6ZNtyDyQCD6uoFbYdNXTvoUZFU_nddTf_WQ4zIZbHmKlgYpWSR__b7ez3HJnmq7mXzflluL_c",
                  }}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={200}
                />
              </View>
            </View>

            {/* Title + subtitle */}
            <View style={styles.textBlock}>
              <Text style={styles.title}>
                Get the fastest{"\n"}
                <Text style={styles.titleItalic}>Delivery!</Text>
              </Text>

              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Your favorite meals and essentials, delivered right to your
                doorstep in minutes.
              </Text>
            </View>
          </View>

          {/* Bottom area */}
          <View style={styles.bottomArea}>
            {/* dots */}
            <View style={styles.dotsRow}>
              <View style={[styles.dotWide, { backgroundColor: "#fff" }]} />
              <View style={[styles.dot, { backgroundColor: "rgba(255,255,255,0.40)" }]} />
              <View style={[styles.dot, { backgroundColor: "rgba(255,255,255,0.40)" }]} />
            </View>

            {/* buttons */}
            <View style={styles.btnStack}>
              <Pressable
                onPress={() => navigation.navigate("Login")}
                style={({ pressed }) => [
                  styles.loginBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.loginText, { color: theme.secondary }]}>
                  Login  →
                </Text>
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate("Signup")}
                style={({ pressed }) => [
                  styles.signupBtn,
                  { borderColor: theme.cardBorder, backgroundColor: theme.secondary },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.signupText}>Sign Up</Text>
              </Pressable>
            </View>

            {/* Terms */}
            <Text style={[styles.terms, { color: "rgba(255,255,255,0.60)" }]}>
              By continuing, you agree to our{" "}
              <Text style={styles.termsLink}>Terms of Service</Text>
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Dark mode toggle (floating) */}
      <Pressable
        onPress={() => setIsDark((v) => !v)}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Text style={styles.fabText}>{isDark ? "☀️" : "🌙"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  gradient: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },

  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 5,
  },
  appName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 2,
  },

  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },

  heroCircleOuter: {
    width: width * 0.7,
    height: width * 0.7,
    maxWidth: 280,
    maxHeight: 280,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.20)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  heroCircle: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },

  textBlock: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 12,
  },
  titleItalic: {
    fontStyle: "italic",
    textDecorationLine: "underline",
    textDecorationColor: "#FACC15", // yellow-400 feel
  },
  subtitle: {
    textAlign: "center",
    fontSize: 15,
    maxWidth: 300,
    lineHeight: 22,
  },

  bottomArea: {
    paddingBottom: 20,
    paddingHorizontal: 4,
  },

  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  dotWide: {
    width: 34,
    height: 8,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  btnStack: {
    gap: 12,
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  loginText: {
    fontWeight: "900",
    fontSize: 16,
  },
  signupBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  signupText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  terms: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
  },
  termsLink: {
    textDecorationLine: "underline",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 40,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  fabText: {
    fontSize: 20,
  },

  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
});
