import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Tab Screens
import CartScreen from "../screens/customer/CartScreen";
import HomeScreen from "../screens/customer/HomeScreen";
import OrdersScreen from "../screens/customer/OrdersScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused, badge }) {
  // Modern icon mapping
  const getIcon = () => {
    switch (label) {
      case "Home":
        return focused ? "🏡" : "🏠";
      case "Orders":
        return focused ? "📋" : "📄";
      case "Cart":
        return focused ? "🛍️" : "🛒";
      case "Profile":
        return focused ? "👨" : "👤";
      default:
        return "⚫";
    }
  };

  return (
    <View style={styles.iconWrap}>
      <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
        <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>
          {getIcon()}
        </Text>
      </View>

      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>
        {label}
      </Text>

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

  return (
    <Tab.Navigator
      initialRouteName="Home"
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
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Home" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Orders" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Cart" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
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
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  iconWrap: { width: 70, alignItems: "center", justifyContent: "center" },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconContainerActive: {
    backgroundColor: "#ECFDF5",
  },
  iconEmoji: { fontSize: 22, opacity: 0.6 },
  iconEmojiActive: { opacity: 1 },
  iconLabel: {
    marginTop: 2,
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "700",
  },
  iconLabelActive: { color: "#10b981", fontWeight: "800" },

  badge: {
    position: "absolute",
    top: -2,
    right: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
