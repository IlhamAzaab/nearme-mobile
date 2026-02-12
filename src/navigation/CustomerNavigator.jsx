import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet } from "react-native";

// ✅ உங்கள் existing screens import பண்ணு
import HomeScreen from "../screens/customer/HomeScreen";
import CartScreen from "../screens/customer/CartScreen";
import OrdersScreen from "../screens/customer/OrdersScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused, badge }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>
        {label === "Home" ? "🏠" : label === "Cart" ? "🛒" : label === "Orders" ? "🧾" : "👤"}
      </Text>

      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>{label}</Text>

      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function CustomerTabs({ cartCount = 0 }) {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Cart" focused={focused} badge={cartCount} />,
        }}
      />

      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Orders" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 72,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: "#fff",
  },
  iconWrap: { width: 70, alignItems: "center", justifyContent: "center" },
  iconEmoji: { fontSize: 20, opacity: 0.7 },
  iconEmojiActive: { opacity: 1 },
  iconLabel: { marginTop: 4, fontSize: 11, color: "#9CA3AF", fontWeight: "800" },
  iconLabelActive: { color: "#FF7A00" },

  badge: {
    position: "absolute",
    top: -2,
    right: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: "#FF7A00",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});