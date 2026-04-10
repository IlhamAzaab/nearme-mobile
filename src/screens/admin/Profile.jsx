import { useCallback, useEffect, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../config/env";
import { useAuth } from "../../app/providers/AuthProvider";
import { getAccessToken } from "../../lib/authStorage";

const PRIVACY_POLICY_URL = "https://tiny-medovik-de85ce.netlify.app";
const TERMS_AND_CONDITIONS_URL = "https://silly-toffee-589ef6.netlify.app";
const HELP_AND_SUPPORT_URL = "https://amazing-zabaione-f13806.netlify.app";

function pickFirstValue(source, keys, fallback = "-") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
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

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "-"}</Text>
    </View>
  );
}

function SupportItem({ label, onPress, isLast = false }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.supportItem, isLast && styles.supportItemLast]}
    >
      <Text style={styles.supportText}>{label}</Text>
      <Text style={styles.supportArrow}>{">"}</Text>
    </TouchableOpacity>
  );
}

export default function Profile({ navigation }) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({
    fullName: "-",
    adminId: "-",
    role: "Admin",
    phoneNumber: "-",
    email: "-",
    assignedAreaOrBranch: "-",
    joinedDate: "-",
    restaurantName: "Restaurant",
    restaurantLogoUrl: "",
  });

  const openInAppWebView = useCallback(
    (title, url) => {
      navigation.navigate("WebView", { title, url });
    },
    [navigation],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [token, storedRole, storedUserName] = await Promise.all([
        getAccessToken(),
        AsyncStorage.getItem("role"),
        AsyncStorage.getItem("userName"),
      ]);

      if (!token || storedRole !== "admin") {
        await logout();
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [response, restaurantResponse] = await Promise.all([
        fetch(`${API_URL}/admin/me`, { headers }),
        fetch(`${API_URL}/admin/restaurant`, { headers }),
      ]);

      const data = await response.json().catch(() => ({}));
      const restaurantData = await restaurantResponse.json().catch(() => ({}));

      if (
        response.status === 401 ||
        response.status === 403 ||
        restaurantResponse.status === 401 ||
        restaurantResponse.status === 403
      ) {
        await logout();
        return;
      }

      if (!response.ok || !data?.admin) {
        Alert.alert("Error", "Failed to load admin profile.");
        return;
      }

      const admin = data.admin;
      const restaurant =
        restaurantData?.restaurant || admin?.restaurant || data?.restaurant || {};
      const adminAndRestaurant = { ...restaurant, ...admin };

      setDetails({
        fullName: pickFirstValue(
          admin,
          ["full_name", "name", "username"],
          storedUserName || "-",
        ),
        adminId: pickFirstValue(admin, ["admin_id", "id", "user_id"]),
        role: pickFirstValue(admin, ["role", "admin_role"], "Admin"),
        phoneNumber: pickFirstValue(admin, ["phone", "mobile", "mobile_number"]),
        email: pickFirstValue(admin, ["email"]),
        assignedAreaOrBranch: pickFirstValue(adminAndRestaurant, [
          "assigned_area",
          "area",
          "branch",
          "branch_name",
        ]),
        joinedDate: formatJoinedDate(
          pickFirstValue(admin, ["joined_date", "joined_at", "created_at"], ""),
        ),
        restaurantName: pickFirstValue(
          restaurant,
          ["restaurant_name", "business_name", "name", "brand_name"],
          "Restaurant",
        ),
        restaurantLogoUrl: pickFirstValue(
          restaurant,
          [
            "restaurant_logo_url",
            "restaurant_logo",
            "logo_url",
            "logoUrl",
            "restaurantLogoUrl",
          ],
          "",
        ),
      });
    } catch {
      Alert.alert("Error", "Network error while loading profile.");
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.bgOrbOne} />
      <View style={styles.bgOrbTwo} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroLogoWrap}>
            {details.restaurantLogoUrl ? (
              <Image
                source={{ uri: details.restaurantLogoUrl }}
                style={styles.heroLogo}
              />
            ) : (
              <Text style={styles.heroLogoFallback}>
                {String(details.restaurantName || "R").charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>Restaurant</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {details.restaurantName}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {details.fullName}
            </Text>
          </View>

          <View style={styles.heroRolePill}>
            <Text style={styles.heroRoleText}>{details.role}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile Details</Text>

          <DetailRow label="Full Name" value={details.fullName} />
          <DetailRow label="Admin ID" value={details.adminId} />
          <DetailRow label="Role" value={details.role} />
          <DetailRow label="Phone Number" value={details.phoneNumber} />
          <DetailRow label="Email" value={details.email} />
          <DetailRow
            label="Assigned Area / Branch"
            value={details.assignedAreaOrBranch}
          />
          <DetailRow label="Joined Date" value={details.joinedDate} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support & Legal</Text>

          <SupportItem
            label="Help & Support"
            onPress={() => openInAppWebView("Help & Support", HELP_AND_SUPPORT_URL)}
          />
          <SupportItem
            label="Privacy Policy"
            onPress={() => openInAppWebView("Privacy Policy", PRIVACY_POLICY_URL)}
          />
          <SupportItem
            label="Terms & Conditions"
            onPress={() =>
              openInAppWebView("Terms & Conditions", TERMS_AND_CONDITIONS_URL)
            }
            isLast
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
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
    backgroundColor: "#EDFBF2",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#EDFBF2",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  bgOrbOne: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#C5F5DA",
    opacity: 0.7,
  },
  bgOrbTwo: {
    position: "absolute",
    top: 100,
    left: -55,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#DDF8E9",
    opacity: 0.75,
  },
  scrollView: {
    flex: 1,
  },
  pageAnimationWrap: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E7ECF3",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  heroLogoWrap: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogo: {
    width: "100%",
    height: "100%",
  },
  heroLogoFallback: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
  },
  heroContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  heroKicker: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  heroTitle: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  heroSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  heroRolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
  },
  heroRoleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5EAF1",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
  },
  supportItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  supportItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  supportText: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
  },
  supportArrow: {
    fontSize: 18,
    lineHeight: 20,
    color: "#94A3B8",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 0,
    backgroundColor: "#EDFBF2",
  },
  logoutButton: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B91C1C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 2,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
