import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDriverDeliveryNotifications } from "../context/DriverDeliveryNotificationContext";
import AvailableDeliveriesScreen from "../screens/driver/AvailableDeliveriesScreen";
import DashboardScreen from "../screens/driver/DashboardScreen";
import DeliveryHistoryScreen from "../screens/driver/DeliveryHistoryScreen";
import DriverDepositsScreen from "../screens/driver/DriverDepositsScreen";
import DriverEarningsScreen from "../screens/driver/DriverEarningsScreen";
import DriverMapScreen from "../screens/driver/DriverMapScreen";
import DriverNotificationsScreen from "../screens/driver/DriverNotificationsScreen";
import DriverPendingScreen from "../screens/driver/DriverPendingScreen";
import DriverAccountProfileScreen from "../screens/driver/DriverAccountProfileScreen";
import DriverBankDetailsScreen from "../screens/driver/DriverBankDetailsScreen";
import DriverContractScreen from "../screens/driver/DriverContractScreen";
import DriverDocumentsScreen from "../screens/driver/DriverDocumentsScreen";
import DriverPersonalInfoScreen from "../screens/driver/DriverPersonalInfoScreen";
import DriverProfileScreen from "../screens/driver/DriverProfileScreen";
import DriverVehicleDetailsScreen from "../screens/driver/DriverVehicleDetailsScreen";
import DriverWithdrawalsScreen from "../screens/driver/DriverWithdrawalsScreen";
import DriverLiveLocationSync from "../components/driver/DriverLiveLocationSync";
import WebViewScreen from "../screens/common/WebViewScreen";
import OnboardingStep1Screen from "../screens/driver/onboarding/OnboardingStep1Screen";
import OnboardingStep2Screen from "../screens/driver/onboarding/OnboardingStep2Screen";
import OnboardingStep3Screen from "../screens/driver/onboarding/OnboardingStep3Screen";
import OnboardingStep4Screen from "../screens/driver/onboarding/OnboardingStep4Screen";
import OnboardingStep5Screen from "../screens/driver/onboarding/OnboardingStep5Screen";
import {
  getDriverAvailableUnseenCount,
  markDriverAvailableDeliveriesSeen,
  syncDriverAvailableUnseenState,
} from "../utils/driverAvailableUnseen";
import { fetchDriverActiveDeliveries } from "../services/driverActiveDeliveriesService";
import { getAccessToken } from "../lib/authStorage";
import { API_URL } from "../config/env";
import { useAuth } from "../app/providers/AuthProvider";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DriverLoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#06C168" />
    </View>
  );
}

function getInitialRoute(driverData) {
  if (!driverData) {
    return "DriverTabs";
  }

  const {
    force_password_change,
    onboarding_completed,
    onboarding_step,
    driver_status,
  } = driverData;

  if (force_password_change) {
    return "DriverProfile";
  }

  if (!onboarding_completed) {
    const step = Math.min(Math.max(onboarding_step || 1, 1), 5);
    return `DriverOnboardingStep${step}`;
  }

  const normalizedStatus = String(driver_status || "").toLowerCase();
  if (
    normalizedStatus === "pending" ||
    normalizedStatus === "suspended" ||
    normalizedStatus === "rejected"
  ) {
    return "DriverPending";
  }

  return "DriverTabs";
}

