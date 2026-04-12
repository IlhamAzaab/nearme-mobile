import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CartScreen from "../screens/customer/CartScreen";
import FoodDetailScreen from "../screens/customer/FoodDetailScreen";
import HomeScreen from "../screens/customer/HomeScreen";
import NotificationsScreen from "../screens/customer/NotificationsScreen";
import PlacingOrderScreen from "../screens/customer/PlacingOrderScreen";
import OrderReceivedScreen from "../screens/customer/OrderReceivedScreen";
import DriverAcceptedScreen from "../screens/customer/DriverAcceptedScreen";
import OrderPickedUpScreen from "../screens/customer/OrderPickedUpScreen";
import OrderOnTheWayScreen from "../screens/customer/OrderOnTheWayScreen";
import OrderDeliveredScreen from "../screens/customer/OrderDeliveredScreen";
import OrderTrackingScreen from "../screens/customer/OrderTrackingScreen";
import OrdersScreen from "../screens/customer/OrdersScreen";
import PastOrderDetailsScreen from "../screens/customer/PastOrderDetailsScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";
import EditProfileScreen from "../screens/customer/EditProfileScreen";
import AddressPickerScreen from "../screens/customer/AddressPickerScreen";
import FavouritesScreen from "../screens/customer/FavouritesScreen";
import RestaurantFoodsScreen from "../screens/customer/RestaurantFoodsScreen";
import WebViewScreen from "../screens/common/WebViewScreen";
import { API_BASE_URL } from "../constants/api";
import { getAccessToken } from "../lib/authStorage";
import wrapCustomerScreen from "./wrapCustomerScreen";

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();
const CartStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const HomeScreenAnimated = wrapCustomerScreen(HomeScreen);
const CartScreenAnimated = wrapCustomerScreen(CartScreen);
const OrdersScreenAnimated = wrapCustomerScreen(OrdersScreen);
const ProfileScreenAnimated = wrapCustomerScreen(ProfileScreen);
const RestaurantFoodsScreenAnimated = wrapCustomerScreen(RestaurantFoodsScreen);
const FoodDetailScreenAnimated = wrapCustomerScreen(FoodDetailScreen);
const OrderTrackingScreenAnimated = wrapCustomerScreen(OrderTrackingScreen);
const PlacingOrderScreenAnimated = wrapCustomerScreen(PlacingOrderScreen);
const OrderReceivedScreenAnimated = wrapCustomerScreen(OrderReceivedScreen);
const DriverAcceptedScreenAnimated = wrapCustomerScreen(DriverAcceptedScreen);
const OrderPickedUpScreenAnimated = wrapCustomerScreen(OrderPickedUpScreen);
const OrderOnTheWayScreenAnimated = wrapCustomerScreen(OrderOnTheWayScreen);
const OrderDeliveredScreenAnimated = wrapCustomerScreen(OrderDeliveredScreen);
const PastOrderDetailsScreenAnimated = wrapCustomerScreen(
  PastOrderDetailsScreen,
);
const NotificationsScreenAnimated = wrapCustomerScreen(NotificationsScreen);
const EditProfileScreenAnimated = wrapCustomerScreen(EditProfileScreen);
const AddressPickerScreenAnimated = wrapCustomerScreen(AddressPickerScreen);
const FavouritesScreenAnimated = wrapCustomerScreen(FavouritesScreen);
const WebViewScreenAnimated = wrapCustomerScreen(WebViewScreen);

const customerStackScreenOptions = {
  headerShown: false,
  animation: "slide_from_bottom",
  animationDuration: 50,
  animationMatchesGesture: true,
  fullScreenGestureEnabled: true,
  gestureEnabled: true,
};

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={customerStackScreenOptions}>
      <HomeStack.Screen name="HomeMain" component={HomeScreenAnimated} />
      <HomeStack.Screen
        name="RestaurantFoods"
        component={RestaurantFoodsScreenAnimated}
      />
      <HomeStack.Screen
        name="FoodDetail"
        component={FoodDetailScreenAnimated}
      />
      <HomeStack.Screen
        name="OrderTracking"
        component={OrderTrackingScreenAnimated}
      />
      <HomeStack.Screen
        name="PlacingOrder"
        component={PlacingOrderScreenAnimated}
      />
      <HomeStack.Screen
        name="OrderReceived"
        component={OrderReceivedScreenAnimated}
      />
      <HomeStack.Screen
        name="DriverAccepted"
        component={DriverAcceptedScreenAnimated}
      />
      <HomeStack.Screen
        name="OrderPickedUp"
        component={OrderPickedUpScreenAnimated}
      />
      <HomeStack.Screen
        name="OrderOnTheWay"
        component={OrderOnTheWayScreenAnimated}
      />
      <HomeStack.Screen
        name="OrderDelivered"
        component={OrderDeliveredScreenAnimated}
      />
      <HomeStack.Screen
        name="Notifications"
        component={NotificationsScreenAnimated}
      />
    </HomeStack.Navigator>
  );
}

