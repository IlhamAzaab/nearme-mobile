import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../../config/env";
import FloatingInputField from "../../../components/driver/FloatingInputField";
import StepProgress from "../../../components/driver/StepProgress";
import { NEARME_LOGO_ARTBOARD5_XML } from "../../../assets/NearMeLogoArtboard5Xml";

const VEHICLE_TYPES = [
  { key: "bike", label: "Bike" },
  { key: "auto", label: "Auto" },
];

export default function OnboardingStep2Screen({ navigation }) {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");
  const [vehicleModel, setVehicleModel] = useState("");
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState(null);
  const [insuranceExpiry, setInsuranceExpiry] = useState(null);
  const [vehicleLicenseExpiry, setVehicleLicenseExpiry] = useState(null);
  const [showPicker, setShowPicker] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const datePickers = [
    {
      key: "license",
      label: "Driving-License Expiry",
      value: licenseExpiry,
      setter: setLicenseExpiry,
    },
    {
      key: "insurance",
      label: "Insurance Expiry",
      value: insuranceExpiry,
      setter: setInsuranceExpiry,
    },
    {
      key: "vehicleLicense",
      label: "Vehicle-License Expiry",
      value: vehicleLicenseExpiry,
      setter: setVehicleLicenseExpiry,
    },
  ];

  const handleSubmit = async () => {
    if (!vehicleNumber.trim())
      return Alert.alert("Error", "Vehicle number is required");
    if (!vehicleModel.trim())
      return Alert.alert("Error", "Vehicle model is required");
    if (!drivingLicenseNumber.trim())
      return Alert.alert("Error", "License number is required");
    if (!licenseExpiry || !insuranceExpiry || !vehicleLicenseExpiry) {
      return Alert.alert("Error", "All expiry dates are required");
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/onboarding/step-2`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          vehicleType,
          vehicleModel: vehicleModel.trim(),
          drivingLicenseNumber: drivingLicenseNumber.trim(),
          licenseExpiryDate: licenseExpiry.toISOString().split("T")[0],
          insuranceExpiry: insuranceExpiry.toISOString().split("T")[0],
          vehicleLicenseExpiry: vehicleLicenseExpiry
            .toISOString()
            .split("T")[0],
        }),
      });
      const data = await res.json();
      if (res.ok) navigation.replace("DriverOnboardingStep3");
      else Alert.alert("Error", data.message || "Failed. Try again.");
    } catch (e) {
      Alert.alert("Error", "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <StepProgress currentStep={2} />
        <View style={s.logoWrap}>
          <SvgXml xml={NEARME_LOGO_ARTBOARD5_XML} width={152} height={152} />
        </View>
        <Text style={s.title}>Vehicle & License</Text>
        <Text style={s.subtitle}>Step 2 of 5 Your vehicle details</Text>
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.label}>Vehicle Type</Text>
            <View style={s.optionsRow}>
              {VEHICLE_TYPES.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    s.optionBtn,
                    vehicleType === o.key && s.optionBtnActive,
                  ]}
                  onPress={() => setVehicleType(o.key)}
                >
                  <Text
                    style={[
                      s.optionText,
                      vehicleType === o.key && s.optionTextActive,
                    ]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {[
            {
              label: "Vehicle Registration Number",
              value: vehicleNumber,
              onChange: (text) => setVehicleNumber(text.toUpperCase()),
              placeholder: "Eg; BEO-5678",
            },
            {
              label: "Vehicle Model",
              value: vehicleModel,
              onChange: setVehicleModel,
              placeholder: "Eg; Pulsur 150 or Hero Honda",
            },
            {
              label: "Driving License Number",
              value: drivingLicenseNumber,
              onChange: setDrivingLicenseNumber,
              placeholder: "Eg; B1234567",
            },
          ].map((f) => (
            <View key={f.label} style={s.field}>
              <FloatingInputField
                label={f.label}
                value={f.value}
                onChangeText={f.onChange}
                placeholder={f.placeholder}
                autoCapitalize="characters"
              />
            </View>
          ))}
          {datePickers.map((dp) => (
            <View key={dp.key} style={s.field}>
              {(showPicker === dp.key || !!dp.value) && (
                <Text style={s.floatingLabel}>{dp.label}</Text>
              )}
              <TouchableOpacity
                style={s.dateBtn}
                onPress={() => setShowPicker(dp.key)}
              >
                <Text style={[s.dateBtnText, !dp.value && s.placeholder]}>
                  {dp.value ? dp.value.toLocaleDateString() : "Select date"}
                </Text>
              </TouchableOpacity>
              {showPicker === dp.key && (
                <DateTimePicker
                  value={dp.value || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(e, d) => {
                    setShowPicker(null);
                    if (d) dp.setter(d);
                  }}
                />
              )}
            </View>
          ))}
          <TouchableOpacity
            style={[s.nextBtn, submitting && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.nextBtnText}>Continue</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06C168" },
  scroll: { flexGrow: 1, padding: 20 },
  logoWrap: { alignItems: "center", marginBottom: 8 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 8,
  },
  field: { marginBottom: 16 },
  floatingLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#06C168",
    marginBottom: 4,
    marginLeft: 14,
  },
  dateBtn: {
    borderWidth: 1.5,
    borderColor: "#B8F0D0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: "#EDFBF2",
  },
  dateBtnText: { fontSize: 15, color: "#111827" },
  placeholder: { color: "#9ca3af" },
  optionsRow: { flexDirection: "row", gap: 8 },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#B8F0D0",
    alignItems: "center",
  },
  optionBtnActive: { backgroundColor: "#06C168", borderColor: "#06C168" },
  optionText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  optionTextActive: { color: "#fff" },
  nextBtn: {
    backgroundColor: "#06C168",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  backBtn: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  backBtnText: { fontSize: 14, color: "#6b7280" },
});
