import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DriverProfileLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";
import {
  getDriverProfileScreenCache,
  setDriverProfileScreenCache,
} from "../../utils/driverProfileScreenCache";

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

function toInputDate(value) {
  if (!value || value === "-") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const text = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }
  return date.toISOString().slice(0, 10);
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
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState({
    vehicle_type: "-",
    vehicle_model: "-",
    vehicle_number: "-",
    insurance_expiry: "",
    vehicle_license_expiry: "",
    driving_license_number: "-",
    license_expiry_date: "",
  });

  const loadVehicleDetails = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

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

      const nextDetails = {
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
        insurance_expiry: toInputDate(
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
        vehicle_license_expiry: toInputDate(
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
        license_expiry_date: toInputDate(
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
      };

      setDetails(nextDetails);
      await setDriverProfileScreenCache("vehicle-details", nextDetails);
    } catch (error) {
      if (!silent) {
        Alert.alert(
          "Error",
          error?.message || "Unable to load vehicle details.",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const cached = await getDriverProfileScreenCache("vehicle-details");
      if (cached && mounted) {
        setDetails((prev) => ({ ...prev, ...cached }));
        setLoading(false);
        loadVehicleDetails({ silent: true });
        return;
      }
      loadVehicleDetails();
    })();

    return () => {
      mounted = false;
    };
  }, [loadVehicleDetails]);

  const saveExpiryDates = useCallback(async () => {
    const insuranceExpiry = String(details.insurance_expiry || "").trim();
    const vehicleLicenseExpiry = String(
      details.vehicle_license_expiry || "",
    ).trim();
    const licenseExpiryDate = String(details.license_expiry_date || "").trim();
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
      !insuranceExpiry ||
      !vehicleLicenseExpiry ||
      !licenseExpiryDate ||
      !datePattern.test(insuranceExpiry) ||
      !datePattern.test(vehicleLicenseExpiry) ||
      !datePattern.test(licenseExpiryDate)
    ) {
      Alert.alert(
        "Validation",
        "Please provide all 3 expiry dates in YYYY-MM-DD format.",
      );
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`${API_URL}/driver/vehicle-expiry`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          insuranceExpiry,
          vehicleLicenseExpiry,
          licenseExpiryDate,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update expiry dates");
      }

      const updatedVehicle = payload?.vehicle || {};
      const updatedDetails = {
        ...details,
        insurance_expiry: toInputDate(
          updatedVehicle.insurance_expiry ||
            insuranceExpiry ||
            details.insurance_expiry,
        ),
        vehicle_license_expiry: toInputDate(
          updatedVehicle.vehicle_license_expiry ||
            vehicleLicenseExpiry ||
            details.vehicle_license_expiry,
        ),
        license_expiry_date: toInputDate(
          updatedVehicle.license_expiry_date ||
            licenseExpiryDate ||
            details.license_expiry_date,
        ),
      };
      setDetails(updatedDetails);
      await setDriverProfileScreenCache("vehicle-details", updatedDetails);
      Alert.alert("Success", "Expiry dates updated successfully.");
    } catch (error) {
      Alert.alert("Error", error?.message || "Unable to update expiry dates.");
    } finally {
      setSaving(false);
    }
  }, [details]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top", "bottom"]}>
        <DriverProfileLoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
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
          <View style={styles.editableFieldWrap}>
            <Text style={styles.infoLabel}>Insurance expiry (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={details.insurance_expiry}
              onChangeText={(text) =>
                setDetails((prev) => ({ ...prev, insurance_expiry: text }))
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Text style={styles.hintText}>
              Current: {formatDateValue(details.insurance_expiry)}
            </Text>
          </View>
          <View style={styles.editableFieldWrap}>
            <Text style={styles.infoLabel}>
              Vehicle license expiry (YYYY-MM-DD)
            </Text>
            <TextInput
              style={styles.dateInput}
              value={details.vehicle_license_expiry}
              onChangeText={(text) =>
                setDetails((prev) => ({
                  ...prev,
                  vehicle_license_expiry: text,
                }))
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Text style={styles.hintText}>
              Current: {formatDateValue(details.vehicle_license_expiry)}
            </Text>
          </View>
          <InfoRow
            label="Driving license number"
            value={details.driving_license_number}
          />
          <View style={[styles.editableFieldWrap, styles.editableFieldLast]}>
            <Text style={styles.infoLabel}>
              License expiry date (YYYY-MM-DD)
            </Text>
            <TextInput
              style={styles.dateInput}
              value={details.license_expiry_date}
              onChangeText={(text) =>
                setDetails((prev) => ({ ...prev, license_expiry_date: text }))
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Text style={styles.hintText}>
              Current: {formatDateValue(details.license_expiry_date)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveExpiryDates}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Update Expiry Dates"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadVehicleDetails()}
          activeOpacity={0.85}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
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
  editableFieldWrap: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  editableFieldLast: {
    borderBottomWidth: 0,
  },
  dateInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  hintText: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  refreshButton: {
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 14,
  },
});
