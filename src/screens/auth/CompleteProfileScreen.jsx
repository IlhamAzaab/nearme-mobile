import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";

export default function CompleteProfileScreen({ navigation, route }) {
  const { userId, accessToken } = route.params || {};

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const shakeX = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleChange = (key, value) => {
    setFormData((p) => ({ ...p, [key]: value }));
    setError("");
    if (key === "phone") setPhoneError("");
  };

  const validatePhone = (phone) => /^0\d{9}$/.test(phone);

  const handlePhoneBlur = async () => {
    if (formData.phone && !validatePhone(formData.phone)) {
      setPhoneError("Invalid phone number format (e.g., 0771234567)");
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (
      !formData.name.trim() ||
      !formData.phone.trim() ||
      !formData.address.trim() ||
      !formData.city.trim()
    ) {
      setError("All fields are required");
      triggerShake();
      return;
    }

    if (!validatePhone(formData.phone)) {
      setPhoneError("Invalid phone number format (e.g., 0771234567)");
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const effectiveAccessToken = accessToken || (await getAccessToken());
      if (!effectiveAccessToken) {
        setError("Session expired. Please login again.");
        setLoading(false);
        triggerShake();
        return;
      }

      // 1) Get email from backend
      const headers = {};
      headers.Authorization = `Bearer ${effectiveAccessToken}`;

      const userRes = await fetch(
        `${API_BASE_URL}/auth/user-email?userId=${encodeURIComponent(userId)}`,
        { headers },
      );
      const userData = await userRes.json().catch(() => ({}));

      if (!userRes.ok) {
        setError("Failed to retrieve user information");
        setLoading(false);
        triggerShake();
        return;
      }

      // 2) Complete profile
      const res = await fetch(`${API_BASE_URL}/auth/complete-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          username: formData.name.trim(),
          full_name: formData.name.trim(),
          email: userData.email,
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          access_token: effectiveAccessToken,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "Failed to complete profile");
        setLoading(false);
        triggerShake();
        return;
      }

      setLoading(false);

      // Navigate to OTP verification
      navigation.navigate("VerifyOtp", {
        userId,
        phone: formData.phone.trim(),
        accessToken: effectiveAccessToken,
      });
    } catch (err) {
      console.error("Profile completion error:", err);
      setError("Network error. Please try again.");
      setLoading(false);
      triggerShake();
    }
  };

  return (
    <LinearGradient
      colors={["#123321", "#1db95b", "#0a1f14"]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[styles.content, { transform: [{ translateX: shakeX }] }]}
          >
            {/* Header */}
            <View style={styles.headerWrap}>
              <View style={styles.headerCircle}>
                <Text style={styles.headerIcon}>👤</Text>
              </View>
              <Text style={styles.appTitle}>Complete Your Profile</Text>
              <Text style={styles.appSubtitle}>
                Just a few details to get you started
              </Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information 📝</Text>
              <Text style={styles.cardSub}>Fill in your details below</Text>

              {/* Error */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Name */}
              <Text style={styles.label}>Name *</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(v) => handleChange("name", v)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  style={styles.input}
                />
              </View>

              {/* Phone */}
              <Text style={[styles.label, { marginTop: 12 }]}>
                Phone Number *
              </Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  value={formData.phone}
                  onChangeText={(v) => handleChange("phone", v)}
                  onBlur={handlePhoneBlur}
                  placeholder="0771234567"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>
              {!!phoneError && (
                <Text style={styles.fieldError}>{phoneError}</Text>
              )}

              {/* Address */}
              <Text style={[styles.label, { marginTop: 12 }]}>
                Delivery Address *
              </Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>📍</Text>
                <TextInput
                  value={formData.address}
                  onChangeText={(v) => handleChange("address", v)}
                  placeholder="Enter your delivery address"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>

              {/* City */}
              <Text style={[styles.label, { marginTop: 12 }]}>City *</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🏙️</Text>
                <TextInput
                  value={formData.city}
                  onChangeText={(v) => handleChange("city", v)}
                  placeholder="Enter your city"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { marginTop: 18 },
                  (pressed || loading) && styles.pressed,
                  loading && { opacity: 0.75 },
                ]}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.primaryBtnText}>Saving...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Continue</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
    gap: 16,
  },

  headerWrap: { alignItems: "center", marginBottom: 10 },
  headerCircle: {
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
  headerIcon: { fontSize: 34 },
  appTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
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
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  cardSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
  },

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

  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
    marginLeft: 6,
    marginBottom: 6,
  },

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
  inputIcon: { width: 28, textAlign: "center", opacity: 0.7 },
  input: { flex: 1, color: "#111827", fontSize: 15, paddingHorizontal: 8 },

  fieldError: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 6,
  },

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

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
