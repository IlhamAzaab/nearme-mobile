import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
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
import OptimizedImage from "../../components/common/OptimizedImage";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const PRIVACY_POLICY_URL = "https://moonlit-dieffenbachia-52f106.netlify.app/";
const TERMS_AND_CONDITIONS_URL = "https://whimsical-sopapillas-ef4bec.netlify.app";
const HELP_AND_SUPPORT_URL = "https://tranquil-sawine-c7257f.netlify.app";

function pickFirstValue(source, keys, fallback = "-") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
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

export default function Profile({ navigation }) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    restaurantName: "Restaurant",
    restaurantLogoUrl: "",
    fullName: "-",
    phone: "-",
    email: "-",
  });

  const openInAppWebView = useCallback(
    (title, url) => {
      navigation.navigate("WebView", { title, url });
    },
    [navigation],
  );

  const loadSummary = useCallback(async () => {
    setLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        await logout();
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const personalRes = await fetch(`${API_URL}/admin/personal-info`, {
        headers,
      });

      if (personalRes.status === 401 || personalRes.status === 403) {
        await logout();
        return;
      }

      let admin = null;
      let restaurant = null;

      if (personalRes.ok) {
        const payload = await personalRes.json().catch(() => ({}));
        admin = payload?.admin || null;
        restaurant = payload?.restaurant || null;
      } else {
        const [meRes, restaurantRes] = await Promise.all([
          fetch(`${API_URL}/admin/me`, { headers }),
          fetch(`${API_URL}/admin/restaurant`, { headers }),
        ]);

        const mePayload = await meRes.json().catch(() => ({}));
        const restaurantPayload = await restaurantRes.json().catch(() => ({}));

        if (
          meRes.status === 401 ||
          meRes.status === 403 ||
          restaurantRes.status === 401 ||
          restaurantRes.status === 403
        ) {
          await logout();
          return;
        }

        admin = mePayload?.admin || null;
        restaurant = restaurantPayload?.restaurant || null;
      }

      if (!admin) {
        Alert.alert("Error", "Failed to load profile details.");
        return;
      }

      setSummary({
        fullName: pickFirstValue(admin, ["full_name", "name", "username"]),
        phone: pickFirstValue(admin, ["phone", "mobile", "mobile_number"]),
        email: pickFirstValue(admin, ["email"]),
        restaurantName: pickFirstValue(
          restaurant,
          ["restaurant_name", "business_name", "name"],
          "Restaurant",
        ),
        restaurantLogoUrl: pickFirstValue(
          restaurant,
          ["restaurant_logo_url", "restaurant_logo", "logo_url", "logoUrl"],
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
    loadSummary();
  }, [loadSummary]);

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
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.restaurantCard}>
          <View style={styles.restaurantLogoWrap}>
            {summary.restaurantLogoUrl ? (
              <OptimizedImage
                uri={summary.restaurantLogoUrl}
                style={styles.restaurantLogo}
              />
            ) : (
              <Text style={styles.restaurantLogoFallback}>
                {String(summary.restaurantName || "R")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            )}
          </View>

          <View style={styles.restaurantMeta}>
            <Text style={styles.restaurantMetaLabel}>Restaurant</Text>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {summary.restaurantName}
            </Text>
            <Text style={styles.adminName} numberOfLines={1}>
              {summary.fullName}
            </Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          <SectionRow
            icon="person-circle-outline"
            title="Personal Info"
            subtitle="Name, phone, email, NIC and address"
            onPress={() => navigation.navigate("AdminPersonalInfo")}
          />
          <SectionRow
            icon="storefront-outline"
            title="Restaurant Info"
            subtitle="Restaurant profile and business details"
            onPress={() => navigation.navigate("RestaurantDetail")}
          />
          <SectionRow
            icon="card-outline"
            title="Bank Account Details"
            subtitle="Payout account information"
            onPress={() => navigation.navigate("AdminBankDetails")}
          />
          <SectionRow
            icon="document-text-outline"
            title="Contract"
            subtitle="Accepted restaurant contract"
            onPress={() => navigation.navigate("AdminContract")}
          />
          <SectionRow
            icon="help-buoy-outline"
            title="Help & Support"
            subtitle="Need help with your account?"
            onPress={() =>
              openInAppWebView("Help & Support", HELP_AND_SUPPORT_URL)
            }
          />
          <SectionRow
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            subtitle="How we use your information"
            onPress={() =>
              openInAppWebView("Privacy Policy", PRIVACY_POLICY_URL)
            }
          />
          <SectionRow
            icon="reader-outline"
            title="Terms & Conditions"
            subtitle="Platform usage agreement"
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
    backgroundColor: "#F5F7FA",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
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
  restaurantCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  restaurantLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantLogo: {
    width: "100%",
    height: "100%",
  },
  restaurantLogoFallback: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  restaurantMeta: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantMetaLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  restaurantName: {
    marginTop: 2,
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },
  adminName: {
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
