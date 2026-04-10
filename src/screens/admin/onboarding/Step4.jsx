import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
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
import { getAccessToken } from "../../../lib/authStorage";

const CONTRACT_VERSION = "1.1.0";

const MEEZO_LOGO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080">
  <defs>
    <style>
      .cls-1 {
        fill: #06c168;
        stroke-width: 0px;
      }
    </style>
  </defs>
  <path class="cls-1" d="m796.84,470.43c2.16-2.3,1.79-4.86-.71-4.86h-101.74c-2.52,0-5.62,2.05-6.9,4.57l-17.16,33.68c-1.29,2.53-.29,4.58,2.24,4.58h27.48c2.5,0,2.88,2.56.72,4.85l-89.65,95.15c-2.16,2.29-1.78,4.85.72,4.85h112.31c2.52,0,5.62-2.04,6.9-4.57l10.68-33.68c1.29-2.53.28-4.57-2.25-4.57h-31.76c-2.5,0-2.87-2.57-.71-4.86l89.83-95.14Z"/>
  <path class="cls-1" d="m564.84,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.14,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.36c2.14,0,4.76-1.74,5.85-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.7-3.88,5.84-3.88h34.77c2.13,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z"/>
  <path class="cls-1" d="m674.3,465.48h-89.17c-2.14,0-4.76,1.74-5.85,3.88l-71.86,141.03c-1.09,2.14-.24,3.88,1.9,3.88h91.3c2.14,0,4.75-1.74,5.84-3.88l18.04-35.4c1.09-2.14.24-3.87-1.9-3.87h-36.89c-2.13,0-2.99-1.73-1.9-3.87l3.1-6.07c1.09-2.14,3.7-3.87,5.84-3.87h31.37c2.13,0,4.75-1.74,5.84-3.88l14.57-28.6c1.09-2.14.24-3.87-1.9-3.87h-31.36c-2.14,0-2.99-1.73-1.9-3.87l2.34-4.58c1.09-2.14,3.71-3.88,5.84-3.88h34.77c2.14,0,4.75-1.73,5.84-3.87l18.04-35.4c1.09-2.14.24-3.88-1.9-3.88Z"/>
  <path class="cls-1" d="m455.98,475.4l-23.01,44.91c-1.96,3.83-5.1,6.86-9.03,8.71-30.64,14.45-56.96,26.84-66.45,31.3-2.31,1.09-5.25.69-7.61-1.03l-14.61-10.6-16.76-12.16-1.95-1.41c-4.49-3.26-10.24-2.47-12.57,1.71l-30.61,56.84c-7.03,13.06-20.71,20.85-36.62,20.85h-40.32c-3.86,0-6.8-4.34-5.11-7.51l41.38-76.8,21.66-40.22,3-5.57c11.39-21.13,40.35-25.25,62.84-8.93l12.1,8.78c9.65,7,19.3,14,28.95,21,3.09,2.25,6.19,4.5,9.28,6.74l82.97-39.09c1.44-.68,3.19,1.08,2.47,2.48Z"/>
  <g>
    <path class="cls-1" d="m883.66,586.15h-68.56s.09-.07.13-.12c-1.92-.44-3.34-2.16-3.34-4.2,0-1.19.48-2.28,1.26-3.06.79-.79,1.87-1.27,3.06-1.27h60.25c1.19,0,2.27-.48,3.05-1.26.79-.78,1.27-1.86,1.27-3.06,0-2.38-1.94-4.32-4.32-4.32h-42.37s.09-.08.14-.12c-1.91-.45-3.32-2.16-3.32-4.2,0-1.19.48-2.27,1.26-3.05.79-.79,1.87-1.27,3.06-1.27h32.57c1.2,0,2.28-.48,3.06-1.26.78-.78,1.26-1.86,1.26-3.06,0-2.38-1.93-4.32-4.32-4.32h-14.84c4.43-4.21,8.72-8.5,12.77-12.92,20.38-22.25,24.31-49.41,10.74-63.1-14.41-14.57-43.15-12.8-69.81,4.29-26.28,16.84-43.27,43.87-40.63,65.46,1.87,15.19,4.5,30.02,6.94,44.95.82,5.09,1.72,10.15,2.67,15.37.6,3.31,3.07,5.55,5.92,6.22.6.15,1.21.22,1.83.22h65.52c1.19,0,2.27-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32h-52.95l.02-.02c-2.2-.2-3.92-2.06-3.92-4.3,0-1.19.48-2.27,1.26-3.06.78-.78,1.86-1.26,3.06-1.26h87.28c1.2,0,2.28-.49,3.06-1.27.78-.78,1.26-1.86,1.26-3.05,0-2.39-1.93-4.32-4.32-4.32Zm-78.14-67.05c5-10.73,17.74-19.42,28.47-19.42s15.36,8.69,10.35,19.42c-4.99,10.71-17.74,19.41-28.46,19.41s-15.36-8.7-10.36-19.41Z"/>
    <path class="cls-1" d="m783.39,612.07h-.5c-.46,0-.91-.07-1.33-.22.6.15,1.21.22,1.83.22Z"/>
    <rect class="cls-1" x="888.61" y="577.5" width=".54" height=".93"/>
    <rect class="cls-1" x="888.61" y="577.5" width=".54" height=".93"/>
  </g>
