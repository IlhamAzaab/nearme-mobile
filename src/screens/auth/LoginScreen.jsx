import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import { useAuth } from "../../app/providers/AuthProvider";

export default function LoginScreen({ navigation }) {
  const { refreshAuthState } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // shake animation
  const shakeX = useRef(new Animated.Value(0)).current;

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  const triggerShake = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  async function handleLogin() {
    if (!canSubmit) {
      triggerShake();
      Alert.alert("Missing fields", "Please enter email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      console.log("🔐 Login response:", {
        token: data?.token ? `${String(data.token).substring(0, 20)}...` : "NULL",
        role: data?.role,
        profileCompleted: data?.profileCompleted,
        userId: data?.userId,
        userName: data?.userName,
      });

      if (res.status === 403) {
        setIsLoading(false);
        triggerShake();
        Alert.alert("Verify email", data?.message || "Please verify your email before logging in");
        return;
      }

      if (!res.ok) {
        setIsLoading(false);
        triggerShake();
        Alert.alert("Login failed", data?.message || "Invalid credentials");
        return;
      }

      // Save session
      if (data?.token) await AsyncStorage.setItem("token", data.token);
      if (data?.role) await AsyncStorage.setItem("role", data.role);
      await AsyncStorage.setItem("userEmail", email);

      if (data?.userId) await AsyncStorage.setItem("userId", String(data.userId));
      if (data?.userName) await AsyncStorage.setItem("userName", String(data.userName));

      setIsLoading(false);
      setIsTransitioning(true);

      setTimeout(async () => {
        // Refresh auth state - RootNavigator will automatically show correct screen
        await refreshAuthState();
      }, 1200);
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
      triggerShake();
      Alert.alert("Network error", "Backend connect aagala. Same Wi-Fi + IP correct ah check pannunga.");
    }
  }

  return (
    <LinearGradient colors={["#123321", "#1db95b", "#0a1f14"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Success overlay */}
        {isTransitioning && (
          <View style={styles.transitionOverlay}>
            <View style={styles.successCircle}>
              <Text style={styles.successTick}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Login Successful!</Text>
            <Text style={styles.successSub}>Redirecting...</Text>
          </View>
        )}

        <Animated.View style={[styles.content, { transform: [{ translateX: shakeX }] }]}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🛵</Text>
            </View>
            <Text style={styles.appTitle}>Near Me</Text>
            <Text style={styles.appSubtitle}>Your favorite food, fast.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back!</Text>
            <Text style={styles.cardSub}>Please sign in to continue</Text>

            {/* Email */}
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="user@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {/* Password */}
            <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                style={[styles.input, { paddingRight: 48 }]}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </Pressable>
            </View>

            {/* Button */}
            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.loginBtn,
                (pressed || isLoading) && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.loginBtnText}>Signing in...</Text>
                </View>
              ) : (
                <Text style={styles.loginBtnText}>Log In</Text>
              )}
            </Pressable>
          </View>

          {/* Signup link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Pressable onPress={() => navigation.navigate("Signup")}>
              <Text style={styles.footerLink}> Sign up here</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
    gap: 16,
  },

  logoWrap: { alignItems: "center", marginBottom: 10 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginBottom: 10,
  },
  logoIcon: { fontSize: 34 },
  appTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  appSubtitle: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontSize: 13 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cardTitle: { fontSize: 22, fontWeight: "900", color: "#111827", textAlign: "center" },
  cardSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 6, marginBottom: 14 },

  label: { fontSize: 13, fontWeight: "800", color: "#374151", marginLeft: 6, marginBottom: 6 },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    height: 52,
    paddingHorizontal: 12,
  },
  inputIcon: { width: 24, textAlign: "center", opacity: 0.6 },
  input: { flex: 1, color: "#111827", fontSize: 15, paddingHorizontal: 10 },

  eyeBtn: { position: "absolute", right: 10, height: "100%", justifyContent: "center" },
  eyeText: { fontSize: 16 },

  loginBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#1db95b",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1db95b",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  loginBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  footerText: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  footerLink: { color: "#fff", fontWeight: "900", fontSize: 13, textDecorationLine: "underline" },

  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 24,
  },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTick: { fontSize: 56, color: "#fff", fontWeight: "900" },
  successTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  successSub: { color: "rgba(255,255,255,0.85)", marginTop: 6 },
});
