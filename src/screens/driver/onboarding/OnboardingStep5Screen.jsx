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
import StepProgress from "../../../components/driver/StepProgress";
import { API_URL } from "../../../config/env";
import { NEARME_LOGO_ARTBOARD5_XML } from "../../../assets/NearMeLogoArtboard5Xml";

export default function OnboardingStep5Screen({ navigation }) {
  const [contractHtml] = useState(DEFAULT_CONTRACT);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!contractAccepted)
      return Alert.alert(
        "Error",
        "Please read and accept the terms and conditions",
      );
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
          userAgent: "Meezo Mobile App",
          contractHtml,
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

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <StepProgress currentStep={5} />
        <View style={s.logoWrap}>
          <SvgXml xml={NEARME_LOGO_ARTBOARD5_XML} width={152} height={152} />
        </View>
        <Text style={s.title}>Delivery Partner Agreement</Text>
        <Text style={s.subtitle}>
          Step 5 of 5 Review and accept the contract
        </Text>
        <View style={s.card}>
          <Text style={s.contractTitle}>Terms and Conditions</Text>
          <ScrollView style={s.contractScroll} nestedScrollEnabled>
            <Text style={s.contractText}>{contractHtml}</Text>
          </ScrollView>
          <View style={s.divider} />
          <TouchableOpacity
            style={[s.acceptRow, contractAccepted && s.acceptRowActive]}
            onPress={() => setContractAccepted((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={[s.acceptBox, contractAccepted && s.acceptBoxActive]}>
              {contractAccepted ? <Text style={s.acceptTick}>✓</Text> : null}
            </View>
            <Text style={s.checkLabel}>
              I have read, understood, and accept Meezo Delivery Partner Terms
              and Conditions.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.submitBtn,
              (!contractAccepted || submitting) && s.btnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!contractAccepted || submitting}
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
Meezo Delivery Partner Terms and Conditions

Version 1.0.0 - Effective Date: ${new Date().toLocaleDateString()}

1. Service Scope
This agreement is between Meezo Platform ("Manager") and you ("Delivery Partner"). Meezo is a food delivery service platform. By accepting these terms, you agree to provide food pickup and delivery services through Meezo.

2. Pickup Distance and Earnings (Partner to Restaurant)
- You will receive upto LKR 30 for travel from your location to the restaurant, up to 1 km.
- If this pickup distance exceeds 1 km, no additional pickup earning is paid for the excess distance.
- You can accept such orders if you want.

3. Delivery Distance Earnings (Restaurant to Customer)
- You will receive full earnings based on total delivery distance from restaurant to customer.
- Meezo pays LKR 35-50 per km depending on operating conditions; default base rate is LKR 40 per km.

4. Multi-Order Trip Bonuses
- Meezo will pay a bonus for you when accepting additional deliveries in the same trip.
- Second accepted delivery bonus: LKR 10-20.
- Third and more accepted deliveries bonus: LKR 15-30 each.
- You can accept up to 5 active deliveries in one trip.

5. Active Delivery Commitment
- Once you start delivering food to customers, you must complete all active deliveries in that trip.
- New order notifications are sent after all active deliveries are completed.

6. Order Collection and Responsibility
- At the restaurant, request each order using the order number shown in the app.
- You must verify all listed food items are packed correctly before pickup.
- After pickup, you are responsible for the order and associated cash-handling obligations.

7. Cash on Delivery and Settlement Rules
- All payments are handled as Cash on Delivery (COD).
- You must collect the exact payable amount from the customer as shown in the delivery page .
- You must settle the full collected amount to Meezo daily, either by bank transfer or direct payment to a manager.
- Daily settlement must be completed before 12:00 AM (midnight).

8. Tips and Priority Orders
- Platform tip amounts may be added to delivery details based on order conditions.
- If a tip appears in the delivery details, the order should be treated as priority.
- You may also receive additional direct tips from customers.
- Platform tip range is LKR 20-200, including weight-based allocations where applicable.

9. Fair Earnings for Extra Active Deliveries
- For extra active deliveries in the same trip, base delivery earnings will pay based on the additional travel-time factors to maintain fairness.

10. Restaurant Queue Priority
- Delivery partners are assigned a dedicated service queue and are not required to wait in the regular customer queue.

11. Compliance and Conduct
- You must follow applicable traffic, safety, and platform rules while delivering.
- Repeated violations, settlement delays, misconduct, or fraudulent behavior may result in account suspension or termination.

12. Updates to Terms
Meezo may update these terms when required for operations, legal compliance, or safety. Continued use of the platform after updates constitutes acceptance of revised terms.

13. Acceptance
By selecting the acceptance option below, you confirm that you have read, understood, and accepted these Meezo Delivery Partner Terms and Conditions.
`;

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
  acceptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fefce8",
    borderRadius: 12,
    padding: 12,
  },
  acceptRowActive: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  acceptBox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: "#9ca3af",
    borderRadius: 4,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  acceptBoxActive: {
    borderColor: "#06C168",
    backgroundColor: "#06C168",
  },
  acceptTick: {
    color: "#fff",
    fontWeight: "900",
    lineHeight: 16,
    fontSize: 13,
  },
  checkLabel: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 18 },
  submitBtn: {
    backgroundColor: "#06C168",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  backBtn: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  backBtnText: { fontSize: 14, color: "#6b7280" },
});
