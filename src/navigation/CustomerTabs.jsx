import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/customer/HomeScreen";
import OrdersScreen from "../screens/customer/OrdersScreen";
import CartScreen from "../screens/customer/CartScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";

const Tab = createBottomTabNavigator();

const ACCENT = "#F59E0B";
const GREEN = "#10b981";

function MyTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const bottomSpace = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.wrapper, { bottom: bottomSpace }]}>
      <View style={styles.container}>

        <RoundButton
          label="HOME"
          icon="home-outline"
          activeIcon="home"
          focused={state.index === 0}
          onPress={() => navigation.navigate("Home")}
        />

        <RoundButton
          label="ORDERS"
          icon="receipt-outline"
          activeIcon="receipt"
          focused={state.index === 1}
          onPress={() => navigation.navigate("Orders")}
        />

        <RoundButton
          label="CART"
          icon="cart-outline"
          activeIcon="cart"
          focused={state.index === 2}
          onPress={() => navigation.navigate("Cart")}
        />

        <RoundButton
          label="PROFILE"
          icon="person-outline"
          activeIcon="person"
          focused={state.index === 3}
          onPress={() => navigation.navigate("Profile")}
        />

      </View>
    </View>
  );
}

function RoundButton({ label, icon, activeIcon, focused, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.roundWrapper}>
      <View style={[styles.roundButton, focused && styles.roundActive]}>
        <Ionicons
          name={focused ? activeIcon : icon}
          size={22}
          color={focused ? ACCENT : "#1E293B"}
        />
      </View>

      <Text style={[styles.label, focused && styles.activeLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <MyTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 20,
    right: 20,
  },

  container: {
    height: 90,
    backgroundColor: GREEN,
    borderRadius: 45,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    elevation: 15,
  },

  roundWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  roundButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  roundActive: {
    borderWidth: 3,
    borderColor: ACCENT,
  },

  label: {
    marginTop: 6,
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },

  activeLabel: {
    color: ACCENT,
  },
});