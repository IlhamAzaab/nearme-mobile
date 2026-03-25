import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CartScreen from "../screens/customer/CartScreen";
import FoodDetailScreen from "../screens/customer/FoodDetailScreen";
import HomeScreen from "../screens/customer/HomeScreen";
import NotificationsScreen from "../screens/customer/NotificationsScreen";
import OrderTrackingScreen from "../screens/customer/OrderTrackingScreen";
import OrdersScreen from "../screens/customer/OrdersScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";
import EditProfileScreen from "../screens/customer/EditProfileScreen";
import AddressPickerScreen from "../screens/customer/AddressPickerScreen";
import FavouritesScreen from "../screens/customer/FavouritesScreen";
import RestaurantFoodsScreen from "../screens/customer/RestaurantFoodsScreen";
import WebViewScreen from "../screens/common/WebViewScreen";

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();
const CartStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

/* ── Nested stacks so the tab bar stays visible on all screens ── */

function HomeStackScreen() {
  return (
    <HomeStack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_bottom" }}
    >
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen
        name="RestaurantFoods"
        component={RestaurantFoodsScreen}
      />
      <HomeStack.Screen name="FoodDetail" component={FoodDetailScreen} />
      <HomeStack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
    </HomeStack.Navigator>
  );
}

function OrdersStackScreen() {
  return (
    <OrdersStack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_bottom" }}
    >
      <OrdersStack.Screen name="OrdersMain" component={OrdersScreen} />
      <OrdersStack.Screen
        name="RestaurantFoods"
        component={RestaurantFoodsScreen}
      />
      <OrdersStack.Screen name="FoodDetail" component={FoodDetailScreen} />
      <OrdersStack.Screen
        name="OrderTracking"
        component={OrderTrackingScreen}
      />
      <OrdersStack.Screen
        name="Notifications"
        component={NotificationsScreen}
      />
    </OrdersStack.Navigator>
  );
}

function CartStackScreen() {
  return (
    <CartStack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_bottom" }}
    >
      <CartStack.Screen name="CartMain" component={CartScreen} />
      <CartStack.Screen
        name="RestaurantFoods"
        component={RestaurantFoodsScreen}
      />
      <CartStack.Screen name="FoodDetail" component={FoodDetailScreen} />
      <CartStack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <CartStack.Screen name="Notifications" component={NotificationsScreen} />
    </CartStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_bottom" }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="AddressPicker" component={AddressPickerScreen} />
      <ProfileStack.Screen name="Favourites" component={FavouritesScreen} />
      <ProfileStack.Screen name="WebView" component={WebViewScreen} />
    </ProfileStack.Navigator>
  );
}

function TabIcon({ label, iconName, focused }) {
  return (
    <View style={styles.tabIconContainer}>
      <Ionicons
        name={iconName}
        size={24}
        color={focused ? "#06C168" : "#9ca3af"}
        style={styles.tabIcon}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </View>
  );
}

export default function CustomerTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#06C168",
        tabBarInactiveTintColor: "#9ca3af",
        animation: "fade",
        tabBarStyle: {
          ...styles.tabBar,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label="Home"
              iconName={focused ? "home" : "home-outline"}
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersStackScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label="Orders"
              iconName={focused ? "receipt" : "receipt-outline"}
              focused={focused}
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Reset OrdersStack to root when tab is pressed,
            // so stale screens like OrderTracking are cleared
            navigation.navigate("Orders", { screen: "OrdersMain" });
          },
        })}
      />
      <Tab.Screen
        name="Cart"
        component={CartStackScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label="Cart"
              iconName={focused ? "cart" : "cart-outline"}
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label="Profile"
              iconName={focused ? "person" : "person-outline"}
              focused={focused}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
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
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
  },
  tabLabelFocused: {
    color: "#06C168",
    fontWeight: "700",
  },
});
