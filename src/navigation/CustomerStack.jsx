import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import CheckoutScreen from "../screens/customer/CheckoutScreen";
import OrderTrackingScreen from "../screens/customer/OrderTrackingScreen";
import PlacingOrderScreen from "../screens/customer/PlacingOrderScreen";
import OrderReceivedScreen from "../screens/customer/OrderReceivedScreen";
import DriverAcceptedScreen from "../screens/customer/DriverAcceptedScreen";
import OrderPickedUpScreen from "../screens/customer/OrderPickedUpScreen";
import OrderOnTheWayScreen from "../screens/customer/OrderOnTheWayScreen";
import OrderDeliveredScreen from "../screens/customer/OrderDeliveredScreen";
import AddressPickerScreen from "../screens/customer/AddressPickerScreen";
import CustomerTabs from "./CustomerTabs";
import wrapCustomerScreen from "./wrapCustomerScreen";

const Stack = createNativeStackNavigator();

const CustomerTabsAnimated = wrapCustomerScreen(CustomerTabs);
const CheckoutScreenAnimated = wrapCustomerScreen(CheckoutScreen);
const PlacingOrderScreenAnimated = wrapCustomerScreen(PlacingOrderScreen);
const OrderReceivedScreenAnimated = wrapCustomerScreen(OrderReceivedScreen);
const DriverAcceptedScreenAnimated = wrapCustomerScreen(DriverAcceptedScreen);
const OrderPickedUpScreenAnimated = wrapCustomerScreen(OrderPickedUpScreen);
const OrderOnTheWayScreenAnimated = wrapCustomerScreen(OrderOnTheWayScreen);
const OrderDeliveredScreenAnimated = wrapCustomerScreen(OrderDeliveredScreen);
const OrderTrackingScreenAnimated = wrapCustomerScreen(OrderTrackingScreen);
const AddressPickerScreenAnimated = wrapCustomerScreen(AddressPickerScreen);

const customerRootStackScreenOptions = {
  headerShown: false,
  animation: "slide_from_bottom",
  animationDuration: Platform.OS === "ios" ? 250 : 140,
  animationMatchesGesture: true,
  fullScreenGestureEnabled: true,
  gestureEnabled: true,
};

export default function CustomerStack() {
  return (
    <Stack.Navigator screenOptions={customerRootStackScreenOptions}>
      <Stack.Screen name="MainTabs" component={CustomerTabsAnimated} />
      <Stack.Screen name="Checkout" component={CheckoutScreenAnimated} />
      <Stack.Screen
        name="PlacingOrder"
        component={PlacingOrderScreenAnimated}
      />
      <Stack.Screen
        name="OrderReceived"
        component={OrderReceivedScreenAnimated}
      />
      <Stack.Screen
        name="DriverAccepted"
        component={DriverAcceptedScreenAnimated}
      />
      <Stack.Screen
        name="OrderPickedUp"
        component={OrderPickedUpScreenAnimated}
      />
      <Stack.Screen
        name="OrderOnTheWay"
        component={OrderOnTheWayScreenAnimated}
      />
      <Stack.Screen
        name="OrderDelivered"
        component={OrderDeliveredScreenAnimated}
      />
      <Stack.Screen
        name="OrderTracking"
        component={OrderTrackingScreenAnimated}
      />
      <Stack.Screen
        name="AddressPicker"
        component={AddressPickerScreenAnimated}
      />
    </Stack.Navigator>
  );
}
