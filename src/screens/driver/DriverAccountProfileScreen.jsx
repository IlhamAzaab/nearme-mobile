import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import OptimizedImage from "../../components/common/OptimizedImage";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";
import {
  getDriverProfileScreenCache,
  setDriverProfileScreenCache,
} from "../../utils/driverProfileScreenCache";

const DRIVER_PRIVACY_POLICY_URL = "https://frabjous-douhua-6c3f75.netlify.app/";
const DRIVER_TERMS_URL = "https://friendly-torrone-f06da3.netlify.app/";
const DRIVER_CODE_OF_CONDUCT_URL = "https://gleeful-dasik-6183d2.netlify.app";
const DRIVER_HELP_SUPPORT_URL = "https://fluffy-kleicha-35881e.netlify.app/";

function pickFirstValue(source, keys, fallback = "-") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function normalizeDriverSummary(payload) {
  const source = payload?.driver || payload?.data || payload || {};

  return {
    fullName: pickFirstValue(source, ["full_name", "name", "driver_name"]),
    profilePhotoUrl: pickFirstValue(
      source,
      [
        "profile_photo_url",
        "profile_photo",
        "profile_picture",
        "avatar_url",
        "photo_url",
      ],
      "",
    ),
    email: pickFirstValue(source, ["email"]),
    phone: pickFirstValue(source, ["phone", "phone_number", "mobile_number"]),
  };
}

function SectionRow({ icon, title, subtitle, onPress, isLast = false }) {
  return (
    <TouchableOpacity
      style={[styles.sectionRow, isLast && styles.sectionRowLast]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <View style={styles.sectionRowLeft}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={18} color="#0F172A" />
        </View>

        <View style={styles.sectionTextWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
    </TouchableOpacity>
  );
}

export default function DriverAccountProfileScreen({ navigation }) {
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const userScope = String(user?.id || "anon");
  const profileQueryKey = useMemo(
    () => ["driver", userScope, "account-profile"],
    [userScope],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const cached = await getDriverProfileScreenCache("account-profile");
        if (cached) {
          queryClient.setQueryData(profileQueryKey, cached);
        }
      } finally {
        if (mounted) setCacheHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [profileQueryKey, queryClient]);

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
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
    enabled: cacheHydrated,
    initialData: () => queryClient.getQueryData(profileQueryKey),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setDriverProfileScreenCache("account-profile", profileQuery.data).catch(
      () => undefined,
    );
  }, [profileQuery.data]);

  const summary = normalizeDriverSummary(profileQuery.data || {});
  const loading =
    !cacheHydrated || (profileQuery.isLoading && !profileQuery.data);

  useEffect(() => {
    if (!profileQuery.isError) return;
    Alert.alert(
      "Error",
      profileQuery.error?.message || "Failed to load profile",
    );
  }, [profileQuery.isError, profileQuery.error]);

  const onLogoutPress = () => {
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
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#06C168" />
          <Text style={styles.loaderText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profilePhotoWrap}>
            {summary.profilePhotoUrl ? (
              <OptimizedImage
                uri={summary.profilePhotoUrl}
                style={styles.profilePhoto}
              />
            ) : (
              <Text style={styles.profilePhotoFallback}>
                {String(summary.fullName || "D")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            )}
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.profileMetaLabel}>Driver</Text>
            <Text style={styles.profileName} numberOfLines={1}>
              {summary.fullName || "Driver"}
            </Text>
            <Text style={styles.profileSub} numberOfLines={1}>
              {summary.email}
            </Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          <SectionRow
            icon="person-circle-outline"
            title="Personal Info"
            subtitle="Email, phone, name, NIC and address"
            onPress={() => navigation.navigate("DriverPersonalInfo")}
          />
          <SectionRow
            icon="car-outline"
            title="Vehicle Details"
            subtitle="Vehicle and license information"
            onPress={() => navigation.navigate("DriverVehicleDetails")}
          />
          <SectionRow
            icon="card-outline"
            title="Bank Account Details"
            subtitle="Payout account information"
            onPress={() => navigation.navigate("DriverBankDetails")}
          />
          <SectionRow
            icon="folder-open-outline"
            title="Documents"
            subtitle="Upload and view your renewed documents"
            onPress={() => navigation.navigate("DriverDocuments")}
          />
          <SectionRow
            icon="document-text-outline"
            title="Contract"
            subtitle="Accepted driver contract"
            onPress={() => navigation.navigate("DriverContract")}
          />
          <SectionRow
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            subtitle="How we use your information"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Privacy Policy",
                url: DRIVER_PRIVACY_POLICY_URL,
              })
            }
          />
          <SectionRow
            icon="reader-outline"
            title="Terms & Conditions"
            subtitle="Platform usage agreement"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Terms & Conditions",
                url: DRIVER_TERMS_URL,
              })
            }
          />
          <SectionRow
            icon="document-text-outline"
            title="Code of Conduct"
            subtitle="Driver behavior and standards"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Code of Conduct",
                url: DRIVER_CODE_OF_CONDUCT_URL,
              })
            }
          />
          <SectionRow
            icon="help-buoy-outline"
            title="Help & Support"
            subtitle="Need help with your account?"
            onPress={() =>
              navigation.navigate("WebView", {
                title: "Help & Support",
                url: DRIVER_HELP_SUPPORT_URL,
              })
            }
            isLast
          />
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.85}
          onPress={onLogoutPress}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loaderText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 14,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  profilePhotoWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
  },
  profilePhotoFallback: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  profileMeta: {
    flex: 1,
    marginLeft: 12,
  },
  profileMetaLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  profileName: {
    marginTop: 2,
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },
  profileSub: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    overflow: "hidden",
  },
  sectionRow: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionRowLast: {
    borderBottomWidth: 0,
  },
  sectionRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: "#F5F7FA",
  },
  logoutButton: {
    backgroundColor: "#111827",
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
