import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, Platform, Linking, StatusBar, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
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

// Module-level flag: true only on cold starts (first JS process boot).
// Stays false once set — survives background/foreground cycles.
// Only resets when the OS fully kills the app process.
let _isColdStart = true;

const RESTAURANTS_CACHE_KEY = "public:restaurants";
const FOODS_CACHE_KEY = "public:foods";

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

// Helper to compare semantic versions
function isVersionStale(current, minimum) {
  const parse = (v) => String(v || "").split(".").map(Number);
  const cParts = parse(current);
  const mParts = parse(minimum);

  const maxLength = Math.max(cParts.length, mParts.length);
  for (let i = 0; i < maxLength; i++) {
    const cPart = cParts[i] || 0;
    const mPart = mParts[i] || 0;
    if (cPart < mPart) return true;
    if (cPart > mPart) return false;
  }
  return false;
}

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
  // Track if app went to background so we can skip splash on foreground resume
  const wasInBackgroundRef = useRef(false);

  // Only show splash on true cold start; skip if coming back from background
  const [isSplashVisible, setIsSplashVisible] = useState(_isColdStart && !skipSplashOnAuth);
  const [splashCycle, setSplashCycle] = useState(0);

  // Listen for app state changes: mark when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        wasInBackgroundRef.current = true;
      }
    });
    return () => sub?.remove();
  }, []);
  
  // Force update version state
  const [isVersionChecking, setIsVersionChecking] = useState(true);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);

  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const effectiveRole =
    normalizedRole === "user"
      ? "customer"
      : normalizedRole === "restaurant_admin"
        ? "admin"
        : normalizedRole;

  // Run version check on startup
  useEffect(() => {
    let active = true;

    const checkAppVersion = async () => {
      try {
        setIsVersionChecking(true);
        const res = await fetch(`${API_BASE_URL}/public/app-config`);
        if (!res.ok) throw new Error("Failed to fetch app config");

        const data = await res.json();
        const minVersion = data?.minimum_app_version || "1.0.0";

        if (active) {
          setIsUpdateRequired(isVersionStale(APP_VERSION, minVersion));
          setIsVersionChecking(false);
        }
      } catch (err) {
        console.warn("[RootNavigator] Version check failed:", err);
        // Fail-open on network/server error to not block users
        if (active) {
          setIsVersionChecking(false);
        }
      }
    };

    checkAppVersion();

    return () => {
      active = false;
    };
  }, []);

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

      // Never show splash if app came from background (just a foreground resume)
      if (wasInBackgroundRef.current) {
        wasInBackgroundRef.current = false; // reset for next time
        clearAuthTransitionMode();
      } else if (isSplashVisible || (effectiveRole === "customer" && wasRecentlyCompleted)) {
        // Customer flow should never replay the same splash sequence twice back-to-back.
        clearAuthTransitionMode();
      } else {
        // Re-arm splash exactly once per successful auth transition (cold start / fresh login).
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

  const shouldShowStartupSplash = (!skipSplashOnAuth && isSplashVisible) || isVersionChecking;

  const handleSplashComplete = useCallback(() => {
    lastSplashCompletedAtRef.current = Date.now();
    // Mark that cold start is done — never show splash again in this JS process
    _isColdStart = false;
    setIsSplashVisible(false);
    if (authTransitionMode === "post-login") {
      clearAuthTransitionMode();
    }
  }, [authTransitionMode, clearAuthTransitionMode]);

  const handleOpenPlayStore = () => {
    const url = Platform.OS === "android"
      ? "market://details?id=com.nearme.mobile"
      : "https://apps.apple.com/app/id-placeholder"; // Fallback URL

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL("https://play.google.com/store/apps/details?id=com.nearme.mobile");
        }
      })
      .catch((err) => console.log("Linking error:", err));
  };

  const renderMainNavigator = () => {
    if (isUpdateRequired) {
      return (
        <View style={styles.blockerContainer}>
          <StatusBar backgroundColor="#F9FAFB" barStyle="dark-content" />
          <View style={styles.blockerCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-download-outline" size={44} color="#06C168" />
            </View>
            <Text style={styles.blockerTitle}>New Version Available</Text>
            <Text style={styles.blockerSubtitle}>
              We have made some exciting updates and fixes to Meezo! To continue using the app, please update to the latest version.
            </Text>
            <Pressable onPress={handleOpenPlayStore} style={styles.updateButton}>
              <Text style={styles.updateButtonText}>Update Now</Text>
            </Pressable>
          </View>
        </View>
      );
    }

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
  blockerContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  blockerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  blockerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  blockerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  updateButton: {
    backgroundColor: "#06C168",
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
