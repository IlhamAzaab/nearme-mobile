import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../../config/env";
import StepProgress from "../../../components/driver/StepProgress";

const WORKING_TIME_OPTIONS = [
  { key: "full_time", label: "Full Time" },
  { key: "day", label: "Day Shift" },
  { key: "night", label: "Night Shift" },
];

export default function OnboardingStep1Screen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [nicNumber, setNicNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(new Date(1995, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [workingTime, setWorkingTime] = useState("full_time");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) return Alert.alert("Error", "Full name is required");
    if (!nicNumber.trim()) return Alert.alert("Error", "NIC number is required");
    if (!phoneNumber.trim()) return Alert.alert("Error", "Phone number is required");
    if (!address.trim()) return Alert.alert("Error", "Address is required");
    if (!city.trim()) return Alert.alert("Error", "City is required");
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/onboarding/step-1`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          nicNumber: nicNumber.trim(),
          phoneNumber: phoneNumber.trim(),
          dateOfBirth: dateOfBirth.toISOString().split("T")[0],
          address: address.trim(),
          city: city.trim(),
          workingTime,
        }),
      });
      const data = await res.json();
      if (res.ok) navigation.replace("DriverOnboardingStep2");
      else Alert.alert("Error", data.message || "Failed to save. Try again.");
    } catch (e) { Alert.alert("Error", "Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <StepProgress currentStep={1} />
        <Text style={s.title}>Personal Information</Text>
        <Text style={s.subtitle}>Step 1 of 5  Tell us about yourself</Text>
        <View style={s.card}>
          {[
            { label: "Full Name (as on NIC)", value: fullName, onChange: setFullName, placeholder: "Enter your full name" },
            { label: "NIC Number", value: nicNumber, onChange: setNicNumber, placeholder: "e.g. 991234567V" },
            { label: "Phone Number", value: phoneNumber, onChange: setPhoneNumber, placeholder: "+94 7X XXX XXXX", keyboardType: "phone-pad" },
            { label: "Address", value: address, onChange: setAddress, placeholder: "Your residential address" },
            { label: "City", value: city, onChange: setCity, placeholder: "Your city" },
          ].map((f) => (
            <View key={f.label} style={s.field}>
              <Text style={s.label}>{f.label}</Text>
              <TextInput style={s.input} value={f.value} onChangeText={f.onChange} placeholder={f.placeholder}
                placeholderTextColor="#9ca3af" keyboardType={f.keyboardType || "default"} />
            </View>
          ))}

          <View style={s.field}>
            <Text style={s.label}>Date of Birth</Text>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={s.dateBtnText}>{dateOfBirth.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={dateOfBirth} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()} onChange={(e, d) => { setShowDatePicker(false); if (d) setDateOfBirth(d); }} />
            )}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Working Time</Text>
            <View style={s.optionsRow}>
              {WORKING_TIME_OPTIONS.map((o) => (
                <TouchableOpacity key={o.key} style={[s.optionBtn, workingTime === o.key && s.optionBtnActive]}
                  onPress={() => setWorkingTime(o.key)}>
                  <Text style={[s.optionText, workingTime === o.key && s.optionTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={[s.nextBtn, submitting && s.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.nextBtnText}>Continue </Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06C168" },
  scroll: { flexGrow: 1, padding: 20 },
  title: { fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: "#B8F0D0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", backgroundColor: "#EDFBF2" },
  dateBtn: { borderWidth: 1.5, borderColor: "#B8F0D0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#EDFBF2" },
  dateBtnText: { fontSize: 15, color: "#111827" },
  optionsRow: { flexDirection: "row", gap: 8 },
  optionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#B8F0D0", alignItems: "center" },
  optionBtnActive: { backgroundColor: "#06C168", borderColor: "#06C168" },
  optionText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  optionTextActive: { color: "#fff" },
  nextBtn: { backgroundColor: "#06C168", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
