import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_BASE_URL } from "../../constants/api";
import pushNotificationService from "../../services/pushNotificationService";

// Inline the Meezo logo SVG XML (React Native can't import .svg directly without transformer)
const MEEZO_LOGO_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080">
  <defs><style>.cls-1{stroke-width:0px}</style></defs>
  <path class="cls-1" d="m479.93,533.8c-5.66-4.11-12.91-3.11-15.85,2.16l-38.59,71.65c-8.87,16.46-26.12,26.28-46.17,26.28h-50.83c-4.86,0-8.58-5.46-6.43-9.46l52.16-96.82c14.72-27.34,52.16-32.66,81.25-11.56l12.97,9.42.93.67,10.55,7.66Z"/>
  <path class="cls-1" d="m655.69,458.51l-29.01,56.61c-2.48,4.83-6.43,8.64-11.39,10.98-38.62,18.22-71.81,33.83-83.77,39.46-2.91,1.37-6.62.87-9.6-1.3l-18.42-13.37-21.13-15.32,65.6-30.91,104.6-49.29c1.81-.85,4.02,1.36,3.11,3.13Z"/>
  <path class="cls-1" d="m547.98,504.67l-65.6,30.91-2.45-1.78-10.55-7.66-.93-.67-12.97-9.42c-29.09-21.1-66.53-15.78-81.25,11.56l27.3-50.7,3.78-7.02c14.36-26.65,50.87-31.84,79.22-11.27l15.25,11.07c12.16,8.83,24.33,17.65,36.49,26.48,3.9,2.83,7.81,5.66,11.71,8.5Z"/>
  <path class="cls-1" d="m748.9,446.61c7.02,0,11.87,7.68,8.64,13.68l-35.51,65.94-5.29,9.82-38.59,71.65c-8.88,16.46-26.12,26.28-46.18,26.28h-50.83c-4.86,0-8.57-5.46-6.43-9.46l52.16-96.82,36.19-67.18c4.65-8.64,13.67-13.91,23.78-13.91h62.04Z"/>
</svg>`;

export default function VerifyOtpScreen({ navigation, route }) {
  const { refreshAuthState, applyAuthSession } = useAuth();
  const { userId, phone } = route.params || {};

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  const normalizeAuthPayload = (payload = {}) => {
    const root = payload && typeof payload === "object" ? payload : {};
    const nestedData =
      root?.data && typeof root.data === "object" ? root.data : null;
    const nestedSession =
      root?.session && typeof root.session === "object" ? root.session : null;
    return nestedSession || nestedData || root;
  };

  const inputRefs = useRef([]);

  // Animated values for success overlay
  const logoScale = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-focus first input
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  // Redirect if no userId
  useEffect(() => {
    if (!userId) {
      navigation.navigate("Login");
    }
  }, [userId, navigation]);

  // Success animation
  useEffect(() => {
    if (verified) {
      Animated.stagger(200, [
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Navigate home after animation
      const timer = setTimeout(async () => {
        await refreshAuthState();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [verified]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, e) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-platform": "react-native",
        },
        body: JSON.stringify({ userId, otp: otpString }),
      });

      const data = await res.json().catch(() => ({}));
      const session = normalizeAuthPayload(data);

      if (!res.ok) {
        setError(data.message || "Verification failed");
        setLoading(false);
        return;
      }

      const sessionApplied = await applyAuthSession(data, {
        profileCompleted: true,
      });

      if (!sessionApplied?.ok) {
        setError("Signed in, but redirect failed. Please login again.");
        setLoading(false);
        return;
      }

      // Initialize push notifications
      const persistedToken = sessionApplied?.accessToken || null;
      const authToken =
        persistedToken ||
        session?.token ||
        session?.access_token ||
        session?.accessToken ||
        session?.authToken ||
        null;
      if (authToken) {
        pushNotificationService.initialize(authToken).catch((err) => {
          console.warn("Push notification init error:", err);
        });
      } else {
        console.error(
          "[AuthDebug] OTP verified but token missing in response",
          {
            payloadKeys:
              data && typeof data === "object" ? Object.keys(data) : [],
          },
        );
      }

      setLoading(false);
      setVerified(true);
    } catch (err) {
      console.error("OTP verify error:", err);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;

    setResending(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phone }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setResendTimer(60);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setError(data.message || "Failed to resend OTP");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Mask phone for display
  const maskedPhone = phone
    ? phone.slice(0, 3) + "****" + phone.slice(-3)
    : "your WhatsApp";

  // Success Overlay
  if (verified) {
    return (
      <LinearGradient
        colors={["#f0fdf4", "#ffffff", "#ecfdf5"]}
        style={styles.successOverlay}
      >
        <View style={styles.successContent}>
          {/* Meezo Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              { transform: [{ scale: logoScale }] },
            ]}
          >
            <SvgXml xml={MEEZO_LOGO_XML} width={80} height={80} />
          </Animated.View>

          {/* Green Checkmark */}
          <Animated.View
            style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}
          >
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>

          {/* Text */}
          <Animated.View style={{ opacity: textOpacity, alignItems: "center" }}>
            <Text style={styles.verifiedTitle}>Verified!</Text>
            <Text style={styles.verifiedSubtitle}>
              Your phone has been verified successfully
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    );
  }

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
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.headerWrap}>
              <View style={styles.headerCircle}>
                <Text style={styles.headerIcon}>📱</Text>
              </View>
              <Text style={styles.appTitle}>Verify Your Phone</Text>
              <Text style={styles.appSubtitle}>
                Enter the 6-digit code sent to {maskedPhone}
              </Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>WhatsApp OTP 💬</Text>
              <Text style={styles.cardSub}>
                We sent a verification code via WhatsApp
              </Text>

              {/* Error */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* OTP Inputs */}
              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    value={digit}
                    onChangeText={(v) => handleChange(index, v)}
                    onKeyPress={(e) => handleKeyPress(index, e)}
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[
                      styles.otpInput,
                      digit ? styles.otpInputFilled : null,
                    ]}
                    selectionColor="#1db95b"
                  />
                ))}
              </View>

              {/* Verify Button */}
              <Pressable
                onPress={handleVerify}
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
                    <Text style={styles.primaryBtnText}>Verifying...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Verify OTP</Text>
                )}
              </Pressable>

              {/* Resend */}
              <View style={styles.resendWrap}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimer}>
                    Resend code in {resendTimer}s
                  </Text>
                ) : (
                  <Pressable onPress={handleResend} disabled={resending}>
                    <Text style={styles.resendLink}>
                      {resending ? "Sending..." : "Resend Code"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
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
  appSubtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
  },

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

  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginVertical: 8,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    color: "#111827",
  },
  otpInputFilled: {
    borderColor: "#1db95b",
    backgroundColor: "#f0fdf4",
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

  resendWrap: { alignItems: "center", marginTop: 16 },
  resendTimer: { color: "#9CA3AF", fontSize: 13 },
  resendLink: {
    color: "#1db95b",
    fontWeight: "800",
    fontSize: 14,
    textDecorationLine: "underline",
  },

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

  // Success overlay
  successOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  successContent: {
    alignItems: "center",
    gap: 20,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  checkMark: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
  },
  verifiedTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#111827",
    marginTop: 8,
  },
  verifiedSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
});
