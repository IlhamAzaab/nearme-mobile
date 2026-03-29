import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const fetchAdminMe = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to load profile");
  return data?.admin || null;
};

const changeAdminPassword = async ({ username, newPassword }) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/change-password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, newPassword }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to change password");
  return data;
};

export default function AdminProfile() {
  const navigation = useNavigation();
  const [success, setSuccess] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const profileQuery = useQuery({
    queryKey: ["admin", "profile", "me"],
    queryFn: fetchAdminMe,
    staleTime: 60 * 1000,
  });

  const changePasswordMutation = useMutation({
    mutationFn: changeAdminPassword,
    onSuccess: () => {
      setSuccess(true);
      Alert.alert("Success", "Password changed successfully!", [
        {
          text: "Continue",
          onPress: () => navigation.replace("AdminOnboardingStep1"),
        },
      ]);
    },
    onError: (e) => {
      Alert.alert("Error", e.message || "Failed to change password");
    },
  });

  // Start animations
  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animations
    const createFloatAnimation = (anim, duration) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    };

    createFloatAnimation(floatAnim1, 2000).start();
    createFloatAnimation(floatAnim2, 2500).start();
    createFloatAnimation(floatAnim3, 3000).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    const admin = profileQuery.data;
    if (!admin) return;

    setForcePasswordChange(!!admin.force_password_change);

    if (!admin.force_password_change && !admin.onboarding_completed) {
      navigation.replace("AdminOnboardingStep1");
      return;
    }

    if (
      !admin.force_password_change &&
      admin.onboarding_completed &&
      admin.admin_status === "active"
    ) {
      navigation.replace("AdminMain");
    }
  }, [navigation, profileQuery.data]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.username.trim()) {
      Alert.alert("Error", "Username is required");
      return;
    }

    if (formData.newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    changePasswordMutation.mutate({
      username: formData.username,
      newPassword: formData.newPassword,
    });
  };

  // Interpolate floating animations
  const float1Y = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });
  const float2Y = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const float3Y = floatAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  return (
    <View style={styles.container}>
      {/* Animated background elements */}
      <View style={styles.backgroundContainer}>
        <Animated.View
          style={[
            styles.floatingCircle1,
            {
              transform: [{ translateY: float1Y }, { scale: pulseAnim }],
              opacity: 0.3,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.floatingCircle2,
            {
              transform: [{ translateY: float2Y }],
              opacity: 0.25,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.floatingCircle3,
            {
              transform: [{ translateY: float3Y }],
              opacity: 0.2,
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
              <Text style={styles.title}>Change Your Password</Text>

              {forcePasswordChange && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    <Text style={styles.warningBold}>
                      ⚠️ Password Change Required
                    </Text>
                    {"\n"}For security reasons, you must change your temporary
                    password before proceeding.
                  </Text>
                </View>
              )}

              <Text style={styles.subtitle}>
                Please set a new secure password for your account.
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {profileQuery.error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>
                    {profileQuery.error?.message ||
                      "Unable to verify profile status"}
                  </Text>
                </View>
              )}

              {/* Username */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputBorder} />
                  <TextInput
                    style={styles.input}
                    placeholder="Choose a username"
                    placeholderTextColor="#9ca3af"
                    value={formData.username}
                    onChangeText={(text) =>
                      setFormData({ ...formData, username: text })
                    }
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputBorder} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor="#9ca3af"
                    value={formData.newPassword}
                    onChangeText={(text) =>
                      setFormData({ ...formData, newPassword: text })
                    }
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputBorder} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#9ca3af"
                    value={formData.confirmPassword}
                    onChangeText={(text) =>
                      setFormData({ ...formData, confirmPassword: text })
                    }
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (changePasswordMutation.isPending || success) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={changePasswordMutation.isPending || success}
                activeOpacity={0.8}
              >
                {changePasswordMutation.isPending ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.submitButtonText}>
                      Changing Password...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>
                    Change Password & Continue
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06C168",
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  floatingCircle1: {
    position: "absolute",
    top: "15%",
    left: "10%",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(134, 239, 172, 0.3)",
  },
  floatingCircle2: {
    position: "absolute",
    bottom: "20%",
    right: "5%",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(187, 247, 208, 0.25)",
  },
  floatingCircle3: {
    position: "absolute",
    top: "40%",
    right: "20%",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(220, 252, 231, 0.2)",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 24,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#06C168",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  lockIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  warningBox: {
    backgroundColor: "#fefce8",
    borderWidth: 1,
    borderColor: "#fde047",
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    width: "100%",
  },
  warningText: {
    fontSize: 13,
    color: "#854d0e",
    textAlign: "center",
    lineHeight: 20,
  },
  warningBold: {
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 2,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "500",
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    position: "relative",
  },
  inputBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#06C168",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1f2937",
    margin: 2,
  },
  submitButton: {
    backgroundColor: "#06C168",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#06C168",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
