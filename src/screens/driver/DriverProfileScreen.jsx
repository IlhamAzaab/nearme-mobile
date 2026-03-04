import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../../app/providers/AuthProvider";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";

export default function DriverProfileScreen({ navigation }) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProfileCompleted, setIsProfileCompleted] = useState(false);

  // Setup form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/driver/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setIsProfileCompleted(!!data.username);
        if (data.username) setUsername(data.username);
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSetupProfile = async () => {
    if (!username.trim()) return Alert.alert("Error", "Username is required");
    if (!password) return Alert.alert("Error", "Password is required");
    if (password !== confirmPassword)
      return Alert.alert("Error", "Passwords do not match");
    if (password.length < 6)
      return Alert.alert("Error", "Password must be at least 6 characters");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/driver/update-profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Profile created! Proceeding to onboarding...", [
          {
            text: "OK",
            onPress: () => navigation.replace("DriverOnboardingStep1"),
          },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to update profile");
      }
    } catch (e) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
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

  const toggleDriverStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const newStatus =
        profile?.driver_status === "active" ? "offline" : "active";
      const res = await fetch(`${API_URL}/driver/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setProfile((prev) => ({ ...prev, driver_status: newStatus }));
      }
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#1db95b"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }

  // Profile Setup View
  if (!isProfileCompleted) {
    return (
      <SafeAreaView style={styles.containerGreen}>
        <ScrollView
          contentContainerStyle={styles.setupScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.setupHeader}>
            <Text style={styles.setupTitle}>Complete Your Profile</Text>
            <Text style={styles.setupSubtitle}>
              Create your login credentials to get started
            </Text>
          </View>
          <View style={styles.setupCard}>
            <Text style={styles.setupGreeting}>
              Welcome, {profile?.full_name || "Driver"}!
            </Text>
            <Text style={styles.setupInfo}>{profile?.email}</Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a username"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.setupBtn, saving && styles.setupBtnDisabled]}
              onPress={handleSetupProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.setupBtnText}>
                  Save & Continue to Onboarding
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Full Profile View
  return (
    <SafeAreaView style={styles.container}>
      <DriverScreenHeader
        title="Profile"
        rightIcon="settings"
        onBackPress={() => navigation.goBack()}
        onRightPress={() => {}}
      />
      <ScrollView contentContainerStyle={styles.profileScroll}>
        {/* Personal Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{profile?.full_name || "-"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{profile?.username || "-"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email || "-"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone_number || "-"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>NIC Number</Text>
            <Text style={styles.infoValue}>{profile?.nic_number || "-"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>{profile?.address || "-"}</Text>
          </View>
        </View>

        {/* Work Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Work Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Working Time</Text>
            <Text style={styles.infoValue}>{profile?.working_time || "-"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle Number</Text>
            <Text style={styles.infoValue}>
              {profile?.vehicle_number || "-"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle Type</Text>
            <Text style={styles.infoValue}>{profile?.vehicle_type || "-"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    profile?.driver_status === "active" ? "#dcfce7" : "#fee2e2",
                },
              ]}
            >
              <Text
                style={{
                  color:
                    profile?.driver_status === "active" ? "#16a34a" : "#dc2626",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {profile?.driver_status || "offline"}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Joined</Text>
            <Text style={styles.infoValue}>
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : "-"}
            </Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  containerGreen: { flex: 1, backgroundColor: "#1db95b" },
  setupScroll: { flexGrow: 1, padding: 20 },
  setupHeader: { marginBottom: 24, alignItems: "center" },
  setupTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  setupSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
    textAlign: "center",
  },
  setupCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  setupGreeting: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  setupInfo: { fontSize: 13, color: "#6b7280", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: "#d1fae5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f0fdf4",
    marginBottom: 16,
  },
  setupBtn: {
    backgroundColor: "#1db95b",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  setupBtnDisabled: { opacity: 0.6 },
  setupBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  profileScroll: { paddingBottom: 40 },
  profileHeader: {
    backgroundColor: "#1db95b",
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: "center",
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 36, fontWeight: "800", color: "#fff" },
  profileName: { fontSize: 22, fontWeight: "800", color: "#fff" },
  profileEmail: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusToggleText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  card: {
    margin: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  infoValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  divider: { height: 1, backgroundColor: "#f3f4f6" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  logoutBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#dc2626" },
});
