import React, { useEffect, useRef, useState } from "react";
import AuthNavigator from "./AuthNavigator";
import CustomerStack from "./CustomerStack";
import DriverNavigator from "./DriverNavigator";
import ManagerNavigator from "./ManagerNavigator";
import AdminNavigator from "./AdminNavigator";
import SplashScreen from "../screens/SplashScreen";
import { useAuth } from "../app/providers/AuthProvider";
import { API_BASE_URL } from "../constants/api";
import { fetchJsonWithCache } from "../lib/publicDataCache";
import { startBackgroundCacheRefresher } from "../services/CacheRefresher";
import {
  getCachedFoodItems,
  getCachedRestaurants,
  preloadAllAppImages,
} from "../services/ImagePreloader";

const SPLASH_MIN_MS = 900; // shorter splash for faster startup on low-end devices
const RESTAURANTS_CACHE_KEY = "public:restaurants";
const FOODS_CACHE_KEY = "public:foods";

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
  const cacheRefreshCleanupRef = useRef(null);

  const [showSplash, setShowSplash] = useState(true);
  const [customerImagePreloadReady, setCustomerImagePreloadReady] =
    useState(true);
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
    if (!isAuthenticated || effectiveRole !== "customer") {
      didPreloadCustomerImagesRef.current = false;
      setCustomerImagePreloadReady(true);

      if (cacheRefreshCleanupRef.current) {
        cacheRefreshCleanupRef.current();
        cacheRefreshCleanupRef.current = null;
      }

      return;
    }
    if (didPreloadCustomerImagesRef.current) return;

    didPreloadCustomerImagesRef.current = true;
    setCustomerImagePreloadReady(false);

    let cancelled = false;
    (async () => {
      try {
        const [restaurantsPayload, foodsPayload] = await Promise.all([
          fetchJsonWithCache(
            RESTAURANTS_CACHE_KEY,
            async () => {
              const res = await fetch(`${API_BASE_URL}/public/restaurants`);
              return res.json().catch(() => ({}));
            },
            { ttlMs: 180000 },
          ),
          fetchJsonWithCache(
            FOODS_CACHE_KEY,
            async () => {
              const res = await fetch(`${API_BASE_URL}/public/foods`);
              return res.json().catch(() => ({}));
            },
            { ttlMs: 180000 },
          ),
        ]);

        if (cancelled) return;

        const restaurants =
          restaurantsPayload?.restaurants ||
          restaurantsPayload?.data?.restaurants ||
          [];
        const foods = foodsPayload?.foods || foodsPayload?.data?.foods || [];

        await preloadAllAppImages(restaurants, foods);

        if (!cacheRefreshCleanupRef.current) {
          cacheRefreshCleanupRef.current = startBackgroundCacheRefresher(
            getCachedRestaurants,
            getCachedFoodItems,
          );
        }
      } catch (error) {
        console.warn(
          "[RootNavigator] Customer image preload failed:",
          error?.message || error,
        );
      } finally {
        if (!cancelled) {
          setCustomerImagePreloadReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, effectiveRole]);

  useEffect(() => {
    return () => {
      if (cacheRefreshCleanupRef.current) {
        cacheRefreshCleanupRef.current();
      }
    };
  }, []);

  const shouldHoldForCustomerImageWarmup =
    isAuthenticated &&
    effectiveRole === "customer" &&
    !customerImagePreloadReady;

  if (
    isLoading ||
    (showSplash && !skipSplashOnAuth) ||
    (isAuthenticated && authTransitionMode === "post-login") ||
    shouldHoldForCustomerImageWarmup
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
