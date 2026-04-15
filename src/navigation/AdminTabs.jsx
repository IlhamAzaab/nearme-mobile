import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "../config/env";
import { useSocket } from "../context/SocketContext";
import { getAccessToken } from "../lib/authStorage";
import {
  getAdminOrdersUnseenCount,
  markAdminOrdersSeen,
  syncAdminOrdersUnseenState,
} from "../utils/adminOrdersUnseen";

// Admin Screens
import AdminDashboard from "../screens/admin/AdminDashboard";
import Earnings from "../screens/admin/Earnings";
import Orders from "../screens/admin/Orders";
import Products from "../screens/admin/Products";
import Profile from "../screens/admin/Profile.jsx";

const Tab = createBottomTabNavigator();

const ORDERS_QUERY_KEY = ["admin", "orders", "restaurant"];

async function fetchAdminOrdersForBadge() {
  const token = await getAccessToken();
  if (!token) return [];

  const response = await fetch(`${API_URL}/orders/restaurant/orders`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Failed to fetch orders");
  }

  const data = await response.json().catch(() => ({}));
  return Array.isArray(data?.orders) ? data.orders : [];
}

function TabIcon({ label, focused, badge = 0 }) {
  let iconName = focused ? "home" : "home-outline";

  if (label === "Products") iconName = focused ? "cube" : "cube-outline";
  if (label === "Orders") iconName = focused ? "receipt" : "receipt-outline";
  if (label === "Earnings") iconName = focused ? "cash" : "cash-outline";
  if (label === "Account") iconName = focused ? "person" : "person-outline";

  return (
    <View style={styles.iconWrap}>
      <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
        <Ionicons
          name={iconName}
          size={18}
          color={focused ? "#06C168" : "#98A2B3"}
        />
        {badge > 0 ? (
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function AdminTabs() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { on, off } = useSocket();
  const [userId, setUserId] = useState("default");
  const [ordersUnseenCount, setOrdersUnseenCount] = useState(0);
  const [isOrdersTabFocused, setIsOrdersTabFocused] = useState(false);

  const refreshOrdersBadgeCount = useCallback(() => {
    setOrdersUnseenCount(getAdminOrdersUnseenCount(userId));
  }, [userId]);

  const { data: adminOrders = [] } = useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: fetchAdminOrdersForBadge,
    staleTime: 30 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
  });

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
    syncAdminOrdersUnseenState(userId, adminOrders);
    if (isOrdersTabFocused) {
      markAdminOrdersSeen(userId);
    }
    refreshOrdersBadgeCount();
  }, [adminOrders, isOrdersTabFocused, refreshOrdersBadgeCount, userId]);

  useEffect(() => {
    if (!on || !off) return;

    const handleNewOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    };

    on("order:new_order", handleNewOrderEvent);

    return () => {
      off("order:new_order", handleNewOrderEvent);
    };
  }, [off, on, queryClient]);

  const handleOrdersTabFocused = useCallback(() => {
    setIsOrdersTabFocused(true);
    markAdminOrdersSeen(userId);
    setOrdersUnseenCount(0);
  }, [userId]);

  const handleOrdersTabBlurred = useCallback(() => {
    setIsOrdersTabFocused(false);
  }, []);

  const ordersTabBadgeCount = useMemo(
    () => ordersUnseenCount,
    [ordersUnseenCount],
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarHideOnKeyboard: true,
        animation: "fade",
        sceneStyle: {
          backgroundColor: "#f8fafc",
        },
        tabBarStyle: {
          ...styles.tabBar,
          height: 64 + Math.max(insets.bottom - 4, 4),
          paddingBottom: Math.max(insets.bottom - 4, 4),
        },
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tab.Screen
        name="Home"
        component={AdminDashboard}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={Orders}
        listeners={{
          focus: handleOrdersTabFocused,
          blur: handleOrdersTabBlurred,
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label="Orders"
              focused={focused}
              badge={focused ? 0 : ordersTabBadgeCount}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Products"
        component={Products}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Products" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={Earnings}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Earnings" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={Profile}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Account" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: "#fff",
  },
  tabBarItem: {
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconCircleActive: {
    backgroundColor: "#EAF9F0",
  },
  badgeWrap: {
    position: "absolute",
    top: -4,
    right: -8,
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
  iconLabel: {
    marginTop: 2,
    fontSize: 11,
    color: "#98A2B3",
    fontWeight: "600",
  },
  iconLabelActive: { color: "#06C168", fontWeight: "700" },
});
