import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { API_BASE_URL } from "../../constants/api";

export default function SignupScreen({ navigation }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // shake animation
  const shakeX = useRef(new Animated.Value(0)).current;

  const emailOk = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(formData.email.trim());
  }, [formData.email]);

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

  const handleChange = (key, value) => {
    setFormData((p) => ({ ...p, [key]: value }));
    setError("");
  };

  const validate = () => {
    const email = formData.email.trim();
    const password = formData.password;
    const confirm = formData.confirmPassword;

    if (!email || !password || !confirm) return "All fields are required";
    if (!emailOk) return "Please enter a valid email address";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirm) return "Passwords do not match";
    return "";
  };

  const handleSubmit = async () => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      // 1) Check availability
      const checkResponse = await fetch(`${API_BASE_URL}/auth/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim() }),
      });

      const checkData = await checkResponse.json().catch(() => ({}));

      if (!checkData?.emailAvailable) {
        setError(checkData?.message || "Email is not available");
        setLoading(false);
        triggerShake();
        return;
      }

      // 2) Signup
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.message || "Signup failed");
        setLoading(false);
        triggerShake();
        return;
      }

      setLoading(false);
      setSuccess(true);
    } catch (err) {
      console.error("Signup error:", err);
      setLoading(false);
      setError("Network error. Please try again.");
      triggerShake();
    }
  };

  // ✅ Success Screen (green theme keep)
  if (success) {
    return (
      <LinearGradient colors={["#123321", "#1db95b", "#0a1f14"]} style={styles.container}>
        <View style={styles.successWrap}>
          <View style={styles.successCard}>
            <View style={styles.mailIconCircle}>
              <Text style={styles.mailIcon}>📧</Text>
            </View>

            <Text style={styles.successTitle}>Check Your Email!</Text>
            <Text style={styles.successText}>
              We've sent a verification link to{" "}
              <Text style={styles.emailHighlight}>{formData.email.trim()}</Text>
            </Text>

            <View style={styles.stepsBox}>
              <Text style={styles.stepsTitle}>Next steps:</Text>
              <Text style={styles.stepItem}>1) Open your email inbox</Text>
              <Text style={styles.stepItem}>2) Click the verification link</Text>
              <Text style={styles.stepItem}>3) Complete your profile</Text>
              <Text style={styles.stepItem}>4) Start ordering delicious food!</Text>
            </View>

            <Text style={styles.smallNote}>
              Didn't receive the email? Check spam folder or try again in a few minutes.
            </Text>

            <Pressable
              onPress={() => navigation.navigate("Login")}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Go to Login</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // ✅ Main Signup Screen
  return (
    <LinearGradient colors={["#123321", "#1db95b", "#0a1f14"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            <Text style={styles.cardTitle}>Create Account 🌱</Text>
            <Text style={styles.cardSub}>Sign up to get started</Text>

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                value={formData.email}
                onChangeText={(v) => handleChange("email", v)}
                placeholder="you@example.com"
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
                value={formData.password}
                onChangeText={(v) => handleChange("password", v)}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                style={[styles.input, { paddingRight: 48 }]}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>Must be at least 6 characters</Text>

            {/* Confirm Password */}
            <Text style={[styles.label, { marginTop: 10 }]}>Confirm Password</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>🛡️</Text>
              <TextInput
                value={formData.confirmPassword}
                onChangeText={(v) => handleChange("confirmPassword", v)}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirmPassword}
                style={[styles.input, { paddingRight: 48 }]}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((v) => !v)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showConfirmPassword ? "🙈" : "👁️"}</Text>
              </Pressable>
            </View>

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                { marginTop: 16 },
                (pressed || loading) && styles.pressed,
                loading && { opacity: 0.75 },
              ]}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.primaryBtnText}>Creating account...</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>Sign Up</Text>
              )}
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate("Login")}>
              <Text style={styles.footerLink}> Log in here</Text>
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

  // logo
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

  // card
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

  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  errorText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },

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
    position: "relative",
  },
  inputIcon: { width: 28, textAlign: "center", opacity: 0.7 },
  input: { flex: 1, color: "#111827", fontSize: 15, paddingHorizontal: 8 },

  eyeBtn: { position: "absolute", right: 10, height: "100%", justifyContent: "center" },
  eyeText: { fontSize: 16 },

  hint: { marginTop: 6, marginLeft: 6, color: "#9CA3AF", fontSize: 12 },

  primaryBtn: {
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
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  footerText: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  footerLink: { color: "#fff", fontWeight: "900", fontSize: 13, textDecorationLine: "underline" },

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

  // success
  successWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 18 },
  successCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    alignItems: "center",
  },
  mailIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: "#1db95b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  mailIcon: { fontSize: 34, color: "#fff" },

  successTitle: { fontSize: 22, fontWeight: "900", color: "#111827" },
  successText: { textAlign: "center", color: "#6B7280", marginTop: 8, lineHeight: 20 },
  emailHighlight: { color: "#1db95b", fontWeight: "900" },

  stepsBox: {
    width: "100%",
    marginTop: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  stepsTitle: { fontWeight: "900", color: "#111827", marginBottom: 6 },
  stepItem: { color: "#6B7280", marginTop: 2 },

  smallNote: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 12 },
});