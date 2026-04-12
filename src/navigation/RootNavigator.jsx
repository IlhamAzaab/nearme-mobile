import React, { useEffect, useRef, useState } from "react";
import AuthNavigator from "./AuthNavigator";
import CustomerStack from "./CustomerStack";
import DriverNavigator from "./DriverNavigator";
import ManagerNavigator from "./ManagerNavigator";
import AdminNavigator from "./AdminNavigator";
import SplashScreen from "../screens/SplashScreen";
import { useAuth } from "../app/providers/AuthProvider";
import { API_BASE_URL } from "../constants/api";
import { preloadAllAppImages } from "../services/ImagePreloader";

const SPLASH_MIN_MS = 900; // shorter splash for faster startup on low-end devices

export default function RootNavigator() {
  const {
    isAuthenticated,
    userRole,
    isLoading,
    authTransitionMode,
    authInitialRoute,
    skipSplashOnAuth,
    clearAuthTransitionMode,
  } = useAuth();
  const didPreloadCustomerImagesRef = useRef(false);

  const [showSplash, setShowSplash] = useState(true);
  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const effectiveRole =
    normalizedRole === "user"
      ? "customer"
      : normalizedRole === "restaurant_admin"
        ? "admin"
        : normalizedRole;

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || authTransitionMode !== "post-login") return;

    const timer = setTimeout(() => {
      clearAuthTransitionMode();
    }, SPLASH_MIN_MS);

    return () => clearTimeout(timer);
  }, [isAuthenticated, authTransitionMode, clearAuthTransitionMode]);

  useEffect(() => {
    if (!isAuthenticated || effectiveRole !== "customer") return;
    if (didPreloadCustomerImagesRef.current) return;

    didPreloadCustomerImagesRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const [restaurantsRes, foodsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/public/restaurants`),
          fetch(`${API_BASE_URL}/public/foods`),
        ]);

        const [restaurantsPayload, foodsPayload] = await Promise.all([
          restaurantsRes.json().catch(() => ({})),
          foodsRes.json().catch(() => ({})),
        ]);

        if (cancelled) return;

        const restaurants =
          restaurantsPayload?.restaurants ||
          restaurantsPayload?.data?.restaurants ||
          [];
        const foods = foodsPayload?.foods || foodsPayload?.data?.foods || [];

        await preloadAllAppImages(restaurants, foods);
      } catch (error) {
        console.warn(
          "[RootNavigator] Customer image preload failed:",
          error?.message || error,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, effectiveRole]);

  if (
    isLoading ||
    (showSplash && !skipSplashOnAuth) ||
    (isAuthenticated && authTransitionMode === "post-login")
  ) {
    return <SplashScreen />;
  }

  // Handle routing based on authentication and user role
  if (isAuthenticated) {
    switch (effectiveRole) {
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
        return <AuthNavigator initialRouteName={authInitialRoute} />;
    }
  }

  // Otherwise show Auth screens
  return <AuthNavigator initialRouteName={authInitialRoute} />;
}
