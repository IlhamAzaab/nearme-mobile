import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StepProgress from "../../../components/driver/StepProgress";
import { API_URL } from "../../../config/env";

export default function OnboardingStep5Screen({ navigation }) {
  const [contractHtml, setContractHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmRead, setConfirmRead] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_URL}/onboarding/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.contractHtml) setContractHtml(data.contractHtml);
        else setContractHtml(DEFAULT_CONTRACT);
      } catch {
        setContractHtml(DEFAULT_CONTRACT);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  const handleSubmit = async () => {
    if (!confirmRead)
      return Alert.alert(
        "Error",
        "Please confirm that you have read the contract",
      );
    if (!contractAccepted)
      return Alert.alert("Error", "Please accept the contract to continue");
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/onboarding/step-5`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractAccepted: true,
          contractVersion: "1.0.0",
          userAgent: "NearMe Mobile App",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          "Submitted!",
          "Your application has been submitted for review.",
          [{ text: "OK", onPress: () => navigation.replace("DriverPending") }],
        );
      } else {
        Alert.alert("Error", data.message || "Failed. Try again.");
      }
    } catch (e) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator
          size="large"
          color="#fff"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <StepProgress currentStep={5} />
        <Text style={s.title}>Driver Agreement</Text>
        <Text style={s.subtitle}>
          Step 5 of 5 Review and accept the contract
        </Text>
        <View style={s.card}>
          <Text style={s.contractTitle}>Terms and Conditions</Text>
          <ScrollView style={s.contractScroll} nestedScrollEnabled>
            <Text style={s.contractText}>{contractHtml}</Text>
          </ScrollView>
          <View style={s.divider} />
          <View style={s.checkRow}>
            <Switch
              value={confirmRead}
              onValueChange={setConfirmRead}
              trackColor={{ false: "#d1d5db", true: "#86efac" }}
              thumbColor={confirmRead ? "#1db95b" : "#f4f4f5"}
            />
            <Text style={s.checkLabel}>
              I have read and understood the entire contract
            </Text>
          </View>
          <View style={s.checkRow}>
            <Switch
              value={contractAccepted}
              onValueChange={setContractAccepted}
              trackColor={{ false: "#d1d5db", true: "#86efac" }}
              thumbColor={contractAccepted ? "#1db95b" : "#f4f4f5"}
            />
            <Text style={s.checkLabel}>
              I agree to the terms and conditions of the driver agreement
            </Text>
          </View>
          <TouchableOpacity
            style={[
              s.submitBtn,
              (!confirmRead || !contractAccepted || submitting) &&
                s.btnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!confirmRead || !contractAccepted || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Submit Application</Text>
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

const DEFAULT_CONTRACT = `
Driver Partnership Agreement

Version 1.0.0 - Effective Date: ${new Date().toLocaleDateString()}

1. Introduction
This Driver Partnership Agreement ("Agreement") is entered into between NearMe Platform ("Company") and you ("Driver"). By accepting this agreement, you agree to provide transportation and delivery services through the NearMe platform.

2. Driver Requirements
• Must be at least 21 years of age
• Possess a valid Sri Lankan driving license
• Maintain valid vehicle insurance and revenue license
• Vehicle must pass safety and quality standards
• Must pass background verification checks

3. Driver Responsibilities
• Provide safe, courteous, and professional delivery services
• Maintain vehicle in good working condition
• Comply with all traffic laws and regulations
• Keep all documents valid and up to date
• Accept delivery requests within reasonable timeframes
• Treat customers with respect and professionalism
• Report any incidents or accidents immediately

4. Payment Terms
• Company will collect payment from customers on behalf of Driver
• Driver will receive weekly payment transfers to registered bank account
• Platform commission: 15% of total fare
• Driver receives 85% of total fare after commission
• Payment processing time: 2-3 business days
• Minimum payout threshold: LKR 1,000

5. Insurance and Liability
• Driver must maintain comprehensive vehicle insurance
• Driver is responsible for any damages or injuries during service
• Company is not liable for accidents during delivery
• Driver must report all incidents within 24 hours

6. Data and Privacy
• Company will collect and store Driver's personal and vehicle information
• Data will be used for verification, payment, and service improvement
• Driver information will not be shared with third parties without consent
• Customer data must be kept confidential

7. Account Suspension and Termination
• Company may suspend account for policy violations
• Repeated customer complaints may lead to deactivation
• Either party may terminate with 7 days notice
• Fraudulent activity results in immediate termination
• Outstanding payments will be settled within 30 days of termination

8. Quality Standards
• Maintain minimum 4.0 star rating
• Accept at least 80% of delivery requests
• Complete deliveries without cancellations
• Vehicle must be clean and presentable
• Driver must dress professionally

9. Code of Conduct
• No discrimination based on race, religion, gender, or disability
• No harassment or inappropriate behavior
• No unauthorized use of customer information
• No driving under influence of alcohol or drugs
• No smoking in vehicle during service

10. Dispute Resolution
• Any disputes will first be resolved through mediation
• Unresolved disputes will be handled under Sri Lankan law
• Jurisdiction: Courts of Colombo, Sri Lanka

11. Updates to Agreement
Company reserves the right to update this agreement. Drivers will be notified of changes 30 days in advance. Continued use of the platform constitutes acceptance of updated terms.

12. Contact Information
For questions or concerns about this agreement:
Email: support@nearme.lk
Phone: +94 11 234 5678
Address: 123 Main Street, Colombo 00100, Sri Lanka

By clicking "Submit Application", you acknowledge that you have read, understood, and agree to all terms and conditions of this Driver Partnership Agreement.
`;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1db95b" },
  scroll: { flexGrow: 1, padding: 20 },
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
  contractTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  contractScroll: {
    maxHeight: 280,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  contractText: { fontSize: 13, color: "#374151", lineHeight: 22 },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginBottom: 16 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  checkLabel: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 18 },
  submitBtn: {
    backgroundColor: "#1db95b",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  backBtn: { marginTop: 10, alignItems: "center", paddingVertical: 10 },
  backBtnText: { fontSize: 14, color: "#6b7280" },
});
