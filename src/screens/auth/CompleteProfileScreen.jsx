import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken, persistAuthSession } from "../../lib/authStorage";
import {
  buildSignupFlowState,
  SIGNUP_FLOW_STATE_KEY,
} from "../../constants/signupFlowState";
import MeezoLogo from "../../components/common/MeezoLogo";
import FloatingLabelInput from "../../components/common/FloatingLabelInput";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_WEB = Platform.OS === "web";
const WEB_CARD_MAX_WIDTH = 560;
const TERMS_AND_CONDITIONS_URL =
  "https://tranquil-medovik-7b2e45.netlify.app/";

const UserIcon = ({ size = 20, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.339 0-10 1.672-10 5v2h20v-2c0-3.328-6.661-5-10-5z"
      fill={color}
    />
  </Svg>
);

const EmailIcon = ({ size = 20, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm-.4 2L12 11.25 4.4 6h15.2zM4 18V7.45l7.43 5.14a1 1 0 001.14 0L20 7.45V18H4z"
      fill={color}
    />
  </Svg>
);

const LockIcon = ({ size = 20, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-9-2a3 3 0 116 0v2H9V6zm3 10a2 2 0 110-4 2 2 0 010 4z"
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

export default function CompleteProfileScreen({ navigation, route }) {
  const { refreshAuthState, markProfileCompleted, preparePostLoginTransition } =
    useAuth();
  const insets = useSafeAreaInsets();
  const { userId, accessToken, prefillPhone } = route.params || {};
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.setItem(
      SIGNUP_FLOW_STATE_KEY,
      JSON.stringify(
        buildSignupFlowState("CompleteProfile", {
          userId,
          accessToken,
          prefillPhone,
        }),
      ),
    ).catch(() => {});
  }, [accessToken, prefillPhone, userId]);

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

  const handleSubmit = async () => {
    setError("");

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password.trim()
    ) {
      setError("Name, email and password are required");
      triggerShake();
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address");
      triggerShake();
      return;
    }

    if (formData.password.trim().length < 6) {
      setError("Password must be at least 6 characters");
      triggerShake();
      return;
    }

    if (!termsAccepted) {
      setError("Please accept the Terms and Conditions to continue.");
      triggerShake();
      return;
    }

    try {
      const effectiveAccessToken = accessToken || (await getAccessToken());
      if (!effectiveAccessToken) {
        setError("Session expired. Please login again.");
        triggerShake();
        return;
      }

      setSaving(true);

      const completeRes = await fetch(`${API_BASE_URL}/auth/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveAccessToken}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: normalizedEmail,
          password: formData.password.trim(),
        }),
      });

      const completeData = await completeRes.json().catch(() => ({}));

      if (!completeRes.ok) {
        setError(completeData?.message || "Failed to complete profile");
        triggerShake();
        return;
      }

      const returnedToken =
        completeData?.data?.token ||
        completeData?.token ||
        effectiveAccessToken;
      const resolvedUserId =
        userId || completeData?.data?.id || completeData?.id || null;

      await persistAuthSession(
        {
          token: returnedToken,
          role: "customer",
          userId: resolvedUserId,
          userName: formData.name.trim(),
        },
        {
          userEmail: normalizedEmail,
          profileCompleted: true,
        },
      );

      await markProfileCompleted();
      await AsyncStorage.removeItem(SIGNUP_FLOW_STATE_KEY);
      preparePostLoginTransition();
      await refreshAuthState();
    } catch (err) {
      console.error("Profile completion error:", err);
      setError("Network error. Please try again.");
      triggerShake();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.pageContainer} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.pageContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            IS_WEB && styles.scrollContentWeb,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.loginShell,
              IS_WEB && styles.loginShellWeb,
              { transform: [{ translateX: shakeX }] },
            ]}
          >
            <LinearGradient
              colors={["#04753E", "#059B52", "#06C168"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.greenSection, IS_WEB && styles.greenSectionWeb]}
            >
              <View style={styles.bgCircle1} />
              <View style={styles.bgCircle2} />
              <View style={styles.logoWrap}>
                <MeezoLogo size={IS_WEB ? 320 : 250} />
              </View>
              <Text style={styles.appSubtitle}>Complete your profile</Text>
            </LinearGradient>

            <View style={styles.waveContainer}>
              <Svg
                width={SCREEN_WIDTH}
                height={46}
                viewBox={`0 0 ${SCREEN_WIDTH} 46`}
                style={styles.waveSvg}
              >
                <Path
                  d={`M0,0 L0,20 Q${SCREEN_WIDTH * 0.25},46 ${SCREEN_WIDTH * 0.5},20 Q${SCREEN_WIDTH * 0.75},-2 ${SCREEN_WIDTH},20 L${SCREEN_WIDTH},0 Z`}
                  fill="#06C168"
                />
              </Svg>
            </View>

            <View
              style={[
                styles.whiteSection,
                IS_WEB && styles.whiteSectionWeb,
                {
                  paddingBottom: Math.max(24, insets.bottom + 16),
                },
              ]}
            >
              <View style={[styles.formWrap, IS_WEB && styles.formWrapWeb]}>
                <Text style={styles.cardTitle}>Profile Setup</Text>
                <Text style={styles.cardSub}>Account details</Text>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <FloatingLabelInput
                  label="Username"
                  value={formData.name}
                  onChangeText={(v) => handleChange("name", v)}
                  inactivePlaceholder="Username"
                  activePlaceholder="Enter your name"
                  autoCapitalize="words"
                  leftIcon={<UserIcon size={20} color="#9CA3AF" />}
                />

                <FloatingLabelInput
                  label="Email"
                  value={formData.email}
                  onChangeText={(v) => handleChange("email", v)}
                  inactivePlaceholder="Email"
                  activePlaceholder="Eg: customer1@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={<EmailIcon size={20} color="#9CA3AF" />}
                />

                <FloatingLabelInput
                  label="Password"
                  value={formData.password}
                  onChangeText={(v) => handleChange("password", v)}
                  inactivePlaceholder="Password"
                  activePlaceholder="Minimum 6 characters"
                  autoCapitalize="none"
                  secureTextEntry={!showPassword}
                  leftIcon={<LockIcon size={20} color="#9CA3AF" />}
                  rightAccessory={
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      style={styles.passwordEyeBtn}
                      hitSlop={10}
                    >
                      {showPassword ? (
                        <EyeOffIcon size={22} color="#9CA3AF" />
                      ) : (
                        <EyeIcon size={22} color="#9CA3AF" />
                      )}
                    </Pressable>
                  }
                />

                <View style={styles.termsRow}>
                  <Pressable
                    style={styles.termsToggle}
                    onPress={() => setTermsAccepted((value) => !value)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        termsAccepted ? styles.checkboxChecked : null,
                      ]}
                    >
                      {termsAccepted ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text style={styles.termsText}>I accept</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      navigation.navigate("WebView", {
                        title: "Terms of Service",
                        url: TERMS_AND_CONDITIONS_URL,
                      })
                    }
                  >
                    <Text style={styles.termsLink}>Terms & Conditions</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={handleSubmit}
                  disabled={saving || !termsAccepted}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (saving || !termsAccepted) && { opacity: 0.7 },
                    pressed && styles.pressed,
                  ]}
                >
                  <LinearGradient
                    colors={["#06C168", "#059B52", "#04753E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnText}>
                      {saving ? "Saving..." : "Complete Profile"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: { flexGrow: 1 },
  scrollContentWeb: {
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  loginShell: {
    width: "100%",
    flex: 1,
  },
  loginShellWeb: {
    width: "100%",
    maxWidth: WEB_CARD_MAX_WIDTH,
    alignSelf: "center",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0B3B1E",
    shadowOpacity: 0.16,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  greenSection: {
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  greenSectionWeb: {
    paddingTop: 34,
    paddingBottom: 8,
  },
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
  logoWrap: {
    alignItems: "center",
  },
  appSubtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: -6,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  waveContainer: {
    marginTop: -2,
    backgroundColor: "#FFFFFF",
  },
  waveSvg: { display: "flex" },
  whiteSection: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  whiteSectionWeb: {
    paddingHorizontal: 30,
    paddingBottom: 30,
  },
  formWrap: { paddingTop: 8 },
  formWrapWeb: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
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
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    marginTop: 8,
  },
  termsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#06C168",
    borderColor: "#06C168",
  },
  termsText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },
  termsLink: {
    color: "#06C168",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  passwordEyeBtn: {
    justifyContent: "center",
    alignItems: "center",
  },
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
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.5,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
