import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/AuthProvider";
import { DriverProfileLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import { NEARME_LOGO_ARTBOARD5_XML } from "../../assets/NearMeLogoArtboard5Xml";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const WORKING_TIME_LABELS = {
  full_time: "Full Time",
  day: "Day Shift (5AM - 7PM)",
  night: "Night Shift (6PM - 6AM)",
  part_time_morning: "Morning Shift",
  part_time_evening: "Evening Shift",
};

export default function DriverProfileScreen({ navigation }) {
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isProfileCompleted, setIsProfileCompleted] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [token, role] = await Promise.all([
        getAccessToken(),
        AsyncStorage.getItem("role"),
      ]);

      if (!mounted) return;

      if (!token || role !== "driver") {
        navigation.replace("Login");
        return;
      }

      setAuthReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [navigation]);

  const profileQuery = useQuery({
    queryKey: ["driver", "profile"],
    enabled: authReady,
    staleTime: 2 * 60 * 1000,
    initialData: () => queryClient.getQueryData(["driver", "profile"]),
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      const res = await fetch(`${API_URL}/driver/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok || !data?.driver) {
        throw new Error(data?.message || "Failed to load profile");
      }

      return data.driver;
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfile(profileQuery.data);
    setIsProfileCompleted(Boolean(profileQuery.data.profile_completed));
    setError(null);
  }, [profileQuery.data]);

  useEffect(() => {
    if (profileQuery.isError) {
      setError("Failed to load profile");
    }
  }, [profileQuery.isError]);

  const updateProfileMutation = useMutation({
    mutationFn: async (password) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      const res = await fetch(`${API_URL}/driver/update-profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update profile");
      }

      return data;
    },
    onSuccess: () => {
      setMessage("Password updated! Redirecting to onboarding...");
      setError(null);
      queryClient.setQueryData(["driver", "profile"], (current) =>
        current ? { ...current, profile_completed: true } : current,
      );
      setTimeout(() => {
        navigation.replace("DriverOnboardingStep1");
      }, 1200);
    },
    onError: (err) => {
      setError(err?.message || "Network error. Please try again.");
      setMessage(null);
    },
  });

  const loading = !authReady || (profileQuery.isLoading && !profile);

  const statusBadge = useMemo(() => {
    const status = (profile?.driver_status || "inactive").toLowerCase();
    if (status === "active") {
      return { bg: "#dcfce7", text: "#166534" };
    }
    if (status === "inactive") {
      return { bg: "#f3f4f6", text: "#4b5563" };
    }
    return { bg: "#fef3c7", text: "#92400e" };
  }, [profile?.driver_status]);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (!newPassword) {
      setError("Password is required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    updateProfileMutation.mutate(newPassword);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <DriverProfileLoadingSkeleton />
      </SafeAreaView>
    );
  }

  if (isProfileCompleted) {
    return (
      <SafeAreaView style={styles.completedContainer}>
        <DriverScreenSection
          screenKey="DriverProfileCompleted"
          sectionIndex={0}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.completedContent}>
            <View style={styles.headerCard}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.replace("DriverTabs")}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>My Profile</Text>
                <Text style={styles.headerSubtitle}>Account Details</Text>
              </View>
            </View>

            <View style={styles.profileHeroCard}>
              <View style={styles.logoContainer}>
                <SvgXml
                  xml={NEARME_LOGO_ARTBOARD5_XML}
                  width={84}
                  height={84}
                />
              </View>
              <View style={styles.profileHeroInfo}>
                <Text style={styles.profileName}>
                  {profile?.full_name || "Driver"}
                </Text>
                <Text style={styles.profileUsername}>
                  @ {profile?.full_name || "Driver"}
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <InfoRow
                label="Full Name"
                value={profile?.full_name}
                icon="person-outline"
              />
              <InfoRow
                label="Email Address"
                value={profile?.email}
                icon="mail-outline"
              />
              <InfoRow
                label="Phone Number"
                value={profile?.phone || profile?.phone_number}
                icon="call-outline"
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Work Information</Text>
              <InfoRow
                label="Working Time"
                value={
                  WORKING_TIME_LABELS[profile?.working_time] ||
                  profile?.working_time ||
                  "Not Set"
                }
                icon="time-outline"
              />
              <View style={styles.infoRow}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name="radio-button-on-outline"
                    size={16}
                    color="#06C168"
                  />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusBadge.bg },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: statusBadge.text }]}
                    >
                      {(profile?.driver_status || "inactive").toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
              <InfoRow
                label="Vehicle Number"
                value={profile?.vehicle_number}
                icon="bicycle-outline"
              />
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </ScrollView>
        </DriverScreenSection>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.setupContainer}>
      <DriverScreenSection
        screenKey="DriverProfileSetup"
        sectionIndex={0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.setupScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.setupLogoWrap}>
            <SvgXml xml={NEARME_LOGO_ARTBOARD5_XML} width={160} height={120} />
          </View>

          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Set your password</Text>
            <Text style={styles.setupSubtitle}>Complete this to continue</Text>

            <Text style={styles.label}>Email (You can use this to log in)</Text>
            <View style={styles.inputWrapDisabled}>
              <Ionicons name="mail-outline" size={18} color="#06C168" />
              <TextInput
                value={profile?.email || ""}
                editable={false}
                style={styles.disabledInput}
                placeholderTextColor="#6b7280"
              />
            </View>

            <Text style={styles.label}>New Password *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#06C168" />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#9ca3af"
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password *</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color="#06C168"
              />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor="#9ca3af"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((s) => !s)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#dc2626"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {message ? (
              <View style={styles.successBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#15803d"
                />
                <Text style={styles.successText}>{message}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                updateProfileMutation.isPending && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Save & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLogoutBtn}
              onPress={handleLogout}
            >
              <Text style={styles.secondaryLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </DriverScreenSection>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, icon }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={16} color="#06C168" />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "N/A"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
  },
  setupContainer: { flex: 1, backgroundColor: "#06C168" },
  setupScroll: { flexGrow: 1, paddingHorizontal: 18, paddingVertical: 16 },
  setupLogoWrap: { alignItems: "center", marginBottom: 14 },
  setupCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  setupTitle: {
    fontSize: 24,
    color: "#111827",
    fontWeight: "800",
    textAlign: "center",
  },
  setupSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10,
  },
  inputWrapDisabled: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  disabledInput: { flex: 1, color: "#6b7280", fontSize: 14 },
  inputWrap: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  input: { flex: 1, color: "#111827", fontSize: 14 },
  errorBox: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { color: "#b91c1c", fontSize: 13, flex: 1 },
  successBox: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successText: { color: "#166534", fontSize: 13, flex: 1 },
  submitBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1db95b",
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryLogoutBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  secondaryLogoutText: { color: "#374151", fontWeight: "700", fontSize: 14 },
  completedContainer: { flex: 1, backgroundColor: "#f0fdf4" },
  completedContent: { padding: 16, paddingBottom: 40 },
  headerCard: {
    backgroundColor: "#16a34a",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 20 },
  headerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 2,
  },
  profileHeroCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileHeroInfo: { flex: 1 },
  profileName: { fontSize: 20, color: "#111827", fontWeight: "800" },
  profileUsername: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 12, color: "#6b7280", marginBottom: 3 },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "700" },
  statusBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: "800" },
  logoutButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
