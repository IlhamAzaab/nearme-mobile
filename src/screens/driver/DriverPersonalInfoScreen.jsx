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
import OptimizedImage from "../../components/common/OptimizedImage";
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

function formatDateValue(value) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function InfoRow({ label, value, isLast = false }) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "-"}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </View>
  );
}

export default function DriverPersonalInfoScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({
    email: "-",
    phone: "-",
    full_name: "-",
    profile_photo_url: "",
    nic_number: "-",
    city: "-",
    working_time: "-",
    date_of_birth: "-",
    address: "-",
  });

  const initials = useMemo(() => {
    const name = String(details.full_name || "").trim();
    if (!name || name === "-") return "D";
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
        throw new Error("No authentication token");
      }

      const response = await fetch(`${API_URL}/driver/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load personal info");
      }

      const driver = payload?.driver || payload?.data || payload || {};

      setDetails({
        email: pickFirstValue(driver, ["email"]),
        phone: pickFirstValue(driver, [
          "phone",
          "phone_number",
          "mobile_number",
        ]),
        full_name: pickFirstValue(driver, ["full_name", "name", "driver_name"]),
        profile_photo_url: pickFirstValue(
          driver,
          [
            "profile_photo_url",
            "profile_photo",
            "profile_picture",
            "avatar_url",
            "photo_url",
          ],
          "",
        ),
        nic_number: pickFirstValue(driver, [
          "nic_number",
          "nic",
          "national_id",
        ]),
        city: pickFirstValue(driver, ["city", "district", "town"]),
        working_time: pickFirstValue(driver, ["working_time", "work_shift"]),
        date_of_birth: formatDateValue(
          pickFirstValue(driver, ["date_of_birth", "dob", "birth_date"]),
        ),
        address: pickFirstValue(driver, [
          "address",
          "home_address",
          "current_address",
        ]),
      });
    } catch (error) {
      Alert.alert(
        "Error",
        error?.message || "Unable to load personal information.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

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
            {details.profile_photo_url ? (
              <OptimizedImage
                uri={details.profile_photo_url}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Email" value={details.email} />
          <InfoRow label="Phone" value={details.phone} />
          <InfoRow label="Full name" value={details.full_name} />
          <InfoRow
            label="Profile photo URL"
            value={details.profile_photo_url || "-"}
          />
          <InfoRow label="NIC number" value={details.nic_number} />
          <InfoRow label="City" value={details.city} />
          <InfoRow label="Working time" value={details.working_time} />
          <InfoRow label="Date of birth" value={details.date_of_birth} />
          <InfoRow label="Address" value={details.address} isLast />
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
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "700",
    color: "#6B7280",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  infoRow: {
    minHeight: 62,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  infoValue: {
    marginTop: 3,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "700",
  },
});
