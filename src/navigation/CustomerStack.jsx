import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CheckoutScreen from "../screens/customer/CheckoutScreen";
import OrderTrackingScreen from "../screens/customer/OrderTrackingScreen";
import CustomerTabs from "./CustomerTabs";

const Stack = createNativeStackNavigator();

export default function CustomerStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_bottom" }}
    >
      <Stack.Screen name="MainTabs" component={CustomerTabs} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
    </Stack.Navigator>
  );
}
