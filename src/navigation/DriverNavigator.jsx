import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvailableDeliveriesScreen from "../screens/driver/AvailableDeliveriesScreen";
import DashboardScreen from "../screens/driver/DashboardScreen";
import DeliveryHistoryScreen from "../screens/driver/DeliveryHistoryScreen";
import DriverDepositsScreen from "../screens/driver/DriverDepositsScreen";
import DriverEarningsScreen from "../screens/driver/DriverEarningsScreen";
import DriverMapScreen from "../screens/driver/DriverMapScreen";
import DriverNotificationsScreen from "../screens/driver/DriverNotificationsScreen";
import DriverPendingScreen from "../screens/driver/DriverPendingScreen";
import DriverAccountProfileScreen from "../screens/driver/DriverAccountProfileScreen";
import DriverProfileScreen from "../screens/driver/DriverProfileScreen";
import DriverWithdrawalsScreen from "../screens/driver/DriverWithdrawalsScreen";
import WebViewScreen from "../screens/common/WebViewScreen";
import OnboardingStep1Screen from "../screens/driver/onboarding/OnboardingStep1Screen";
import OnboardingStep2Screen from "../screens/driver/onboarding/OnboardingStep2Screen";
import OnboardingStep3Screen from "../screens/driver/onboarding/OnboardingStep3Screen";
import OnboardingStep4Screen from "../screens/driver/onboarding/OnboardingStep4Screen";
import OnboardingStep5Screen from "../screens/driver/onboarding/OnboardingStep5Screen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab icon component
function TabIcon({ label, focused }) {
  const getIconName = () => {
    switch (label) {
      case "Home":
        return "home";
      case "Available":
        return "list";
      case "Active":
        return "location";
      case "Earnings":
        return "wallet";
      case "Payment":
        return "card";
      default:
        return "location";
    }
  };

  return (
    <View style={styles.tabIconContainer}>
      <Ionicons
        name={getIconName()}
        size={25}
        color={focused ? "#06C168" : "#9ca3af"}
        style={styles.tabIcon}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </View>
  );
}

function DriverTabs() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    ...styles.tabBar,
    height: 62 + Math.max(insets.bottom, 8),
    paddingTop: 8,
    paddingBottom: Math.max(insets.bottom, 8),
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#06C168",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle,
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
            <TabIcon label="Available" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Active"
        component={DashboardScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Match web behavior: Active tab should open DriverMap directly.
            e.preventDefault();
            navigation.navigate("DriverMap");
          },
        })}
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
      <Tab.Screen
        name="Payment"
        component={PaymentStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Payment" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Payment Stack for Withdrawals and Deposits
function PaymentStack() {
  return (
    <Stack.Navigator
      initialRouteName="DriverDepositsMain"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="DriverDepositsMain"
        component={DriverDepositsScreen}
      />
      <Stack.Screen
        name="DriverWithdrawalsMain"
        component={DriverWithdrawalsScreen}
      />
    </Stack.Navigator>
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
      <Stack.Screen
        name="DriverAccountProfile"
        component={DriverAccountProfileScreen}
      />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
      <Stack.Screen name="WebView" component={WebViewScreen} />
      <Stack.Screen
        name="DriverWithdrawals"
        component={DriverWithdrawalsScreen}
      />
      <Stack.Screen name="DriverDeposits" component={DriverDepositsScreen} />
      <Stack.Screen name="DriverPending" component={DriverPendingScreen} />
      <Stack.Screen
        name="DriverOnboardingStep1"
        component={OnboardingStep1Screen}
      />
      <Stack.Screen
        name="DriverOnboardingStep2"
        component={OnboardingStep2Screen}
      />
      <Stack.Screen
        name="DriverOnboardingStep3"
        component={OnboardingStep3Screen}
      />
      <Stack.Screen
        name="DriverOnboardingStep4"
        component={OnboardingStep4Screen}
      />
      <Stack.Screen
        name="DriverOnboardingStep5"
        component={OnboardingStep5Screen}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 70,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tabIconContainer: {
    width: 65,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabIcon: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  tabLabelFocused: {
    color: "#06C168",
    fontWeight: "700",
  },
});
