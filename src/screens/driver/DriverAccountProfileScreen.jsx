import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import { DriverProfileLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const WORKING_TIME_LABELS = {
  full_time: "Full Time",
  part_time_morning: "Morning Shift",
  part_time_evening: "Evening Shift",
};

export default function DriverAccountProfileScreen({ navigation }) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["driver", "account-profile"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No authentication token");

      const res = await fetch(`${API_URL}/driver/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load profile");
      }

      return data?.driver || data;
    },
    initialData: () => queryClient.getQueryData(["driver", "account-profile"]),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const profile = profileQuery.data || null;
  const loading = profileQuery.isLoading && !profile;

  useEffect(() => {
    if (!profileQuery.isError) return;
    Alert.alert(
      "Error",
      profileQuery.error?.message || "Failed to load profile",
    );
  }, [profileQuery.isError, profileQuery.error]);

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
      <SafeAreaView style={styles.container}>
        <DriverProfileLoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <DriverScreenSection screenKey="DriverAccountProfile" sectionIndex={0}>
          <DriverScreenHeader
            title="My Profile"
            onBackPress={() => navigation.goBack()}
          />
        </DriverScreenSection>

        <DriverScreenSection
          screenKey="DriverAccountProfile"
          sectionIndex={1}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.heroCard}>
              <View style={styles.heroAvatar}>
                <Ionicons name="person" size={26} color="#fff" />
              </View>
              <View style={styles.heroContent}>
                <Text style={styles.heroName}>
                  {profile?.full_name || "Driver"}
                </Text>
                <Text style={styles.heroUsername}>
                  @ {profile?.username || "-"}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <InfoRow
                label="Full Name"
                value={profile?.full_name}
                icon="person-outline"
              />
              <InfoRow
                label="Email"
                value={profile?.email}
                icon="mail-outline"
              />
              <InfoRow
                label="Phone Number"
                value={profile?.phone_number}
                icon="call-outline"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Work Information</Text>
              <InfoRow
                label="Working Time"
                value={
                  WORKING_TIME_LABELS[profile?.working_time] ||
                  profile?.working_time
                }
                icon="time-outline"
              />
              <InfoRow
                label="Status"
                value={(profile?.driver_status || "unknown").toUpperCase()}
                icon="radio-button-on-outline"
                status={profile?.driver_status}
              />
              <InfoRow
                label="Vehicle Number"
                value={profile?.vehicle_number}
                icon="bicycle-outline"
              />
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </ScrollView>
        </DriverScreenSection>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, icon, status }) {
  const isActive = status === "active";

  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon} size={16} color="#06C168" />
        </View>
        <View style={styles.infoTextWrap}>
          <Text style={styles.infoLabel}>{label}</Text>
          {status ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActive ? "#dcfce7" : "#fee2e2" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isActive ? "#15803d" : "#b91c1c" },
                ]}
              >
                {value || "-"}
              </Text>
            </View>
          ) : (
            <Text style={styles.infoValue}>{value || "-"}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#dff5e8" },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 40 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06C168",
    marginRight: 12,
  },
  heroContent: { flex: 1 },
  heroName: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  heroUsername: { fontSize: 14, color: "#475569", marginTop: 2 },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  infoRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 13, color: "#64748b" },
  infoValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 1,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  statusText: { fontSize: 13, fontWeight: "800" },
  logoutBtn: {
    marginTop: 4,
    backgroundColor: "#ff0019",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#ff0019",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  logoutText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
