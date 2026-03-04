import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_URL } from "../../config/env";

export default function DriverPendingScreen({ navigation }) {
  const { logout } = useAuth();
  const [driverStatus, setDriverStatus] = useState("pending");
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.driver) {
        setDriverStatus(data.driver.driver_status);
        if (
          data.driver.driver_status === "active" &&
          data.driver.onboarding_completed
        ) {
          navigation.replace("DriverTabs");
          return;
        }
        if (!data.driver.onboarding_completed) {
          const step = data.driver.onboarding_step || 1;
          navigation.replace(`DriverOnboardingStep${step}`);
          return;
        }
      }
    } catch (e) {
      console.error("Status check error:", e);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    checkStatus();
    // Poll every 60 seconds (was 30s) - pending screen doesn't need fast polling
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleLogout = async () => {
    await logout();
  };

  const getStatusInfo = () => {
    switch (driverStatus) {
      case "pending":
        return {
          icon: "",
          title: "Application Under Review",
          message: "Your application is being reviewed by our team",
          color: "#92400e",
          bgColor: "#fffbeb",
          borderColor: "#fde68a",
          details: [
            "Our verification team is reviewing your documents",
            "This process typically takes 24-48 hours",
            "You will receive a notification once your account is activated",
            "Make sure to check your spam folder for emails",
          ],
        };
      case "rejected":
        return {
          icon: "",
          title: "Application Rejected",
          message: "Unfortunately, your application was not approved",
          color: "#991b1b",
          bgColor: "#fef2f2",
          borderColor: "#fecaca",
          details: [
            "Please check your email for rejection reasons",
            "You can reapply after addressing the issues",
            "Contact support for more information",
          ],
        };
      case "suspended":
        return {
          icon: "",
          title: "Account Suspended",
          message: "Your driver account has been temporarily suspended",
          color: "#991b1b",
          bgColor: "#fef2f2",
          borderColor: "#fecaca",
          details: [
            "Please contact support for more information",
            "Email: support@nearme.lk",
            "Phone: +94 11 234 5678",
          ],
        };
      default:
        return {
          icon: "",
          title: "Verification Pending",
          message: "Please wait while we process your application",
          color: "#92400e",
          bgColor: "#fffbeb",
          borderColor: "#fde68a",
          details: [],
        };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1db95b" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
          <Text style={styles.title}>{statusInfo.title}</Text>
          <Text style={styles.message}>{statusInfo.message}</Text>

          {statusInfo.details.length > 0 && (
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: statusInfo.bgColor,
                  borderColor: statusInfo.borderColor,
                },
              ]}
            >
              {statusInfo.details.map((detail, index) => (
                <View key={index} style={styles.detailRow}>
                  <Text
                    style={[styles.detailBullet, { color: statusInfo.color }]}
                  ></Text>
                  <Text
                    style={[styles.detailText, { color: statusInfo.color }]}
                  >
                    {detail}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {driverStatus === "pending" && (
            <View style={styles.timelineSection}>
              <Text style={styles.timelineTitle}>Verification Process</Text>
              {[
                {
                  num: "",
                  title: "Application Submitted",
                  sub: "Your onboarding is complete",
                  done: true,
                },
                {
                  num: "2",
                  title: "Document Verification",
                  sub: "Checking all submitted documents",
                  active: true,
                },
                {
                  num: "3",
                  title: "Background Check",
                  sub: "Pending document approval",
                  done: false,
                },
                {
                  num: "4",
                  title: "Final Approval",
                  sub: "Account activation",
                  done: false,
                },
              ].map((step, idx) => (
                <View key={idx} style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelineNum,
                      step.done
                        ? styles.timelineNumDone
                        : step.active
                          ? styles.timelineNumActive
                          : styles.timelineNumPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timelineNumText,
                        (step.done || step.active) && { color: "#fff" },
                        !step.done && !step.active && { color: "#9ca3af" },
                      ]}
                    >
                      {step.num}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.timelineItemTitle,
                        !step.done && !step.active && { color: "#9ca3af" },
                      ]}
                    >
                      {step.title}
                    </Text>
                    <Text
                      style={[
                        styles.timelineItemSub,
                        !step.done && !step.active && { color: "#d1d5db" },
                      ]}
                    >
                      {step.sub}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Need Help?</Text>
            <Text style={styles.supportSubtitle}>
              Contact our support team for assistance:
            </Text>
            <Text style={styles.supportInfo}> Email: support@nearme.lk</Text>
            <Text style={styles.supportInfo}> Phone: +94 11 234 5678</Text>
            <Text style={styles.supportInfo}> Hours: Mon-Fri, 9 AM - 6 PM</Text>
          </View>

          <View style={styles.actions}>
            {driverStatus === "pending" && (
              <TouchableOpacity style={styles.primaryBtn} onPress={checkStatus}>
                <Text style={styles.primaryBtnText}>Refresh Status</Text>
              </TouchableOpacity>
            )}
            {driverStatus === "rejected" && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate("DriverOnboardingStep1")}
              >
                <Text style={styles.primaryBtnText}>Update Application</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleLogout}
            >
              <Text style={styles.secondaryBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 20, paddingVertical: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statusIcon: { fontSize: 64, textAlign: "center", marginBottom: 16 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: { flexDirection: "row", marginBottom: 8, gap: 8 },
  detailBullet: { fontSize: 14, fontWeight: "700", marginTop: 1 },
  detailText: { fontSize: 14, lineHeight: 20, flex: 1 },
  timelineSection: { marginBottom: 24 },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  timelineNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineNumDone: { backgroundColor: "#22c55e" },
  timelineNumActive: { backgroundColor: "#eab308" },
  timelineNumPending: { backgroundColor: "#e5e7eb" },
  timelineNumText: { fontSize: 13, fontWeight: "700" },
  timelineItemTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  timelineItemSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  supportCard: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  supportSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  supportInfo: { fontSize: 13, color: "#374151", marginBottom: 4 },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#374151", fontSize: 15, fontWeight: "700" },
});
