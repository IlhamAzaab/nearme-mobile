import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Admin Screens
import AdminDashboard from "../screens/admin/AdminDashboard";
import Orders from "../screens/admin/Orders";
import Products from "../screens/admin/Products";
import Profile from "../screens/admin/Profile";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  let emoji = "📊";
  if (label === "Orders") emoji = "📦";
  if (label === "Products") emoji = "🍽️";
  if (label === "Profile") emoji = "👤";

  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>
        {emoji}
      </Text>
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
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          ...styles.tabBar,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboard}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Dashboard" focused={focused} />
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
        name="Profile"
        component={Profile}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Profile" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: "#fff",
  },
  iconWrap: { width: 70, alignItems: "center", justifyContent: "center" },
  iconEmoji: { fontSize: 20, opacity: 0.7 },
  iconEmojiActive: { opacity: 1 },
  iconLabel: {
    marginTop: 4,
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "800",
  },
  iconLabelActive: { color: "#22c55e" },
});
