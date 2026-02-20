import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActiveDeliveriesScreen from "../screens/driver/ActiveDeliveriesScreen";
import AvailableDeliveriesScreen from "../screens/driver/AvailableDeliveriesScreen";
import DashboardScreen from "../screens/driver/DashboardScreen";
import DeliveryHistoryScreen from "../screens/driver/DeliveryHistoryScreen";
import DriverEarningsScreen from "../screens/driver/DriverEarningsScreen";
import DriverMapScreen from "../screens/driver/DriverMapScreen";
import DriverNotificationsScreen from "../screens/driver/DriverNotificationsScreen";
import DriverProfileScreen from "../screens/driver/DriverProfileScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab icon component
function TabIcon({ label, focused }) {
  const getIcon = () => {
    switch (label) {
      case "Home":
        return "🏠";
      case "Find":
        return "🔍";
      case "Active":
        return "🚗";
      case "Earnings":
        return "💰";
      default:
        return "📍";
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
    </View>
  );
}

function DriverTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
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
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Find" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Active"
        component={ActiveDeliveriesScreen}
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
    </Tab.Navigator>
  );
}

export default function DriverNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs" component={DriverTabs} />
      <Stack.Screen name="DriverMap" component={DriverMapScreen} />
      <Stack.Screen
        name="DriverNotifications"
        component={DriverNotificationsScreen}
      />
      <Stack.Screen name="History" component={DeliveryHistoryScreen} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: "#fff",
  },
  iconWrap: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: {
    fontSize: 22,
    opacity: 0.6,
  },
  iconEmojiActive: {
    opacity: 1,
  },
  iconLabel: {
    marginTop: 4,
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "700",
  },
  iconLabelActive: {
    color: "#10b981",
  },
});
