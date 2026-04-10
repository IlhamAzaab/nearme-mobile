import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Image,
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

const PROFILE_ENDPOINTS = ["/driver/profile", "/driver/me"];
const DRIVER_PRIVACY_POLICY_URL = "https://radiant-melba-e986f5.netlify.app";
const DRIVER_TERMS_URL = "https://glittering-banoffee-2a68ab.netlify.app";
const DRIVER_CODE_OF_CONDUCT_URL = "https://gleeful-dasik-6183d2.netlify.app";
const DRIVER_HELP_SUPPORT_URL = "https://brilliant-druid-8aaa8f.netlify.app";

function getFirstValue(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function maskLast4(value) {
  const clean = String(value || "").replace(/\s+/g, "").trim();
  if (!clean) return "-";
  if (clean.length <= 4) return clean;
  return clean.slice(-4);
}

function formatJoinedDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeDriverProfile(payload) {
  const source = payload?.driver || payload?.data || payload || {};
  const vehicleSource =
    source?.vehicle ||
    source?.vehicle_details ||
    source?.vehicleLicense ||
    source?.vehicle_license ||
    payload?.vehicleLicense ||
    payload?.vehicle_license ||
    payload?.vehicle ||
    {};
  const profilePhoto = getFirstValue(source, ["profile_picture", "profile_photo", "avatar_url"]);
  const onboardingCompletedDate = getFirstValue(source, [
    "onboarding_completed_at",
    "onboarding_completed_date",
    "onboarding_completed_on",
    "onboarding_finished_at",
    "onboarding_done_at",
    "onboarding_updated_at",
  ]);
  const fallbackJoinedDate = getFirstValue(source, ["joined_date", "joined_at", "created_at"]);

  return {
    raw: source,
    driverName: getFirstValue(source, ["full_name", "driver_name", "name", "user_name", "username"]) || "-",
    driverId: getFirstValue(source, ["driver_id", "id", "user_id", "driver_code"]) || "-",
    profilePhoto,
    phoneNumber: getFirstValue(source, ["phone_number", "phone", "mobile_number"]) || "-",
    email: getFirstValue(source, ["email"]) || "-",
    nicLast4: maskLast4(
      getFirstValue(source, ["nic_number", "nic", "national_id", "id_number"]),
    ),
    vehicleType:
      getFirstValue(source, ["vehicle_type", "vehicle_category"]) ||
      getFirstValue(vehicleSource, ["vehicle_type", "vehicle_category", "type"]) ||
      "-",
    vehicleNumber:
      getFirstValue(source, ["vehicle_number", "vehicle_no", "vehicle_registration_number"]) ||
      getFirstValue(vehicleSource, [
        "vehicle_number",
        "vehicle_no",
        "vehicle_registration_number",
        "registration_number",
        "plate_number",
      ]) ||
      "-",
    joinedDate: formatJoinedDate(onboardingCompletedDate || fallbackJoinedDate),
  };
}

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
      <View style={styles.bgOrbOne} />
      <View style={styles.bgOrbTwo} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            {profile?.profilePhoto ? (
              <Image source={{ uri: profile.profilePhoto }} style={styles.heroPhoto} />
            ) : (
              <Ionicons name="person" size={26} color="#fff" />
            )}
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>Driver Profile</Text>
            <Text style={styles.heroName}>{profile?.driverName || "Driver"}</Text>
            <Text style={styles.heroUsername}>Driver ID: {profile?.driverId || "-"}</Text>
          </View>
          <View style={styles.joinedPill}>
            <Ionicons name="calendar-outline" size={12} color="#0F766E" />
            <Text style={styles.joinedText}>{profile?.joinedDate || "-"}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          <InfoRow label="Driver Name" value={profile?.driverName} icon="person-outline" />
          <InfoRow label="Driver ID" value={profile?.driverId} icon="id-card-outline" />
          <InfoRow label="Phone Number" value={profile?.phoneNumber} icon="call-outline" />
          <InfoRow label="Email" value={profile?.email} icon="mail-outline" />
          <InfoRow label="NIC / ID (Last 4)" value={profile?.nicLast4} icon="card-outline" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Details</Text>
          <InfoRow label="Vehicle Type" value={profile?.vehicleType} icon="car-outline" />
          <InfoRow label="Vehicle Number" value={profile?.vehicleNumber} icon="bicycle-outline" />
          <InfoRow label="Joined Date" value={profile?.joinedDate} icon="calendar-outline" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal & Support</Text>

          <ActionButton
            label="Privacy Policy"
            icon="document-lock-outline"
            iconBg="#E0F2FE"
            iconColor="#0369A1"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Privacy Policy",
                url: DRIVER_PRIVACY_POLICY_URL,
              })
            }
          />

          <ActionButton
            label="Terms & Conditions"
            icon="document-text-outline"
            iconBg="#DCFCE7"
            iconColor="#166534"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Terms & Conditions",
                url: DRIVER_TERMS_URL,
              })
            }
          />

          <ActionButton
            label="Code of Conduct"
            icon="shield-checkmark-outline"
            iconBg="#EDE9FE"
            iconColor="#5B21B6"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Code of Conduct",
                url: DRIVER_CODE_OF_CONDUCT_URL,
              })
            }
          />

          <ActionButton
            label="Help & Support"
            icon="help-buoy-outline"
            iconBg="#FEE2E2"
            iconColor="#B91C1C"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Help & Support",
                url: DRIVER_HELP_SUPPORT_URL,
              })
            }
            isLast
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

function InfoRow({ label, value, icon }) {

  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon} size={16} color="#06C168" />
        </View>
        <View style={styles.infoTextWrap}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value || "-"}</Text>
        </View>
      </View>
    </View>
  );
}

function ActionButton({ label, icon, iconBg, iconColor, onPress, isLast = false }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, isLast ? styles.actionRowLast : null]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={styles.actionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF8" },
  bgOrbOne: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#D1FAE5",
  },
  bgOrbTwo: {
    position: "absolute",
    top: 120,
    left: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#E0F2FE",
  },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingTop: 18, paddingBottom: 40 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DDEEE6",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    marginRight: 14,
  },
  heroPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  heroContent: { flex: 1 },
  heroKicker: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F766E",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroName: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  heroUsername: { fontSize: 13, color: "#475569", marginTop: 3, fontWeight: "600" },
  joinedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#99F6E4",
    backgroundColor: "#ECFEFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  joinedText: { fontSize: 11, fontWeight: "700", color: "#0F766E" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D7DEE7",
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D7DEE7",
    paddingVertical: 10,
  },
  actionRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  actionText: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  logoutBtn: {
    marginTop: 2,
    backgroundColor: "#EF233C",
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexDirection: "row",
    shadowColor: "#EF233C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  logoutText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
