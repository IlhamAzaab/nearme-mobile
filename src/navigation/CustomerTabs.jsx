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
  // Clean icon mapping matching the design
  const getIcon = () => {
    switch (label) {
      case "HOME":
        return "🏠";
      case "ORDER":
        return "📋";
      case "CART":
        return "🛒";
      case "PROFILE":
        return "👤";
      default:
        return "⚫";
    }
  };

  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>
        {getIcon()}
      </Text>
      
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
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom + 8,
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
            <TabIcon label="CART" focused={focused} badge={3} />
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
  tabBar: {
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 5,
  },
  iconWrap: { 
    width: 70, 
    alignItems: "center", 
    justifyContent: "center",
    gap: 4,
  },
  iconEmoji: { 
    fontSize: 24, 
    color: "#9CA3AF",
  },
  iconEmojiActive: { 
    color: "#10b981",
  },
  iconLabel: {
    marginTop: 2,
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  iconLabelActive: { 
    color: "#10b981", 
    fontWeight: "700",
  },

  badge: {
    position: "absolute",
    top: -4,
    right: 12,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { 
    color: "#fff", 
    fontSize: 11, 
    fontWeight: "700",
  },
});
