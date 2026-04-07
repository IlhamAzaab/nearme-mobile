import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
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
import { getAccessToken } from "../../lib/authStorage";
import MeezoLogo from "../../components/common/MeezoLogo";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_WEB = Platform.OS === "web";
const WEB_CARD_MAX_WIDTH = 560;

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

const CityIcon = ({ size = 20, color = "#9CA3AF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 21h18v-2H3v2zm2-3h4v-8H5v8zm5 0h4V4h-4v14zm5 0h4v-11h-4v11z"
      fill={color}
    />
  </Svg>
);

export default function CompleteProfileScreen({ navigation, route }) {
  const { userId, accessToken, prefillPhone } = route.params || {};
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    city: "",
  });
  const [error, setError] = useState("");

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
  };

  const handleSubmit = async () => {
    setError("");

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password.trim() ||
      !formData.city.trim()
    ) {
      setError("Name, email, password and city are required");
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

    try {
      const effectiveAccessToken = accessToken || (await getAccessToken());
      if (!effectiveAccessToken) {
        setError("Session expired. Please login again.");
        triggerShake();
        return;
      }

      navigation.navigate("CompleteProfileLocation", {
        userId,
        accessToken: effectiveAccessToken,
        profileData: {
          name: formData.name.trim(),
          email: normalizedEmail,
          password: formData.password.trim(),
          city: formData.city.trim(),
          phone: String(prefillPhone || "").trim(),
        },
      });
    } catch (err) {
      console.error("Profile completion error:", err);
      setError("Network error. Please try again.");
      triggerShake();
    }
  };

  return (
    <View style={styles.pageContainer}>
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

            <View style={[styles.whiteSection, IS_WEB && styles.whiteSectionWeb]}>
              <View style={[styles.formWrap, IS_WEB && styles.formWrapWeb]}>
                <Text style={styles.cardTitle}>Profile Setup</Text>
                <Text style={styles.cardSub}>Step 1 of 2: account details</Text>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <UserIcon size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    value={formData.name}
                    onChangeText={(v) => handleChange("name", v)}
                    placeholder="Enter your full name"
                    placeholderTextColor="#B0B8C4"
                    autoCapitalize="words"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.inputWrap, { marginTop: 14 }]}>
                  <View style={styles.inputIconWrap}>
                    <EmailIcon size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    value={formData.email}
                    onChangeText={(v) => handleChange("email", v)}
                    placeholder="you@example.com"
                    placeholderTextColor="#B0B8C4"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.inputWrap, { marginTop: 14 }]}>
                  <View style={styles.inputIconWrap}>
                    <LockIcon size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    value={formData.password}
                    onChangeText={(v) => handleChange("password", v)}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor="#B0B8C4"
                    autoCapitalize="none"
                    secureTextEntry
                    style={styles.input}
                  />
                </View>

                <View style={[styles.inputWrap, { marginTop: 14 }]}>
                  <View style={styles.inputIconWrap}>
                    <CityIcon size={20} color="#9CA3AF" />
                  </View>
                  <TextInput
                    value={formData.city}
                    onChangeText={(v) => handleChange("city", v)}
                    placeholder="Enter your city"
                    placeholderTextColor="#B0B8C4"
                    autoCapitalize="words"
                    style={styles.input}
                  />
                </View>

                <Pressable
                  onPress={handleSubmit}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <LinearGradient
                    colors={["#06C168", "#059B52", "#04753E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnText}>Continue to Map Pin</Text>
                  </LinearGradient>
                </Pressable>
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
