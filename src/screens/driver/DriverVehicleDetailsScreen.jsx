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

export default function DriverVehicleDetailsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({
    vehicle_type: "-",
    vehicle_model: "-",
    vehicle_number: "-",
    insurance_expiry: "-",
    vehicle_license_expiry: "-",
    driving_license_number: "-",
    license_expiry_date: "-",
  });

  const loadVehicleDetails = useCallback(async () => {
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
        throw new Error(payload?.message || "Failed to load vehicle details");
      }

      const driver = payload?.driver || payload?.data || payload || {};
      const vehicle =
        driver?.vehicle ||
        driver?.vehicle_details ||
        driver?.vehicleLicense ||
        driver?.vehicle_license ||
        payload?.vehicle ||
        payload?.vehicle_details ||
        payload?.vehicleLicense ||
        payload?.vehicle_license ||
        {};

      setDetails({
        vehicle_type:
          pickFirstValue(driver, ["vehicle_type", "vehicle_category"], "") ||
          pickFirstValue(vehicle, ["vehicle_type", "type", "vehicle_category"]),
        vehicle_model:
          pickFirstValue(driver, ["vehicle_model", "model"], "") ||
          pickFirstValue(vehicle, ["vehicle_model", "model"]),
        vehicle_number:
          pickFirstValue(
            driver,
            ["vehicle_number", "vehicle_no", "vehicle_registration_number"],
            "",
          ) ||
          pickFirstValue(vehicle, [
            "vehicle_number",
            "vehicle_no",
            "vehicle_registration_number",
            "registration_number",
            "plate_number",
          ]),
        insurance_expiry: formatDateValue(
          pickFirstValue(
            driver,
            ["insurance_expiry", "insurance_expiry_date"],
            "",
          ) ||
            pickFirstValue(vehicle, [
              "insurance_expiry",
              "insurance_expiry_date",
            ]),
        ),
        vehicle_license_expiry: formatDateValue(
          pickFirstValue(
            driver,
            ["vehicle_license_expiry", "vehicle_license_expiry_date"],
            "",
          ) ||
            pickFirstValue(vehicle, [
              "vehicle_license_expiry",
              "vehicle_license_expiry_date",
            ]),
        ),
        driving_license_number:
          pickFirstValue(
            driver,
            [
              "driving_license_number",
              "license_number",
              "driver_license_number",
            ],
            "",
          ) ||
          pickFirstValue(vehicle, [
            "driving_license_number",
            "license_number",
            "driver_license_number",
          ]),
        license_expiry_date: formatDateValue(
          pickFirstValue(
            driver,
            ["license_expiry_date", "driving_license_expiry"],
            "",
          ) ||
            pickFirstValue(vehicle, [
              "license_expiry_date",
              "driving_license_expiry",
              "driving_license_expiry_date",
            ]),
        ),
      });
    } catch (error) {
      Alert.alert("Error", error?.message || "Unable to load vehicle details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicleDetails();
  }, [loadVehicleDetails]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading vehicle details...</Text>
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
        <Text style={styles.headerTitle}>Vehicle details</Text>
        <View style={styles.headerRightGap} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <InfoRow label="Vehicle type" value={details.vehicle_type} />
          <InfoRow label="Vehicle model" value={details.vehicle_model} />
          <InfoRow label="Vehicle number" value={details.vehicle_number} />
          <InfoRow label="Insurance expiry" value={details.insurance_expiry} />
          <InfoRow
            label="Vehicle license expiry"
            value={details.vehicle_license_expiry}
          />
          <InfoRow
            label="Driving license number"
            value={details.driving_license_number}
          />
          <InfoRow
            label="License expiry date"
            value={details.license_expiry_date}
            isLast
          />
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
    paddingTop: 16,
    paddingBottom: 20,
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