function OrdersStackScreen() {
  return (
    <OrdersStack.Navigator screenOptions={customerStackScreenOptions}>
      <OrdersStack.Screen name="OrdersMain" component={OrdersScreenAnimated} />
      <OrdersStack.Screen
        name="RestaurantFoods"
        component={RestaurantFoodsScreenAnimated}
      />
      <OrdersStack.Screen
        name="FoodDetail"
        component={FoodDetailScreenAnimated}
      />
      <OrdersStack.Screen
        name="OrderTracking"
        component={OrderTrackingScreenAnimated}
      />
      <OrdersStack.Screen
        name="Notifications"
        component={NotificationsScreenAnimated}
      />
      <OrdersStack.Screen
        name="PlacingOrder"
        component={PlacingOrderScreenAnimated}
      />
      <OrdersStack.Screen
        name="OrderReceived"
        component={OrderReceivedScreenAnimated}
      />
      <OrdersStack.Screen
        name="DriverAccepted"
        component={DriverAcceptedScreenAnimated}
      />
      <OrdersStack.Screen
        name="OrderPickedUp"
        component={OrderPickedUpScreenAnimated}
      />
      <OrdersStack.Screen
        name="OrderOnTheWay"
        component={OrderOnTheWayScreenAnimated}
      />
      <OrdersStack.Screen
        name="OrderDelivered"
        component={OrderDeliveredScreenAnimated}
      />
      <OrdersStack.Screen
        name="PastOrderDetails"
        component={PastOrderDetailsScreenAnimated}
      />
    </OrdersStack.Navigator>
  );
}

function CartStackScreen() {
  return (
    <CartStack.Navigator screenOptions={customerStackScreenOptions}>
      <CartStack.Screen name="CartMain" component={CartScreenAnimated} />
      <CartStack.Screen
        name="RestaurantFoods"
        component={RestaurantFoodsScreenAnimated}
      />
      <CartStack.Screen
        name="FoodDetail"
        component={FoodDetailScreenAnimated}
      />
      <CartStack.Screen
        name="OrderTracking"
        component={OrderTrackingScreenAnimated}
      />
      <CartStack.Screen
        name="PlacingOrder"
        component={PlacingOrderScreenAnimated}
      />
      <CartStack.Screen
        name="OrderReceived"
        component={OrderReceivedScreenAnimated}
      />
      <CartStack.Screen
        name="DriverAccepted"
        component={DriverAcceptedScreenAnimated}
      />
      <CartStack.Screen
        name="OrderPickedUp"
        component={OrderPickedUpScreenAnimated}
      />
      <CartStack.Screen
        name="OrderOnTheWay"
        component={OrderOnTheWayScreenAnimated}
      />
      <CartStack.Screen
        name="OrderDelivered"
        component={OrderDeliveredScreenAnimated}
      />
      <CartStack.Screen
        name="Notifications"
        component={NotificationsScreenAnimated}
      />
    </CartStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={customerStackScreenOptions}>
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreenAnimated}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreenAnimated}
      />
      <ProfileStack.Screen
        name="AddressPicker"
        component={AddressPickerScreenAnimated}
      />
      <ProfileStack.Screen
        name="Favourites"
        component={FavouritesScreenAnimated}
      />
      <ProfileStack.Screen name="WebView" component={WebViewScreenAnimated} />
    </ProfileStack.Navigator>
  );
}

function TabIcon({ iconName, label, focused, badge = 0 }) {
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
        <Ionicons
          name={iconName}
          size={22}
          color={focused ? "#111827" : "#1f2937"}
          style={styles.tabIcon}
        />
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </View>
  );
}

function UberEatsTabBar({ state, descriptors, navigation, insets }) {
  const routes = state.routes;

  const renderRouteButton = (route, index) => {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const { options } = descriptors[route.key];
    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: "tabLongPress",
        target: route.key,
      });
    };

    const icon =
      options.tabBarIcon?.({
        focused: isFocused,
        color: isFocused ? "#111827" : "#1f2937",
        size: 22,
      }) ?? null;

    return (
      <Pressable
        key={`${route.key}-${index}`}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabButtonPressable}
      >
        {icon}
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.tabShell,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
      pointerEvents="box-none"
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(255,255,255,0)",
          "rgba(255,255,255,0.58)",
          "rgba(255,255,255,0.9)",
          "#FFFFFF",
        ]}
        locations={[0, 0.48, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.2 }}
        style={styles.tabShellGradient}
      />
      <View style={styles.tabBarContainer}>
        {routes.map(renderRouteButton)}
      </View>
    </View>
  );
}

export default function CustomerTabs() {
  const insets = useSafeAreaInsets();
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const [token, role] = await Promise.all([
        getAccessToken(),
        AsyncStorage.getItem("role"),
      ]);

      if (!token || role !== "customer") {
        setCartCount(0);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCartCount(0);
        return;
      }

      const total = (data.carts || []).reduce(
        (sum, cart) =>
          sum +
          (cart.items || []).reduce((s, item) => s + (item.quantity || 0), 0),
        0,
      );
      setCartCount(total);
    } catch {
      // Keep existing badge if request fails.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCartCount();
    }, [fetchCartCount]),
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("cart:changed", () => {
      fetchCartCount();
    });

    return () => subscription.remove();
  }, [fetchCartCount]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        animation: "fade",
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <UberEatsTabBar {...props} insets={insets} />}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon iconName="home-outline" label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersStackScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              iconName="receipt-outline"
              label="Orders"
              focused={focused}
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
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
              iconName="cart-outline"
              label="Cart"
              focused={focused}
              badge={cartCount}
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
              iconName="person-outline"
              label="Account"
              focused={focused}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    backgroundColor: "#transparent",
    paddingHorizontal: 10,
    paddingTop: 0,
    position: "relative",
  },
  tabShellGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 170,
  },
  tabBarContainer: {
    minHeight: 50,
    borderRadius: 0,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
  },
  tabButtonPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
  },
  tabIconContainer: {
    width: 62,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1,
  },
  tabIcon: {
    marginBottom: 0,
  },
  tabIconWrap: {
    position: "relative",
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  tabIconWrapFocused: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  tabLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "600",
    lineHeight: 14,
  },
  tabLabelFocused: {
    color: "#111827",
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
