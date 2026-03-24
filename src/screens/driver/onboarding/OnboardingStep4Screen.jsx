import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../../config/env";
import StepProgress from "../../../components/driver/StepProgress";

const SRI_LANKA_BANKS = [
  "Bank of Ceylon","Peoples Bank","Commercial Bank","Hatton National Bank",
  "Sampath Bank","Seylan Bank","Nations Trust Bank","Pan Asia Bank",
  "DFCC Bank","NDB Bank","Cargills Bank","Union Bank","Amana Bank",
  "MCB Bank","Standard Chartered","HSBC","Citibank","State Bank of India",
];

export default function OnboardingStep4Screen({ navigation }) {
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!accountHolderName.trim()) return Alert.alert("Error", "Account holder name is required");
    if (!bankName) return Alert.alert("Error", "Please select a bank");
    if (!branch.trim()) return Alert.alert("Error", "Branch is required");
    if (!accountNumber.trim()) return Alert.alert("Error", "Account number is required");
    if (accountNumber !== confirmAccountNumber) return Alert.alert("Error", "Account numbers do not match");
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/onboarding/step-4`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: accountHolderName.trim(),
          bankName,
          branch: branch.trim(),
          accountNumber: accountNumber.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) navigation.replace("DriverOnboardingStep5");
      else Alert.alert("Error", data.message || "Failed. Try again.");
    } catch (e) { Alert.alert("Error", "Network error."); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <StepProgress currentStep={4} />
        <Text style={s.title}>Bank Details</Text>
        <Text style={s.subtitle}>Step 4 of 5  Payment information</Text>
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.label}>Account Holder Name</Text>
            <TextInput style={s.input} value={accountHolderName} onChangeText={setAccountHolderName}
              placeholder="Name as on bank account" placeholderTextColor="#9ca3af" />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Bank Name</Text>
            <TouchableOpacity style={[s.input, s.pickerBtn]} onPress={() => setShowBankPicker(!showBankPicker)}>
              <Text style={[s.pickerText, !bankName && s.placeholder]}>{bankName || "Select your bank"}</Text>
            </TouchableOpacity>
            {showBankPicker && (
              <View style={s.bankList}>
                {SRI_LANKA_BANKS.map((b) => (
                  <TouchableOpacity key={b} style={[s.bankOption, bankName === b && s.bankOptionActive]}
                    onPress={() => { setBankName(b); setShowBankPicker(false); }}>
                    <Text style={[s.bankOptionText, bankName === b && s.bankOptionTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Branch</Text>
            <TextInput style={s.input} value={branch} onChangeText={setBranch}
              placeholder="e.g. Colombo 07" placeholderTextColor="#9ca3af" />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Account Number</Text>
            <TextInput style={s.input} value={accountNumber} onChangeText={setAccountNumber}
              placeholder="Your bank account number" placeholderTextColor="#9ca3af" keyboardType="numeric" />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Confirm Account Number</Text>
            <TextInput style={[s.input, accountNumber && confirmAccountNumber && accountNumber !== confirmAccountNumber && s.inputError]}
              value={confirmAccountNumber} onChangeText={setConfirmAccountNumber}
              placeholder="Re-enter account number" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            {accountNumber && confirmAccountNumber && accountNumber !== confirmAccountNumber && (
              <Text style={s.errorText}>Account numbers do not match</Text>
            )}
          </View>

          <TouchableOpacity style={[s.nextBtn, submitting && s.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.nextBtnText}>Continue to Final Step</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
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
  title: { fontSize: 26, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, elevation: 8 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: "#B8F0D0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", backgroundColor: "#EDFBF2" },
  inputError: { borderColor: "#fca5a5" },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  pickerBtn: { justifyContent: "center" },
  pickerText: { fontSize: 15, color: "#111827" },
  placeholder: { color: "#9ca3af" },
  bankList: { maxHeight: 220, borderWidth: 1.5, borderColor: "#B8F0D0", borderRadius: 10, overflow: "hidden", marginTop: 4 },
  bankOption: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EDFBF2" },
  bankOptionActive: { backgroundColor: "#dcfce7" },
  bankOptionText: { fontSize: 14, color: "#374151" },
  bankOptionTextActive: { color: "#06C168", fontWeight: "600" },
  nextBtn: { backgroundColor: "#06C168", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  backBtn: { marginTop: 10, alignItems: "center", paddingVertical: 10 },
  backBtnText: { fontSize: 14, color: "#6b7280" },
});
