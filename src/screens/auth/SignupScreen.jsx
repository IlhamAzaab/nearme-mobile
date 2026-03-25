import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { API_BASE_URL } from "../../constants/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ─── Icon Components ─── */
const EmailIcon = ({ size = 20, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
      fill={color}
    />
  </Svg>
);

const LockIcon = ({ size = 20, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"
      fill={color}
    />
  </Svg>
);

const ShieldIcon = ({ size = 20, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"
      fill={color}
    />
  </Svg>
);

const EyeIcon = ({ size = 22, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
      fill={color}
    />
  </Svg>
);

const EyeOffIcon = ({ size = 22, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C11.74 7.13 12.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
      fill={color}
    />
  </Svg>
);

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
  const [signupUserId, setSignupUserId] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const pollRef = useRef(null);

  // Poll for email verification when on the success screen
  useEffect(() => {
    if (success && signupUserId && !emailVerified) {
      const checkVerification = async () => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/auth/check-email-verified?userId=${encodeURIComponent(signupUserId)}`,
          );
          const data = await res.json();
          if (data.verified) {
            setEmailVerified(true);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (err) {
          // Silently ignore polling errors
        }
      };

      checkVerification();
      pollRef.current = setInterval(checkVerification, 5000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [success, signupUserId, emailVerified]);

  // shake animation
  const shakeX = useRef(new Animated.Value(0)).current;

  const emailOk = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(formData.email.trim());
  }, [formData.email]);

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
      const checkResponse = await fetch(
        `${API_BASE_URL}/auth/check-availability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email.trim() }),
        },
      );

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
      setSignupUserId(data.userId);
      setSuccess(true);
    } catch (err) {
      console.error("Signup error:", err);
      setLoading(false);
      setError("Network error. Please try again.");
      triggerShake();
    }
  };

  const WAVE_HEIGHT = 50;

  // ✅ Success Screen
  if (success) {
    return (
      <LinearGradient
        colors={["#123321", "#1db95b", "#0a1f14"]}
        style={styles.container}
      >
        <View style={styles.successWrap}>
          <View style={styles.successCard}>
            {emailVerified ? (
              <>
                <View style={[styles.mailIconCircle, { backgroundColor: "#22c55e" }]}>
                  <Text style={styles.mailIcon}>✓</Text>
                </View>

                <Text style={styles.successTitle}>Email Verified!</Text>
                <Text style={styles.successText}>
                  Your email has been verified successfully. You can now login to
                  your account.
                </Text>

                <Pressable
                  onPress={() => navigation.navigate("Login")}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { marginTop: 20, width: "100%" },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Go to Login</Text>
                </Pressable>
              </>
            ) : (
              <>
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
                  <Text style={styles.stepItem}>
                    2) Click the verification link
                  </Text>
                  <Text style={styles.stepItem}>3) Come back and login</Text>
                  <Text style={styles.stepItem}>
                    4) Complete your profile
                  </Text>
                </View>

                <View style={styles.pollingRow}>
                  <ActivityIndicator size="small" color="#1db95b" />
                  <Text style={styles.pollingText}>Waiting for email verification...</Text>
                </View>

                <Text style={styles.smallNote}>
                  Didn't receive the email? Check spam folder or try again in a few
                  minutes.
                </Text>

                <Pressable
                  onPress={() => navigation.navigate("Login")}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Go to Login</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </LinearGradient>
    );
  }

  // ✅ Main Signup Screen
  return (
    <View style={styles.pageContainer}>
      <KeyboardAvoidingView
        style={styles.pageContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            {/* ═══ GREEN TOP SECTION ═══ */}
            <LinearGradient
              colors={["#04753E", "#059B52", "#06C168"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.greenSection}
            >
              {/* Decorative circles */}
              <View style={styles.bgCircle1} />
              <View style={styles.bgCircle2} />

              {/* Meezo SVG Logo */}
              <View style={styles.logoWrap}>
                <Svg width={220} height={220} viewBox="0 0 1080 1080">
                  <Rect
                    x="0"
                    y="0"
                    width="1080"
                    height="1080"
                    fill="transparent"
                  />
                  <G>
                    {/* Z letter — black */}
                    <Path
                      d="m796.84,470.43c2.16-2.3,1.79-4.86-.71-4.86h-101.74c-2.52,0-5.62,2.05-6.9,4.57l-17.16,33.68c-1.29,2.53-.29,4.58,2.24,4.58h27.48c2.5,0,2.88,2.56.72,4.85l-89.65,95.15c-2.16,2.29-1.78,4.85.72,4.85h112.31c2.52,0,5.62-2.04,6.9-4.57l10.68-33.68c1.29-2.53.28-4.57-2.25-4.57h-31.76c-2.5,0-2.87-2.57-.71-4.86l89.83-95.14Z"
                      fill="#000"
                    />
                    {/* First E letter — black */}
                    <Path
                      d="m564.84,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.14,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.36c2.14,0,4.76-1.74,5.85-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.7-3.88,5.84-3.88h34.77c2.13,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z"
                      fill="#000"
                    />
                    {/* Second E letter — black */}
                    <Path
                      d="m674.3,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.13,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.37c2.13,0,4.75-1.74,5.84-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.71-3.88,5.84-3.88h34.77c2.14,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z"
                      fill="#000"
                    />
                    {/* M letter — black */}
                    <Path
                      d="m455.98,475.4l-23.01,44.91c-1.96,3.83-5.1,6.86-9.03,8.71-30.64,14.45-56.96,26.84-66.45,31.3-2.31,1.09-5.25.69-7.61-1.03l-14.61-10.6-16.76-12.16-1.95-1.41c-4.49-3.26-10.24-2.47-12.57,1.71l-30.61,56.84c-7.03,13.06-20.71,20.85-36.62,20.85h-40.32c-3.86,0-6.8-4.34-5.11-7.51l41.38-76.8,21.66-40.22,3-5.57c11.39-21.13,40.35-25.25,62.84-8.93l12.1,8.78c9.65,7,19.3,14,28.95,21,3.09,2.25,6.19,4.5,9.28,6.74l82.97-39.09c1.44-.68,3.19,1.08,2.47,2.48Z"
                      fill="#000"
                    />
                    {/* O letter — white */}
                    <G>
                      <Path
                        d="m883.66,586.15h-68.56s.09-.07.13-.12c-1.92-.44-3.34-2.16-3.34-4.2,0-1.19.48-2.28,1.26-3.06.79-.79,1.87-1.27,3.06-1.27h60.25c1.19,0,2.27-.48,3.05-1.26.79-.78,1.27-1.86,1.27-3.06,0-2.38-1.94-4.32-4.32-4.32h-42.37s.09-.08.14-.12c-1.91-.45-3.32-2.16-3.32-4.2,0-1.19.48-2.27,1.26-3.05.79-.79,1.87-1.27,3.06-1.27h32.57c1.2,0,2.28-.48,3.06-1.26.78-.78,1.26-1.86,1.26-3.06,0-2.38-1.93-4.32-4.32-4.32h-14.84c4.43-4.21,8.72-8.5,12.77-12.92,20.38-22.25,24.31-49.41,10.74-63.1-14.41-14.57-43.15-12.8-69.81,4.29-26.28,16.84-43.27,43.87-40.63,65.46,1.87,15.19,4.5,30.02,6.94,44.95.82,5.09,1.72,10.15,2.67,15.37.6,3.31,3.07,5.55,5.92,6.22.6.15,1.21.22,1.83.22h65.52c1.19,0,2.27-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32h-52.95l.02-.02c-2.2-.2-3.92-2.06-3.92-4.3,0-1.19.48-2.27,1.26-3.06.78-.78,1.86-1.26,3.06-1.26h87.28c1.2,0,2.28-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32Zm-78.14-67.05c5-10.73,17.74-19.42,28.47-19.42s15.36,8.69,10.35,19.42c-4.99,10.71-17.74,19.41-28.46,19.41s-15.36-8.7-10.36-19.41Z"
                        fill="#fff"
                      />
                      <Path
                        d="m783.39,612.07h-.5c-.46,0-.91-.07-1.33-.22.6.15,1.21.22,1.83.22Z"
                        fill="#fff"
                      />
                    </G>
                  </G>
                </Svg>
                <Text style={styles.appSubtitle}>
                  Your favorite food, fast.
                </Text>
              </View>
            </LinearGradient>

            {/* ═══ WAVE SEPARATOR ═══ */}
            <View style={styles.waveContainer}>
              <Svg
                width={SCREEN_WIDTH}
                height={WAVE_HEIGHT}
                viewBox={`0 0 ${SCREEN_WIDTH} ${WAVE_HEIGHT}`}
                style={styles.waveSvg}
              >
                <Path
                  d={`M0,0 L0,${WAVE_HEIGHT * 0.4} Q${SCREEN_WIDTH * 0.25},${WAVE_HEIGHT * 1.1} ${SCREEN_WIDTH * 0.5},${WAVE_HEIGHT * 0.4} Q${SCREEN_WIDTH * 0.75},${WAVE_HEIGHT * -0.3} ${SCREEN_WIDTH},${WAVE_HEIGHT * 0.4} L${SCREEN_WIDTH},0 Z`}
                  fill="#06C168"
                />
              </Svg>
            </View>

            {/* ═══ WHITE BOTTOM SECTION ═══ */}
            <View style={styles.whiteSection}>
              <View style={styles.formWrap}>
                <Text style={styles.cardTitle}>Create Account</Text>
                <Text style={styles.cardSub}>Sign up to get started</Text>

                {/* Error */}
                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Email */}
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <EmailIcon size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    value={formData.email}
                    onChangeText={(v) => handleChange("email", v)}
                    placeholder="Email Address"
                    placeholderTextColor="#B0B8C4"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                {/* Password */}
                <View style={[styles.inputWrap, { marginTop: 14 }]}>
                  <View style={styles.inputIconWrap}>
                    <LockIcon size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    value={formData.password}
                    onChangeText={(v) => handleChange("password", v)}
                    placeholder="Password"
                    placeholderTextColor="#B0B8C4"
                    secureTextEntry={!showPassword}
                    style={[styles.input, { paddingRight: 52 }]}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={10}
                  >
                    {showPassword ? (
                      <EyeOffIcon size={22} color="#9CA3AF" />
                    ) : (
                      <EyeIcon size={22} color="#9CA3AF" />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.hint}>Must be at least 6 characters</Text>

                {/* Confirm Password */}
                <View style={[styles.inputWrap, { marginTop: 10 }]}>
                  <View style={styles.inputIconWrap}>
                    <ShieldIcon size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    value={formData.confirmPassword}
                    onChangeText={(v) => handleChange("confirmPassword", v)}
                    placeholder="Confirm Password"
                    placeholderTextColor="#B0B8C4"
                    secureTextEntry={!showConfirmPassword}
                    style={[styles.input, { paddingRight: 52 }]}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={10}
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon size={22} color="#9CA3AF" />
                    ) : (
                      <EyeIcon size={22} color="#9CA3AF" />
                    )}
                  </Pressable>
                </View>

                {/* Submit */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (pressed || loading) && styles.pressed,
                    loading && { opacity: 0.75 },
                  ]}
                >
                  <LinearGradient
                    colors={["#06C168", "#059B52", "#04753E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.primaryBtnText}>
                          Creating account...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryBtnText}>Sign Up</Text>
                    )}
                  </LinearGradient>
                </Pressable>

                {/* Footer */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>
                    Already have an account?{" "}
                  </Text>
                  <Pressable onPress={() => navigation.navigate("Login")}>
                    <Text style={styles.footerLink}>Log in here</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  scrollContent: {
    flexGrow: 1,
  },

  /* ═══ GREEN TOP SECTION ═══ */
  greenSection: {
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingBottom: 10,
    alignItems: "center",
    overflow: "hidden",
  },

  /* Decorative background circles */
  bgCircle1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -40,
    right: -60,
  },
  bgCircle2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: 10,
    left: -50,
  },

  /* Logo */
  logoWrap: {
    alignItems: "center",
  },
  appSubtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 0,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  /* ═══ WAVE SEPARATOR ═══ */
  waveContainer: {
    marginTop: -2,
    backgroundColor: "#FFFFFF",
  },
  waveSvg: {
    display: "flex",
  },

  /* ═══ WHITE BOTTOM SECTION ═══ */
  whiteSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  formWrap: {
    paddingTop: 8,
  },

  /* Titles */
  cardTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    fontWeight: "400",
  },

  /* Error */
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  errorText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },

  /* Input fields */
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    backgroundColor: "#F7F8FA",
    height: 56,
    paddingHorizontal: 14,
  },
  inputIconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    paddingHorizontal: 8,
    fontWeight: "500",
  },

  eyeBtn: {
    position: "absolute",
    right: 14,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  hint: {
    marginTop: 6,
    marginLeft: 6,
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "400",
  },

  /* Button */
  primaryBtn: {
    marginTop: 24,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#06C168",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryBtnGradient: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.5,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },

  /* Footer */
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    alignItems: "center",
  },
  footerText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "400",
  },
  footerLink: {
    color: "#06C168",
    fontWeight: "800",
    fontSize: 14,
  },

  /* ═══ SUCCESS SCREEN ═══ */
  successGradient: {
    flex: 1,
    overflow: "hidden",
  },
  successWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  successCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
    alignItems: "center",
  },
  mailIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  mailIcon: { fontSize: 34, color: "#fff" },

  successTitleText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },
  successText: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 8,
    lineHeight: 22,
    fontSize: 14,
  },
  emailHighlight: { color: "#06C168", fontWeight: "800" },

  stepsBox: {
    width: "100%",
    marginTop: 18,
    backgroundColor: "#F7F8FA",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    padding: 16,
  },
  stepsTitle: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    fontSize: 14,
  },
  stepItem: { color: "#6B7280", marginTop: 4, fontSize: 13 },

  smallNote: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 12,
  },
  pollingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  pollingText: {
    color: "#1db95b",
    fontSize: 13,
    fontWeight: "700",
  },
});
