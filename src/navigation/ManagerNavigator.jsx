import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Main Screens
import ManagerAccountScreen from "../screens/manager/ManagerAccountScreen";
import ManagerDashboardScreen from "../screens/manager/ManagerDashboardScreen";
import ManagerDepositsScreen from "../screens/manager/ManagerDepositsScreen";
import ManagerEarningsScreen from "../screens/manager/ManagerEarningsScreen";
import ManagerReportsScreen from "../screens/manager/ManagerReportsScreen";

// Sub Screens
import OperationsConfigScreen from "../screens/manager/OperationsConfigScreen";
import PendingDeliveriesScreen from "../screens/manager/PendingDeliveriesScreen";
import VerifyDepositScreen from "../screens/manager/VerifyDepositScreen";

// Driver Screens
import AddDriverScreen from "../screens/manager/drivers/AddDriverScreen";
import DriverManagementScreen from "../screens/manager/drivers/DriverManagementScreen";
import DriverPaymentsScreen from "../screens/manager/drivers/DriverPaymentsScreen";
import DriverVerificationScreen from "../screens/manager/drivers/DriverVerificationScreen";
import ProcessDriverPaymentScreen from "../screens/manager/drivers/ProcessDriverPaymentScreen";

// Restaurant Screens
import AddAdminScreen from "../screens/manager/restaurants/AddAdminScreen";
import AdminManagementScreen from "../screens/manager/restaurants/AdminManagementScreen";
import AdminPaymentsScreen from "../screens/manager/restaurants/AdminPaymentsScreen";
import PendingRestaurantsScreen from "../screens/manager/restaurants/PendingRestaurantsScreen";
import ProcessAdminPaymentScreen from "../screens/manager/restaurants/ProcessAdminPaymentScreen";
import RestaurantManagementScreen from "../screens/manager/restaurants/RestaurantManagementScreen";

// Report Screens
import CustomerReportsScreen from "../screens/manager/reports/CustomerReportsScreen";
import DeliveryReportsScreen from "../screens/manager/reports/DeliveryReportsScreen";
import FinancialReportsScreen from "../screens/manager/reports/FinancialReportsScreen";
import RestaurantReportsScreen from "../screens/manager/reports/RestaurantReportsScreen";
import SalesReportsScreen from "../screens/manager/reports/SalesReportsScreen";
import TimeAnalyticsScreen from "../screens/manager/reports/TimeAnalyticsScreen";

const Tab = createBottomTabNavigator();
const HomeStackNav = createNativeStackNavigator();
const DriversStackNav = createNativeStackNavigator();
const AdminsStackNav = createNativeStackNavigator();
const EarningsStackNav = createNativeStackNavigator();
const ReportsStackNav = createNativeStackNavigator();

const screenOptions = { headerShown: false };

/* ─── Per-Tab Stack Navigators ─── */

function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={screenOptions}>
      <HomeStackNav.Screen
        name="ManagerDashboard"
        component={ManagerDashboardScreen}
      />
      <HomeStackNav.Screen
        name="ManagerAccount"
        component={ManagerAccountScreen}
      />
    </HomeStackNav.Navigator>
  );
}

function DriversStack() {
  return (
    <DriversStackNav.Navigator screenOptions={screenOptions}>
      <DriversStackNav.Screen
        name="ManagerDeposits"
        component={ManagerDepositsScreen}
      />
      <DriversStackNav.Screen
        name="DriverManagement"
        component={DriverManagementScreen}
      />
      <DriversStackNav.Screen
        name="DriverVerification"
        component={DriverVerificationScreen}
      />
      <DriversStackNav.Screen
        name="DriverPayments"
        component={DriverPaymentsScreen}
      />
      <DriversStackNav.Screen name="AddDriver" component={AddDriverScreen} />
      <DriversStackNav.Screen
        name="ProcessDriverPayment"
        component={ProcessDriverPaymentScreen}
      />
      <DriversStackNav.Screen
        name="VerifyDeposit"
        component={VerifyDepositScreen}
      />
      <DriversStackNav.Screen
        name="ManagerAccount"
        component={ManagerAccountScreen}
      />
    </DriversStackNav.Navigator>
  );
}

function AdminsStack() {
  return (
    <AdminsStackNav.Navigator screenOptions={screenOptions}>
      <AdminsStackNav.Screen
        name="AdminPayments"
        component={AdminPaymentsScreen}
      />
      <AdminsStackNav.Screen
        name="RestaurantManagement"
        component={RestaurantManagementScreen}
      />
      <AdminsStackNav.Screen name="AddAdmin" component={AddAdminScreen} />
      <AdminsStackNav.Screen
        name="AdminManagement"
        component={AdminManagementScreen}
      />
      <AdminsStackNav.Screen
        name="ProcessAdminPayment"
        component={ProcessAdminPaymentScreen}
      />
      <AdminsStackNav.Screen
        name="PendingRestaurants"
        component={PendingRestaurantsScreen}
      />
      <AdminsStackNav.Screen
        name="ManagerAccount"
        component={ManagerAccountScreen}
      />
    </AdminsStackNav.Navigator>
  );
}

function EarningsStack() {
  return (
    <EarningsStackNav.Navigator screenOptions={screenOptions}>
      <EarningsStackNav.Screen
        name="ManagerEarnings"
        component={ManagerEarningsScreen}
      />
      <EarningsStackNav.Screen
        name="ManagerAccount"
        component={ManagerAccountScreen}
      />
    </EarningsStackNav.Navigator>
  );
}

function ReportsStack() {
  return (
    <ReportsStackNav.Navigator screenOptions={screenOptions}>
      <ReportsStackNav.Screen
        name="ManagerReports"
        component={ManagerReportsScreen}
      />
      <ReportsStackNav.Screen
        name="SalesReports"
        component={SalesReportsScreen}
      />
      <ReportsStackNav.Screen
        name="DeliveryReports"
        component={DeliveryReportsScreen}
      />
      <ReportsStackNav.Screen
        name="RestaurantReports"
        component={RestaurantReportsScreen}
      />
      <ReportsStackNav.Screen
        name="FinancialReports"
        component={FinancialReportsScreen}
      />
      <ReportsStackNav.Screen
        name="CustomerReports"
        component={CustomerReportsScreen}
      />
      <ReportsStackNav.Screen
        name="TimeAnalytics"
        component={TimeAnalyticsScreen}
      />
      <ReportsStackNav.Screen
        name="OperationsConfig"
        component={OperationsConfigScreen}
      />
      <ReportsStackNav.Screen
        name="PendingDeliveries"
        component={PendingDeliveriesScreen}
      />
      <ReportsStackNav.Screen
        name="ManagerAccount"
        component={ManagerAccountScreen}
      />
    </ReportsStackNav.Navigator>
  );
}

/* ─── Bottom Tabs ─── */

export default function ManagerNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 4,
          },
        ],
        tabBarActiveTintColor: "#06C168",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === "Home")
            iconName = focused ? "home" : "home-outline";
          else if (route.name === "Drivers")
            iconName = focused ? "car-sport" : "car-sport-outline";
          else if (route.name === "Admins")
            iconName = focused ? "business" : "business-outline";
          else if (route.name === "Earnings")
            iconName = focused ? "cash" : "cash-outline";
          else if (route.name === "Reports")
            iconName = focused ? "bar-chart" : "bar-chart-outline";
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Drivers" component={DriversStack} />
      <Tab.Screen name="Admins" component={AdminsStack} />
      <Tab.Screen name="Earnings" component={EarningsStack} />
      <Tab.Screen name="Reports" component={ReportsStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
});
