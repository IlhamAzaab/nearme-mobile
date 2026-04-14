import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import MeezoLogo from "../../components/common/MeezoLogo";
import { useAuth } from "../../app/providers/AuthProvider";
import supabase from "../../lib/supabaseClient";
import pushNotificationService from "../../services/pushNotificationService";
import { persistAuthSession } from "../../lib/authStorage";
import { normalizeSriLankaPhone } from "../../utils/phone";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_WEB = Platform.OS === "web";
const WEB_CARD_MAX_WIDTH = 560;

function maskPhone(phone) {
  if (!phone) return "";
  return `${phone.slice(0, 5)}*****${phone.slice(-2)}`;
}

export default function VerifyOtpScreen({ navigation, route }) {
  const { refreshAuthState } = useAuth();
  const { userId, phone, prefillPhone, accessToken, nextScreen } =
    route.params || {};
  const normalizedPhone = normalizeSriLankaPhone(phone || prefillPhone || "");

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const shakeX = useRef(new Animated.Value(0)).current;
  const otpInputRefs = useRef([]);

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

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (!normalizedPhone) {
      navigation.navigate("Signup");
    }
  }, [navigation, normalizedPhone]);

  const handleOtpDigitChange = (index, value) => {
    const onlyDigits = String(value || "").replace(/\D/g, "");

    if (!onlyDigits) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      setError("");
      return;
    }

    if (onlyDigits.length > 1) {
      const next = [...otpDigits];
      for (let i = index; i < 6; i += 1) {
        next[i] = onlyDigits[i - index] || "";
      }
      setOtpDigits(next);
      setError("");

      const nextIndex = Math.min(index + onlyDigits.length, 5);
      otpInputRefs.current[nextIndex]?.focus?.();
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = onlyDigits;
      return next;
    });
    setError("");

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus?.();
    }
  };

  const handleOtpKeyPress = (index, key) => {
    if (key !== "Backspace") return;
    if (otpDigits[index]) return;
    if (index === 0) return;

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index - 1] = "";
      return next;
    });
    otpInputRefs.current[index - 1]?.focus?.();
  };

  const handleVerify = async () => {
    const otpCode = otpDigits.join("").trim();
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Enter the 6-digit OTP");
      triggerShake();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode,
        type: "sms",
      });

      if (verifyError) {
        setError(verifyError?.message || "OTP verification failed");
        triggerShake();
        setLoading(false);
        return;
      }

      const resolvedToken = data?.session?.access_token || accessToken;
      const authUser = data?.user || null;
      const role = authUser?.user_metadata?.role || "customer";
      const profileCompleted = Boolean(
        authUser?.user_metadata?.profile_completed,
      );
      const resolvedUserId = authUser?.id || userId || null;
      const userName =
        authUser?.user_metadata?.username ||
        authUser?.user_metadata?.name ||
        null;

      if (!resolvedToken || !resolvedUserId) {
        setError("Verification succeeded, but session is incomplete.");
        setLoading(false);
        return;
      }

      await persistAuthSession(
        {
          token: resolvedToken,
          role,
          userId: resolvedUserId,
          userName,
        },
        {
          userEmail: authUser?.email || null,
          profileCompleted,
        },
      );

      if (resolvedToken) {
        pushNotificationService.initialize(resolvedToken).catch((err) => {
          console.warn("Push notification init error:", err);
        });
      }

      const shouldRouteToProfile =
        role === "customer"
          ? !profileCompleted
          : nextScreen === "CompleteProfile";

      setLoading(false);
      setIsTransitioning(true);

      setTimeout(async () => {
        if (shouldRouteToProfile) {
          navigation.replace("CompleteProfile", {
            userId: resolvedUserId,
            accessToken: resolvedToken,
            prefillPhone: normalizedPhone,
          });
          return;
        }

        await refreshAuthState();
      }, 1200);
    } catch (err) {
      console.error("OTP verify error:", err);
      setError("Network error. Please try again.");
      triggerShake();
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setError("");

    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: {
          channel: "sms",
        },
      });

      if (resendError) {
        setError(resendError?.message || "Failed to resend OTP");
        triggerShake();
      } else {
        setResendTimer(60);
        setOtpDigits(["", "", "", "", "", ""]);
        otpInputRefs.current[0]?.focus?.();
      }
    } catch {
      setError("Network error. Please try again.");
      triggerShake();
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.pageContainer} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.pageContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {isTransitioning && (
          <View style={styles.transitionOverlay}>
            <View style={styles.successCircle}>
              <Text style={styles.successTick}>✓</Text>
            </View>
            <Text style={styles.successTitle}>OTP Verified!</Text>
            <Text style={styles.successSub}>Redirecting...</Text>
          </View>
        )}

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
                <MeezoLogo size={IS_WEB ? 350 : 280} />
              </View>
              <Text style={styles.appSubtitle}>Secure OTP verification</Text>
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
              style={[styles.whiteSection, IS_WEB && styles.whiteSectionWeb]}
            >
              <View style={[styles.formWrap, IS_WEB && styles.formWrapWeb]}>
                <Text style={styles.cardTitle}>Verify OTP</Text>
                <Text style={styles.cardSub}>
                  Enter 6-digit OTP sent to {maskPhone(normalizedPhone)}
                </Text>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.otpRow}>
                  {otpDigits.map((digit, index) => (
                    <View
                      key={`otp-${index}`}
                      style={[
                        styles.otpDigitWrap,
                        digit ? styles.otpDigitWrapFilled : null,
                      ]}
                    >
                      <TextInput
                        ref={(ref) => {
                          otpInputRefs.current[index] = ref;
                        }}
                        value={digit}
                        onChangeText={(v) => handleOtpDigitChange(index, v)}
                        onKeyPress={({ nativeEvent }) =>
                          handleOtpKeyPress(index, nativeEvent?.key)
                        }
                        keyboardType="number-pad"
                        textContentType={index === 0 ? "oneTimeCode" : "none"}
                        maxLength={6}
                        style={styles.otpDigitInput}
                      />
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={handleVerify}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.loginBtn,
                    (pressed || loading) && {
                      opacity: 0.88,
                      transform: [{ scale: 0.985 }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["#06C168", "#059B52", "#04753E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtnGradient}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.loginBtnText}>Verifying...</Text>
                      </View>
                    ) : (
                      <Text style={styles.loginBtnText}>Verify</Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <View style={styles.footerRow}>
                  {resendTimer > 0 ? (
                    <Text style={styles.footerText}>
                      Resend OTP in {resendTimer}s
                    </Text>
                  ) : (
                    <Pressable onPress={handleResend} disabled={resending}>
                      <Text style={styles.footerLink}>
                        {resending ? "Resending..." : "Resend OTP"}
                      </Text>
                    </Pressable>
                  )}
                </View>
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
    backgroundColor: "#EEF4EF",
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
    marginBottom: 18,
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
  otpRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  otpDigitWrap: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
    alignItems: "center",
  },
  otpDigitWrapFilled: {
    borderColor: "#06C168",
    backgroundColor: "#F1FCF5",
  },
  otpDigitInput: {
    width: "100%",
    height: "100%",
    textAlign: "center",
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
  },
  loginBtn: {
    marginTop: 24,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#06C168",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  loginBtnGradient: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.5,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06C168",
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
