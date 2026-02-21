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
  // Icon mapping matching the design
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
      <View style={styles.iconContent}>
        <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>
          {getIcon()}
        </Text>
        
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

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 32 + insets.bottom,
          left: "4%",
          right: "4%",
          height: 72,
          backgroundColor: "#fff",
          borderRadius: 32,
          borderWidth: 1,
          borderColor: "#F1F5F9",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 25,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
          paddingHorizontal: 24,
          paddingVertical: 16,
          paddingBottom: 16,
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
  iconWrap: { 
    position: "relative",
    alignItems: "center", 
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  iconContent: {
    alignItems: "center",
    gap: 6,
  },
  iconEmoji: { 
    fontSize: 26, 
    color: "#94A3B8",
  },
  iconEmojiActive: { 
    color: "#10b981",
  },
  iconLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  iconLabelActive: { 
    color: "#10b981", 
    fontWeight: "700",
  },
  activeDot: {
    position: "absolute",
    bottom: -16,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10b981",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { 
    color: "#fff", 
    fontSize: 8, 
    fontWeight: "700",
  },
});
