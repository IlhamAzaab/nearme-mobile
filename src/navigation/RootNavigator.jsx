import React, { useState, useEffect } from "react";
import AuthNavigator from "./AuthNavigator";
import CustomerStack from "./CustomerStack";
import DriverNavigator from "./DriverNavigator";
import ManagerNavigator from "./ManagerNavigator";
import AdminNavigator from "./AdminNavigator";
import SplashScreen from "../screens/SplashScreen";
import { useAuth } from "../app/providers/AuthProvider";

const SPLASH_MIN_MS = 900; // shorter splash for faster startup on low-end devices

export default function RootNavigator() {
  const { isAuthenticated, userRole, isLoading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Show splash while auth is loading OR minimum time hasn't elapsed
  if (isLoading || !splashDone) {
    return <SplashScreen />;
  }

  // Handle routing based on authentication and user role
  if (isAuthenticated) {
    switch (userRole) {
      case "customer":
        return <CustomerStack />;
      case "driver":
        return <DriverNavigator />;
      case "manager":
        return <ManagerNavigator />;
      case "admin":
        return <AdminNavigator />;
      default:
        // If role is unknown but authenticated, default to Auth or a generic error
        return <AuthNavigator />;
    }
  }

  // Otherwise show Auth screens
  return <AuthNavigator />;
}
