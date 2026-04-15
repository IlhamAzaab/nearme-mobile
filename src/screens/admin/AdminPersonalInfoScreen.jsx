import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

function pickFirstValue(source, keys, fallback = "-") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function InfoRow({ label, value, verified = false, isLast = false }) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.infoValueWrap}>
          <Text style={styles.infoValue}>{value || "-"}</Text>
          {verified ? (
            <Ionicons
              name="checkmark-circle"
              size={17}
              color="#15803D"
              style={styles.verifiedIcon}
            />
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </View>
  );
}

export default function AdminPersonalInfoScreen({ navigation }) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({
    full_name: "-",
    phone: "-",
    email: "-",
    nic_number: "-",
    home_address: "-",
  });

  const initials = useMemo(() => {
    const name = String(details.full_name || "").trim();
    if (!name) return "A";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 1).toUpperCase();
    }
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
  }, [details.full_name]);

  const loadPersonalInfo = useCallback(async () => {
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

      const response = await fetch(`${API_URL}/admin/personal-info`, {
        headers,
      });

      if (response.status === 401 || response.status === 403) {
        await logout();
        return;
      }

      let admin = null;
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        admin = payload?.admin || null;
      } else {
        const meRes = await fetch(`${API_URL}/admin/me`, { headers });
        const mePayload = await meRes.json().catch(() => ({}));

        if (meRes.status === 401 || meRes.status === 403) {
          await logout();
          return;
        }

        admin = mePayload?.admin || null;
      }

      if (!admin) {
        Alert.alert("Error", "Unable to load personal information.");
        return;
      }

      setDetails({
        full_name: pickFirstValue(admin, ["full_name", "name", "username"]),
        phone: pickFirstValue(admin, ["phone", "mobile", "mobile_number"]),
        email: pickFirstValue(admin, ["email"]),
        nic_number: pickFirstValue(admin, ["nic_number", "nic", "nicNumber"]),
        home_address: pickFirstValue(admin, [
          "home_address",
          "address",
          "homeAddress",
        ]),
      });
    } catch {
      Alert.alert("Error", "Network error while loading personal information.");
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadPersonalInfo();
  }, [loadPersonalInfo]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading personal info...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal info</Text>
        <View style={styles.headerRightGap} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={16} color="#111827" />
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Name" value={details.full_name} />
          <InfoRow label="Phone number" value={details.phone} verified />
          <InfoRow label="Email" value={details.email} verified />
          <InfoRow label="NIC number" value={details.nic_number} />
          <InfoRow label="Home address" value={details.home_address} isLast />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F4F5F7",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: "#111827",
  },
  headerRightGap: {
    width: 36,
    height: 36,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  avatarWrap: {
    marginTop: 16,
    marginBottom: 16,
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "700",
    color: "#6B7280",
  },
  editBadge: {
    position: "absolute",
    right: 6,
    bottom: 8,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECEF",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 5,
  },
  infoValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  verifiedIcon: {
    marginLeft: 6,
  },
});