// Tab icon component
function TabIcon({ label, focused, badge = 0 }) {
  const getIconName = () => {
    switch (label) {
      case "Home":
        return "home";
      case "Available":
        return "list";
      case "Active":
        return "location";
      case "Earnings":
        return "wallet";
      case "Payment":
        return "card";
      default:
        return "location";
    }
  };

  return (
    <View style={styles.tabIconContainer}>
      <View style={styles.tabIconWrap}>
        <Ionicons
          name={getIconName()}
          size={25}
          color={focused ? "#06C168" : "#9ca3af"}
          style={styles.tabIcon}
        />
        {badge > 0 ? (
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </View>
  );
}

function DriverTabs() {
  const insets = useSafeAreaInsets();
  const { notifications } = useDriverDeliveryNotifications();
  const [userId, setUserId] = useState("default");
  const [availableBadgeCount, setAvailableBadgeCount] = useState(0);
  const [isAvailableTabFocused, setIsAvailableTabFocused] = useState(false);

  const guardAvailableTabAccess = useCallback(async (navigation) => {
    const token = await getAccessToken();
    if (!token) return false;

    const result = await fetchDriverActiveDeliveries(token, {
      ttlMs: 15000,
      includeStaleOnError: true,
    });
    if (!result.ok && !result.fromCache) return false;

    const activeDeliveries = Array.isArray(result.deliveries)
      ? result.deliveries
      : [];

    const restrictedDelivery = activeDeliveries.find((delivery) => {
      const normalizedStatus = String(delivery?.status || "")
        .trim()
        .toLowerCase();
      return ["picked_up", "on_the_way", "at_customer"].includes(
        normalizedStatus,
      );
    });

    if (!restrictedDelivery) {
      return false;
    }

    Alert.alert("Unavailable", "Complete your picked up delivery first.");

    navigation.navigate("DriverMap", {
      deliveryId: restrictedDelivery?.delivery_id || restrictedDelivery?.id,
    });
    return true;
  }, []);

  const refreshAvailableBadge = useCallback(() => {
    setAvailableBadgeCount(getDriverAvailableUnseenCount(userId));
  }, [userId]);

  const deliveryNotificationIds = useMemo(() => {
    const ids = [];
    const seen = new Set();

    for (const notification of notifications || []) {
      if (!notification?.delivery_id) continue;
      if (notification?.type === "delivery_milestone") continue;
      const normalizedId = String(notification.delivery_id);
      if (seen.has(normalizedId)) continue;
      seen.add(normalizedId);
      ids.push(normalizedId);
    }

    return ids;
  }, [notifications]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const storedUserId = (await AsyncStorage.getItem("userId")) || "default";
      if (mounted) {
        setUserId(storedUserId);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    syncDriverAvailableUnseenState(userId, deliveryNotificationIds);
    if (isAvailableTabFocused) {
      markDriverAvailableDeliveriesSeen(userId);
    }
    refreshAvailableBadge();
  }, [
    deliveryNotificationIds,
    isAvailableTabFocused,
    refreshAvailableBadge,
    userId,
  ]);

  const handleAvailableTabFocused = useCallback(() => {
    setIsAvailableTabFocused(true);
    markDriverAvailableDeliveriesSeen(userId);
    setAvailableBadgeCount(0);
  }, [userId]);

  const handleAvailableTabBlurred = useCallback(() => {
    setIsAvailableTabFocused(false);
  }, []);

  const tabBarStyle = {
    ...styles.tabBar,
    height: 62 + Math.max(insets.bottom, 8),
    paddingTop: 8,
    paddingBottom: Math.max(insets.bottom, 8),
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#06C168",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Available"
        component={AvailableDeliveriesScreen}
        listeners={({ navigation }) => ({
          tabPress: async (e) => {
            const blocked = await guardAvailableTabAccess(navigation);
            if (blocked) {
              e.preventDefault();
              return;
            }

            handleAvailableTabFocused();
          },
          focus: handleAvailableTabFocused,
          blur: handleAvailableTabBlurred,
        })}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label="Available"
              focused={focused}
              badge={focused ? 0 : availableBadgeCount}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Active"
        component={DashboardScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Match web behavior: Active tab should open DriverMap directly.
            e.preventDefault();
            navigation.navigate("DriverMap");
          },
        })}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Active" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={DriverEarningsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Earnings" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Payment"
        component={PaymentStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Payment" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Payment Stack for Withdrawals and Deposits
function PaymentStack() {
  return (
    <Stack.Navigator
      initialRouteName="DriverDepositsMain"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="DriverDepositsMain"
        component={DriverDepositsScreen}
      />
      <Stack.Screen
        name="DriverWithdrawalsMain"
        component={DriverWithdrawalsScreen}
      />
    </Stack.Navigator>
  );
}

export default function DriverNavigator() {
  const { logout } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const checkDriverStatus = async () => {
      setIsChecking(true);
      const [token, role] = await Promise.all([
        getAccessToken(),
        AsyncStorage.getItem("role"),
      ]);

      if (!mounted) return;

      if (!token || role !== "driver") {
        setInitialRoute("DriverTabs");
        setIsChecking(false);
        return;
      }

      try {
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${API_URL}/onboarding/status`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status === 401 || res.status === 403) {
          await logout();
          return;
        }

        if (!res.ok) {
          setInitialRoute("DriverTabs");
          return;
        }

        const data = await res.json();
        const route = getInitialRoute(data?.driver);
        setInitialRoute(route);
      } catch (error) {
        if (!mounted) return;
        setInitialRoute("DriverTabs");
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    checkDriverStatus();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [logout]);

  if (isChecking || !initialRoute) {
    return <DriverLoadingScreen />;
  }

  return (
    <>
      <DriverLiveLocationSync />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Stack.Screen name="DriverTabs" component={DriverTabs} />
        <Stack.Screen name="DriverMap" component={DriverMapScreen} />
        <Stack.Screen
          name="DriverNotifications"
          component={DriverNotificationsScreen}
        />
        <Stack.Screen name="History" component={DeliveryHistoryScreen} />
        <Stack.Screen
          name="DriverAccountProfile"
          component={DriverAccountProfileScreen}
        />
        <Stack.Screen
          name="DriverPersonalInfo"
          component={DriverPersonalInfoScreen}
        />
        <Stack.Screen
          name="DriverVehicleDetails"
          component={DriverVehicleDetailsScreen}
        />
        <Stack.Screen
          name="DriverBankDetails"
          component={DriverBankDetailsScreen}
        />
        <Stack.Screen
          name="DriverDocuments"
          component={DriverDocumentsScreen}
        />
        <Stack.Screen name="DriverContract" component={DriverContractScreen} />
        <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
        <Stack.Screen name="WebView" component={WebViewScreen} />
        <Stack.Screen
          name="DriverWithdrawals"
          component={DriverWithdrawalsScreen}
        />
        <Stack.Screen name="DriverDeposits" component={DriverDepositsScreen} />
        <Stack.Screen name="DriverPending" component={DriverPendingScreen} />
        <Stack.Screen
          name="DriverOnboardingStep1"
          component={OnboardingStep1Screen}
        />
        <Stack.Screen
          name="DriverOnboardingStep2"
          component={OnboardingStep2Screen}
        />
        <Stack.Screen
          name="DriverOnboardingStep3"
          component={OnboardingStep3Screen}
        />
        <Stack.Screen
          name="DriverOnboardingStep4"
          component={OnboardingStep4Screen}
        />
        <Stack.Screen
          name="DriverOnboardingStep5"
          component={OnboardingStep5Screen}
        />
      </Stack.Navigator>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06C168",
  },
  tabBar: {
    height: 70,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tabIconContainer: {
    width: 65,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabIconWrap: {
    position: "relative",
  },
  tabIcon: {
    marginBottom: 4,
  },
  badgeWrap: {
    position: "absolute",
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: "#06C168",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
  tabLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  tabLabelFocused: {
    color: "#06C168",
    fontWeight: "700",
  },
});