</svg>`;

// Contract content as structured data for React Native
const CONTRACT_SECTIONS = [
  {
    title: "Meezo Restaurant Partner Terms & Conditions (v1.1.0)",
    isHeader: true,
  },
  {
    title: "1. Partnership Agreement",
    content:
      "By accepting these terms, you agree to become an authorized Meezo restaurant partner. Your restaurant will be listed on the Meezo platform and made available to customers for food delivery and pickup services.",
  },
  {
    title: "2. Daily Settlement Schedule",
    content:
      "Meezo will process settlement of each day's completed sales at daily midnight. If settlement is not reflected by 2:00 AM local time, you may contact the assigned manager directly at 0759587979 for escalation and support.",
  },
  {
    title: "3. Halal Compliance",
    content:
      "All food sold through Meezo must comply with halal requirements. You are solely responsible for obtaining, maintaining, and presenting a valid halal certificate and for any legal, regulatory, or customer consequences arising from non-compliance.",
  },
  {
    title: "4. Order Preparation and Handover Priority",
    content:
      "Once an order is accepted, your kitchen must start preparing it immediately in the live queue sequence. For example, if two in-store manual orders are already waiting, an accepted Meezo order must be treated as the third order in sequence and must not be skipped ahead or delayed behind later walk-in orders. When a Meezo delivery partner arrives for pickup, handover must be done at a separate designated pickup point. Delivery partners must not be required to wait in the in-store customer queue.",
  },
  {
    title: "5. Earnings Recognition Point",
    content:
      "The order earning is considered payable to the restaurant once the assigned delivery partner successfully picks up the order from your premises.",
  },
  {
    title: "6. Bank Account and Payout Responsibility",
    content:
      "You authorize Meezo to route all payouts to the bank account provided during onboarding. You are responsible for ensuring that bank details remain accurate and updated. Meezo is not liable for payout delays or failures caused by incorrect bank information submitted by the restaurant.",
  },
  {
    title: "7. Accuracy of Information",
    content:
      "You confirm that all submitted information, including restaurant details, owner information, bank account details, and KYC documents, is accurate and authentic. Any false, expired, or misleading information may result in suspension or account termination.",
  },
  {
    title: "8. Account Verification",
    content:
      "Your account remains in pending status until a Meezo manager reviews and verifies all submitted documents and information. Standard verification timelines are typically 2-5 business days, subject to document quality and regional review load.",
  },
  {
    title: "9. Data and Privacy",
    content:
      "Meezo may collect and store data related to your account, transactions, and customer interactions. Such data is handled according to Meezo privacy and security policies and applicable laws.",
  },
  {
    title: "10. Suspension and Termination",
    content:
      "Meezo may suspend or terminate partner access for material breach of these terms, fraudulent behavior, repeated service failures, or legal non-compliance. Suspended accounts may be restricted from receiving new orders and payouts until resolution.",
  },
  {
    title: "11. Platform Commission",
    content:
      "Meezo may apply a commission margin within a range of 8% to 15% (default 10%), based on city-level and country-level operating conditions unless otherwise notified in writing. This commission will not be deducted from your restaurant sales settlement. The commission is charged externally to the customer as a platform service charge.",
  },
  {
    title: "12. Governing Law",
    content:
      "These terms are governed by the laws of Sri Lanka and you agree to resolve disputes through appropriate legal channels.",
  },
  {
    title: "Last Updated: April 2026",
    isFooter: true,
  },
];

// Step Progress Bar Component
function StepProgress({ currentStep, totalSteps }) {
  const steps = ["Personal", "Restaurant", "Bank", "Contract", "Review"];
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.header}>
        <Text style={progressStyles.stepText}>
          Step {currentStep} of {totalSteps}
        </Text>
        <Text style={progressStyles.percentText}>{percentage}% Complete</Text>
      </View>

      {/* Progress Bar */}
      <View style={progressStyles.barContainer}>
        <View style={[progressStyles.barFill, { width: `${percentage}%` }]} />
      </View>

      {/* Step Indicators */}
      <View style={progressStyles.stepsRow}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View key={i} style={progressStyles.stepItem}>
            <View
              style={[
                progressStyles.stepCircle,
                i + 1 < currentStep && progressStyles.stepCompleted,
                i + 1 === currentStep && progressStyles.stepCurrent,
                i + 1 > currentStep && progressStyles.stepPending,
              ]}
            >
              {i + 1 < currentStep ? (
                <Text style={progressStyles.checkmark}>✓</Text>
              ) : (
                <Text
                  style={[
                    progressStyles.stepNumber,
                    i + 1 === currentStep && progressStyles.stepNumberCurrent,
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={progressStyles.stepLabel}>{steps[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  percentText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#06C168",
  },
  barContainer: {
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#06C168",
    borderRadius: 5,
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCompleted: {
    backgroundColor: "#06C168",
  },
  stepCurrent: {
    backgroundColor: "#06C168",
    borderWidth: 4,
    borderColor: "#9EEBBE",
  },
  stepPending: {
    backgroundColor: "#d1d5db",
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  stepNumberCurrent: {
    color: "#ffffff",
  },
  stepLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
});

export default function Step4() {
  const navigation = useNavigation();

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ipAddress, setIpAddress] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState("");
  const logoFloat = useRef(new Animated.Value(0)).current;

  // Fetch IP address on component mount
  useEffect(() => {
    const getIpAddress = async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        setIpAddress(data.ip);
      } catch (e) {
        console.error("Failed to fetch IP address:", e);
      }
    };
    getIpAddress();

    // Get device info for user agent equivalent
    const deviceString = `${Device.brand || "Unknown"} ${Device.modelName || "Device"} - ${Platform.OS} ${Platform.Version} - Expo ${Constants.expoVersion || "SDK"}`;
    setDeviceInfo(deviceString);

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -6,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const handleSubmit = async () => {
    if (!accepted) {
      Alert.alert("Required", "Please accept the contract to continue");
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_URL}/restaurant-onboarding/step-4`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contractAccepted: true,
          contractVersion: CONTRACT_VERSION,
          ipAddress: ipAddress || null,
          userAgent: deviceInfo,
          acceptedAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data?.message || "Failed to submit contract");
        return;
      }

      // Navigate to pending screen
      navigation.reset({
        index: 0,
        routes: [{ name: "AdminOnboardingPending" }],
      });
    } catch (err) {
      console.error("Step4 submit error", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderContractSection = (section, index) => {
    if (section.isHeader) {
      return (
        <Text key={index} style={styles.contractHeader}>
          {section.title}
        </Text>
      );
    }

    if (section.isFooter) {
      return (
        <Text key={index} style={styles.contractFooter}>
          {section.title}
        </Text>
      );
    }

    return (
      <View key={index} style={styles.contractSection}>
        <Text style={styles.contractTitle}>{section.title}</Text>
        <Text style={styles.contractContent}>{section.content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Background Decorations */}
      <View style={styles.bgDecoration1} />
      <View style={styles.bgDecoration2} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.logoWrap,
              { transform: [{ translateY: logoFloat }] },
            ]}
          >
            <SvgXml xml={MEEZO_LOGO_XML} width={150} height={150} />
          </Animated.View>
          <Text style={styles.headerTitle}>Contract Acceptance</Text>
          <Text style={styles.headerSubtitle}>
            Review and accept the partner terms to finish onboarding
          </Text>
        </View>

        {/* Progress Bar */}
        <StepProgress currentStep={4} totalSteps={5} />

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Contract Content */}
          <View style={styles.contractContainer}>
            <ScrollView
              style={styles.contractScroll}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {CONTRACT_SECTIONS.map(renderContractSection)}
            </ScrollView>
          </View>

          {/* Accept Checkbox */}
          <TouchableOpacity
            style={[
              styles.checkboxContainer,
              accepted && styles.checkboxContainerActive,
            ]}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted && <Text style={styles.checkboxIcon}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              I have read and accept the terms above.
            </Text>
          </TouchableOpacity>

          {/* IP Address Info */}
          {ipAddress && (
            <View style={styles.ipContainer}>
              <Text style={styles.ipIcon}>🔒</Text>
              <Text style={styles.ipText}>
                Submission will be recorded with IP:{" "}
                <Text style={styles.ipAddress}>{ipAddress}</Text>
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!accepted || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!accepted || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.submitButtonText}>Accept & Finish</Text>
                  <Text style={styles.buttonArrow}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06C168",
  },
  bgDecoration1: {
    position: "absolute",
    top: 100,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  bgDecoration2: {
    position: "absolute",
    bottom: 100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 16,
  },
  logoWrap: {
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contractContainer: {
    height: 300,
    borderWidth: 2,
    borderColor: "#dcfce7",
    borderRadius: 12,
    backgroundColor: "#EDFBF2",
    marginBottom: 20,
    overflow: "hidden",
  },
  contractScroll: {
    flex: 1,
    padding: 16,
  },
  contractHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#06C168",
    marginBottom: 16,
    textAlign: "center",
  },
  contractSection: {
    marginBottom: 16,
  },
  contractTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  contractContent: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  contractFooter: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
    textAlign: "center",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDFBF2",
    borderWidth: 2,
    borderColor: "#dcfce7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  checkboxContainerActive: {
    borderColor: "#06C168",
    backgroundColor: "#dcfce7",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#9ca3af",
    borderRadius: 6,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  checkboxChecked: {
    backgroundColor: "#06C168",
    borderColor: "#06C168",
  },
  checkboxIcon: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  ipContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  ipIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  ipText: {
    fontSize: 12,
    color: "#6b7280",
    flex: 1,
  },
  ipAddress: {
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#374151",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  submitButton: {
    flex: 2,
    backgroundColor: "#06C168",
    borderRadius: 999,
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "#34D399",
  },
  buttonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonLoading: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  buttonArrow: {
    fontSize: 18,
    color: "#ffffff",
    marginLeft: 8,
  },
});
