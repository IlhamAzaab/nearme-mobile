import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/auth/LoginScreen";
import SignupScreen from "../screens/auth/SignupScreen";
import VerifyEmailScreen from "../screens/auth/VerifyEmailScreen";
import CompleteProfileScreen from "../screens/auth/CompleteProfileScreen";
import VerifyOtpScreen from "../screens/auth/VerifyOtpScreen";
import WebViewScreen from "../screens/common/WebViewScreen";

const Stack = createNativeStackNavigator();

export default function AuthNavigator({
  initialRouteName = "Login",
  initialRouteParams = null,
}) {
  const verifyOtpInitialParams =
    initialRouteName === "VerifyOtp" ? initialRouteParams : undefined;
  const completeProfileInitialParams =
    initialRouteName === "CompleteProfile" ? initialRouteParams : undefined;

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen
        name="CompleteProfile"
        component={CompleteProfileScreen}
        initialParams={completeProfileInitialParams}
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
      <Stack.Screen
        name="VerifyOtp"
        component={VerifyOtpScreen}
        initialParams={verifyOtpInitialParams}
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
      <Stack.Screen name="WebView" component={WebViewScreen} />
    </Stack.Navigator>
  );
}
