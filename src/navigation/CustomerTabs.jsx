import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";

// Tab Screens
import CartScreen from "../screens/customer/CartScreen";
import HomeScreen from "../screens/customer/HomeScreen";
import OrdersScreen from "../screens/customer/OrdersScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused, badge }) {
  // Modern icon mapping
  const getIconName = () => {
    switch (label) {
      case "HOME":
        return focused ? "home" : "home-outline";
      case "ORDER":
        return focused ? "receipt" : "receipt-outline";
      case "CART":
        return focused ? "cart" : "cart-outline";
      case "PROFILE":
        return focused ? "person-circle" : "person-circle-outline";
      default:
        return "ellipse";
    }
  };

  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconContent}>
        <Ionicons 
          name={getIconName()} 
          size={24} 
          color={focused ? "#10b981" : "#94A3B8"} 
        />
        
        <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>
          {label}
        </Text>
      </View>

      {/* Active indicator dot */}
      {focused && <View style={styles.activeDot} />}

      {/* Badge for cart */}
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function CustomerTabs() {
  const insets = useSafeAreaInsets();
  const [cartBadge, setCartBadge] = useState(0);

  // Fetch real cart count silently whenever any tab is focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const token = await AsyncStorage.getItem("token");
          if (!token || token === "null") return;
          const res = await fetch(`${API_BASE_URL}/cart`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            const carts = data.carts || [];
            const count = carts.reduce(
              (sum, cart) => sum + (cart.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
              0
            );
            setCartBadge(count);
          }
        } catch {}
      })();
    }, [])
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Math.max(insets.bottom, 4),
          left: 12,
          right: 12,
          height: 68,
          backgroundColor: "#fff",
          borderRadius: 24,
          borderWidth: 0.5,
          borderColor: "#E2E8F0",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -2 },
          elevation: 10,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom > 0 ? 8 : 12, 8),
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="HOME" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="ORDER" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="CART" focused={focused} badge={cartBadge} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="PROFILE" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { 
    position: "relative",
    alignItems: "center", 
    justifyContent: "center",
    paddingHorizontal: 4,
    flex: 1,
  },
  iconContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  iconLabelActive: { 
    color: "#10b981", 
    fontWeight: "700",
  },
  activeDot: {
    position: "absolute",
    bottom: -10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10b981",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { 
    color: "#fff", 
    fontSize: 9, 
    fontWeight: "700",
  },
});
