import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommonActions } from "@react-navigation/native";
import { SvgXml } from "react-native-svg";
import { useAuth } from "../../app/providers/AuthProvider";
import { NEARME_LOGO_ARTBOARD5_XML } from "../../assets/NearMeLogoArtboard5Xml";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

export default function DriverPendingScreen({ navigation }) {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [driverStatus, setDriverStatus] = useState("pending");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const activeRedirectTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [token, role] = await Promise.all([
        getAccessToken(),
        AsyncStorage.getItem("role"),
      ]);

      if (!mounted) return;
      if (!token || role !== "driver") {
        navigation.replace("Login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigation]);

  const statusQuery = useQuery({
    queryKey: ["driver", "onboarding", "status"],
    enabled: isFocused,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    initialData: () =>
      queryClient.getQueryData(["driver", "onboarding", "status"]),
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      const res = await fetch(`${API_URL}/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok || !data?.driver) {
        throw new Error(data?.message || "Failed to load onboarding status");
      }

      return data.driver;
    },
  });

  useEffect(() => {
    if (initialLoading && (statusQuery.data || statusQuery.error)) {
      setInitialLoading(false);
    }
  }, [statusQuery.data, statusQuery.error, initialLoading]);

  useEffect(() => {
    const driver = statusQuery.data;
    if (!driver) return;

    setDriverStatus(driver.driver_status || "pending");
    setLastChecked(new Date());

    if (!driver.onboarding_completed) {
      const step = driver.onboarding_step || 1;
      navigation.replace(`DriverOnboardingStep${step}`);
      return;
    }

    const normalizedStatus = String(driver.driver_status || "").toLowerCase();
    if (normalizedStatus === "active") {
      if (activeRedirectTimerRef.current) {
        clearTimeout(activeRedirectTimerRef.current);
      }
      activeRedirectTimerRef.current = setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "DriverTabs" }],
          }),
        );
      }, 1500);
    }

    return () => {
      if (activeRedirectTimerRef.current) {
        clearTimeout(activeRedirectTimerRef.current);
      }
    };
  }, [statusQuery.data, navigation]);

  const checkStatus = async () => {
    setRefreshing(true);
    try {
      await statusQuery.refetch();
    } catch (e) {
      Alert.alert("Error", "Failed to check status. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const getStatusMessage = () => {
    switch (driverStatus) {
      case "pending":
        return "Your application is under review. We'll notify you once approved.";
      case "suspended":
        return "Your account has been suspended. Please contact support.";
      case "rejected":
        return "Your application was rejected. Please contact support for more information.";
      default:
        return "Your application is under review. We'll notify you once approved.";
    }
  };

  const getStatusEmoji = () => {
    switch (driverStatus) {
      case "pending":
        return "⏳";
      case "suspended":
        return "🚫";
      case "rejected":
        return "❌";
      default:
        return "⏳";
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#06C168" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DriverScreenSection
        screenKey="DriverPending"
        sectionIndex={0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || statusQuery.isFetching}
              onRefresh={checkStatus}
              colors={["#06C168"]}
              tintColor="#06C168"
            />
          }
        >
          <View style={styles.content}>
            <View style={styles.logoWrap}>
              <SvgXml
                xml={NEARME_LOGO_ARTBOARD5_XML}
                width={150}
                height={150}
              />
            </View>
            <Text style={styles.title}>
              {driverStatus === "pending"
                ? "Approval Pending"
                : driverStatus === "suspended"
                  ? "Account Suspended"
                  : driverStatus === "rejected"
                    ? "Application Rejected"
                    : "Approval Pending"}
            </Text>
            <Text
              style={styles.subtitle}
            >{`${getStatusEmoji()} ${getStatusMessage()}`}</Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What happens next?</Text>
              <Text style={styles.infoStep}>
                1. Our team reviews your details
              </Text>
              <Text style={styles.infoStep}>2. We verify your documents</Text>
              <Text style={styles.infoStep}>
                3. You'll receive a notification when approved
              </Text>
              <Text style={styles.infoStep}>
                4. Start delivering with Meezo
              </Text>
            </View>

            <View style={styles.supportCard}>
              <Text style={styles.supportTitle}>Need Help?</Text>
              <Text style={styles.supportSubtitle}>
                Email: support.meezo.lk
              </Text>
              <Text style={styles.supportSubtitle}>Phone: 0759587979</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.refreshBtn,
                (refreshing || statusQuery.isFetching) &&
                  styles.refreshBtnDisabled,
              ]}
              onPress={checkStatus}
              disabled={refreshing || statusQuery.isFetching}
            >
              {refreshing || statusQuery.isFetching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.refreshBtnText}>Check Status</Text>
              )}
            </TouchableOpacity>

            {lastChecked && (
              <Text style={styles.lastChecked}>
                Last checked: {lastChecked.toLocaleTimeString()}
              </Text>
            )}

            <Text style={styles.pullHint}>Pull down to refresh</Text>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </DriverScreenSection>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EDFBF2",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  logoWrap: {
    marginBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 12,
  },
  infoStep: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    paddingLeft: 4,
  },
  supportCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginBottom: 24,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 8,
  },
  supportSubtitle: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
  },
  refreshBtn: {
    backgroundColor: "#06C168",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 160,
    alignItems: "center",
  },
  refreshBtnDisabled: {
    opacity: 0.7,
  },
  refreshBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  lastChecked: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 12,
  },
  pullHint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 8,
  },
  logoutBtn: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  logoutBtnText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
});
