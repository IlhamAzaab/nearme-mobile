import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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

const RESTAURANTS_CACHE_KEY = "public:restaurants";
const FOODS_CACHE_KEY = "public:foods";

export default function RootNavigator() {
  const {
    isAuthenticated,
    userRole,
    authTransitionMode,
    authInitialRoute,
    authInitialParams,
    profileCompleted,
    skipSplashOnAuth,
    clearAuthTransitionMode,
  } = useAuth();
  const didPreloadCustomerImagesRef = useRef(false);
  const cacheRefreshCleanupRef = useRef(null);
  const lastAuthTransitionModeRef = useRef(authTransitionMode);
  const lastSplashCompletedAtRef = useRef(0);

  const [isSplashVisible, setIsSplashVisible] = useState(!skipSplashOnAuth);
  const [splashCycle, setSplashCycle] = useState(0);
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
    if (!skipSplashOnAuth) return;
    setIsSplashVisible(false);
  }, [skipSplashOnAuth]);

  useEffect(() => {
    const previousMode = lastAuthTransitionModeRef.current;

    if (authTransitionMode === "post-login" && previousMode !== "post-login") {
      const now = Date.now();
      const wasRecentlyCompleted =
        now - lastSplashCompletedAtRef.current < 4500;

      // Customer flow should never replay the same splash sequence twice back-to-back.
      if (isSplashVisible || (effectiveRole === "customer" && wasRecentlyCompleted)) {
        clearAuthTransitionMode();
      } else {
      // Re-arm splash exactly once per successful auth transition.
        setIsSplashVisible(true);
        setSplashCycle((prev) => prev + 1);
      }
    }

    lastAuthTransitionModeRef.current = authTransitionMode;
  }, [authTransitionMode, clearAuthTransitionMode, effectiveRole, isSplashVisible]);

  useEffect(() => {
    if (!isAuthenticated || effectiveRole !== "customer") {
      didPreloadCustomerImagesRef.current = false;

      if (cacheRefreshCleanupRef.current) {
        cacheRefreshCleanupRef.current();
        cacheRefreshCleanupRef.current = null;
      }

      return;
    }
    if (didPreloadCustomerImagesRef.current) return;

    didPreloadCustomerImagesRef.current = true;

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

  const shouldShowStartupSplash = !skipSplashOnAuth && isSplashVisible;

  const handleSplashComplete = useCallback(() => {
    lastSplashCompletedAtRef.current = Date.now();
    setIsSplashVisible(false);
    if (authTransitionMode === "post-login") {
      clearAuthTransitionMode();
    }
  }, [authTransitionMode, clearAuthTransitionMode]);

  const renderMainNavigator = () => {
    if (isAuthenticated) {
      switch (effectiveRole) {
        case "customer":
          if (!profileCompleted) {
            return (
              <AuthNavigator
                initialRouteName="CompleteProfile"
                initialRouteParams={authInitialParams}
              />
            );
          }
          return <CustomerStack />;
        case "driver":
          return <DriverNavigator />;
        case "manager":
          return <ManagerNavigator />;
        case "admin":
          return <AdminNavigator />;
        default:
          return (
            <AuthNavigator
              initialRouteName={authInitialRoute}
              initialRouteParams={authInitialParams}
            />
          );
      }
    }

    return (
      <AuthNavigator
        initialRouteName={authInitialRoute}
        initialRouteParams={authInitialParams}
      />
    );
  };

  return (
    <View style={styles.root}>
      {renderMainNavigator()}
      {shouldShowStartupSplash && (
        <View style={styles.startupSplashOverlay} pointerEvents="auto">
          <SplashScreen
            key={`startup-splash-${splashCycle}`}
            onComplete={handleSplashComplete}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  startupSplashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
});
