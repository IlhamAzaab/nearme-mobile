import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const SRI_LANKA_BANKS = [
  "Bank of Ceylon",
  "People's Bank",
  "Commercial Bank",
  "Hatton National Bank",
  "Sampath Bank",
  "Nations Trust Bank",
  "DFCC Bank",
  "Seylan Bank",
  "Union Bank",
  "Pan Asia Bank",
  "Amana Bank",
  "Cargills Bank",
  "National Development Bank",
  "Standard Chartered Bank",
  "Citibank",
  "HSBC",
  "Other",
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
    if (!accountHolderName.trim())
      return Alert.alert("Error", "Account holder name is required");
    if (!bankName) return Alert.alert("Error", "Please select a bank");
    if (!branch.trim()) return Alert.alert("Error", "Branch is required");
    if (!accountNumber.trim())
      return Alert.alert("Error", "Account number is required");
    if (accountNumber !== confirmAccountNumber)
      return Alert.alert("Error", "Account numbers do not match");
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/onboarding/step-4`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
        <StepProgress currentStep={4} />
        <View style={s.logoWrap}>
          <SvgXml xml={NEARME_LOGO_ARTBOARD5_XML} width={152} height={152} />
        </View>
        <Text style={s.title}>Bank Details</Text>
        <Text style={s.subtitle}>Step 4 of 5 Payment information</Text>
        <View style={s.card}>
          <View style={s.field}>
            <FloatingInputField
              label="Account Holder Name"
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder="Accoount holder Name"
            />
          </View>

          <View style={s.field}>
            {(showBankPicker || !!bankName) && (
              <Text style={s.floatingLabel}>Bank Name</Text>
            )}
            <TouchableOpacity
              style={[s.input, s.pickerBtn]}
              onPress={() => setShowBankPicker(!showBankPicker)}
            >
              <Text style={[s.pickerText, !bankName && s.placeholder]}>
                {bankName || "Select your bank"}
              </Text>
            </TouchableOpacity>
            {showBankPicker && (
              <View style={s.bankList}>
                {SRI_LANKA_BANKS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[s.bankOption, bankName === b && s.bankOptionActive]}
                    onPress={() => {
                      setBankName(b);
                      setShowBankPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        s.bankOptionText,
                        bankName === b && s.bankOptionTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={s.field}>
            <FloatingInputField
              label="Branch"
              value={branch}
              onChangeText={setBranch}
              placeholder="Branch"
            />
          </View>

          <View style={s.field}>
            <FloatingInputField
              label="Account Number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="Your bank account number"
              keyboardType="numeric"
            />
          </View>

          <View style={s.field}>
            <FloatingInputField
              label="Confirm Account Number"
              value={confirmAccountNumber}
              onChangeText={setConfirmAccountNumber}
              placeholder="Re-enter account number"
              keyboardType="numeric"
              inputStyle={[
                accountNumber &&
                  confirmAccountNumber &&
                  accountNumber !== confirmAccountNumber &&
                  s.inputError,
              ]}
            />
            {accountNumber &&
              confirmAccountNumber &&
              accountNumber !== confirmAccountNumber && (
                <Text style={s.errorText}>Account numbers do not match</Text>
              )}
          </View>

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

          <View style={s.infoBox}>
            <Text style={s.infoTitle}>Payment Information</Text>
            <Text style={s.infoItem}>
              Daily earnings will be transferred to this account before 2.00 a.m
            </Text>
            <Text style={s.infoItem}>
              Minimum earnings should be 500 for transfer to happen
            </Text>
            <Text style={s.infoItem}>
              Ensure account details are accurate to avoid delays
            </Text>
          </View>

          <View style={s.securityBox}>
            <Text style={s.securityText}>
              Security: Your bank details are encrypted and stored securely.
            </Text>
          </View>

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
  input: {
    borderWidth: 1.5,
    borderColor: "#B8F0D0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#EDFBF2",
  },
  inputError: { borderColor: "#fca5a5" },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  pickerBtn: { justifyContent: "center" },
  pickerText: { fontSize: 15, color: "#111827" },
  placeholder: { color: "#9ca3af" },
  bankList: {
    maxHeight: 220,
    borderWidth: 1.5,
    borderColor: "#B8F0D0",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 4,
  },
  bankOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDFBF2",
  },
  bankOptionActive: { backgroundColor: "#dcfce7" },
  bankOptionText: { fontSize: 14, color: "#374151" },
  bankOptionTextActive: { color: "#06C168", fontWeight: "600" },
  nextBtn: {
    backgroundColor: "#06C168",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  infoBox: {
    marginTop: 12,
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 2,
  },
  infoItem: { fontSize: 13, color: "#166534" },
  securityBox: {
    marginTop: 10,
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  securityText: { fontSize: 13, color: "#166534" },
  backBtn: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  backBtnText: { fontSize: 14, color: "#6b7280" },
});
