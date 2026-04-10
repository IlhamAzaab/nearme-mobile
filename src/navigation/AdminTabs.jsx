import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Admin Screens
import AdminDashboard from "../screens/admin/AdminDashboard";
import Earnings from "../screens/admin/Earnings";
import Orders from "../screens/admin/Orders";
import Products from "../screens/admin/Products";
import Profile from "../screens/admin/Profile.jsx";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  let iconName = "home-outline";

  if (label === "Products") iconName = "cube-outline";
  if (label === "Orders") iconName = "receipt-outline";
  if (label === "Earnings") iconName = "cash-outline";
  if (label === "Account") iconName = "person-outline";

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={iconName}
        size={18}
        color={focused ? "#06C168" : "#98A2B3"}
      />
      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function AdminTabs() {
  const insets = useSafeAreaInsets();

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
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Orders" focused={focused} />
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
  },
  iconWrap: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 2,
  },
  iconWrapActive: {
    backgroundColor: "#EAF9F0",
  },
  iconLabel: {
    marginTop: 2,
    fontSize: 11,
    color: "#98A2B3",
    fontWeight: "600",
  },
  iconLabelActive: { color: "#06C168", fontWeight: "700" },
});
