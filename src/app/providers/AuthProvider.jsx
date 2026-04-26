import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../config/env";
import orderTrackingService from "../../services/orderTrackingService";
import pushNotificationService from "../../services/pushNotificationService";
import { clearAuthSession, getAccessToken } from "../../lib/authStorage";
import {
  SIGNUP_FLOW_STATE_KEY,
  sanitizeSignupFlowState,
} from "../../constants/signupFlowState";
import { mobileQueryClient } from "../../lib/queryClient";

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTransitionMode, setAuthTransitionMode] = useState("none");
  const [authInitialRoute, setAuthInitialRoute] = useState("Login");
  const [authInitialParams, setAuthInitialParams] = useState(null);
  const [skipSplashOnAuth, setSkipSplashOnAuth] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false);

  // Admin-specific state
  const [adminStatus, setAdminStatus] = useState(null); // 'pending', 'active', 'suspended'
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [adminStatusLoading, setAdminStatusLoading] = useState(false);

  const resetToLoggedOutState = useCallback(async () => {
    try {
      await clearAuthSession();
    } catch (error) {
      console.error("Auth clear session failed:", error);
    }

    mobileQueryClient.clear();

    setUser(null);
    setUserRole(null);
    setIsAuthenticated(false);
    setAuthTransitionMode("none");
    setAuthInitialRoute("Login");
    setAuthInitialParams(null);
    setSkipSplashOnAuth(true);
    setProfileCompleted(false);

    // Reset admin-specific state
    setAdminStatus(null);
    setForcePasswordChange(false);
    setOnboardingCompleted(false);
    setOnboardingStep(1);

    try {
      await AsyncStorage.removeItem(SIGNUP_FLOW_STATE_KEY);
    } catch (error) {
      console.error("Failed to clear signup flow state:", error);
    }
  }, []);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await getAccessToken();
      const pendingSignupFlowRaw = await AsyncStorage.getItem(
        SIGNUP_FLOW_STATE_KEY,
      );
      let pendingSignupFlow = null;
      if (pendingSignupFlowRaw) {
        try {
          pendingSignupFlow = sanitizeSignupFlowState(
            JSON.parse(pendingSignupFlowRaw),
          );
        } catch {
          pendingSignupFlow = null;
        }
      }
      const role = await AsyncStorage.getItem("role");
      const userName = await AsyncStorage.getItem("userName");
      const userEmail = await AsyncStorage.getItem("userEmail");
      const userId = await AsyncStorage.getItem("userId");
      const profileDone = await AsyncStorage.getItem("profileCompleted");
      const isCustomerProfileComplete = profileDone === "true";

      if (token && role) {
        setUser({ id: userId, email: userEmail, name: userName, role });
        setUserRole(role);
        setIsAuthenticated(true);
        if (
          String(role).toLowerCase() === "customer" &&
          !isCustomerProfileComplete
        ) {
          setAuthInitialRoute("CompleteProfile");
          setAuthInitialParams(
            pendingSignupFlow?.routeName === "CompleteProfile"
              ? pendingSignupFlow.params
              : null,
          );
        } else {
          setAuthInitialRoute("Login");
          setAuthInitialParams(null);
        }
        setSkipSplashOnAuth(false);
        setProfileCompleted(isCustomerProfileComplete);
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
        setUser(null);
        setProfileCompleted(false);

        if (pendingSignupFlow) {
          setAuthInitialRoute(pendingSignupFlow.routeName);
          setAuthInitialParams(pendingSignupFlow.params || null);
        } else {
          setAuthInitialRoute("Login");
          setAuthInitialParams(null);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setAuthInitialRoute("Login");
      setAuthInitialParams(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Call this after login to refresh auth state
  const refreshAuthState = useCallback(async () => {
    await checkAuthState();
  }, []);

  const preparePostLoginTransition = useCallback(() => {
    setSkipSplashOnAuth(false);
    setAuthTransitionMode("post-login");
  }, []);

  const clearAuthTransitionMode = useCallback(() => {
    setAuthTransitionMode("none");
  }, []);

  // Fetch admin status from API (for admin role only)
  const fetchAdminStatus = useCallback(async () => {
    const token = await getAccessToken();
    const role = await AsyncStorage.getItem("role");

    if (!token || role !== "admin") {
      return null;
    }

    setAdminStatusLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_URL}/restaurant-onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn("Admin status check failed:", res.status);
        await resetToLoggedOutState();
        return null;
      }

      const data = await res.json();

      // Update admin-specific state
      setForcePasswordChange(data.force_password_change || false);
      setOnboardingCompleted(data.onboarding_completed || false);
      setOnboardingStep(data.onboarding_step || 1);
      setAdminStatus(data.admin_status || "pending");

      // Also update profileCompleted based on onboarding
      const completed =
        data.onboarding_completed && data.admin_status === "active";
      setProfileCompleted(completed);
      await AsyncStorage.setItem(
        "profileCompleted",
        completed ? "true" : "false",
      );

      return data;
    } catch (error) {
      console.error("Admin status fetch error:", error);
      await resetToLoggedOutState();
      return null;
    } finally {
      setAdminStatusLoading(false);
    }
  }, [resetToLoggedOutState]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      void email;
      void password;
      throw new Error(
        "Direct AuthProvider.login is disabled. Use the API login flow in LoginScreen.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email, password, name) => {
    setIsLoading(true);
    try {
      // TODO: Implement signup API call
      console.log("Signup:", { email, name });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(async () => {
    const token = await getAccessToken();

    // Log out locally first so navigation immediately switches to Auth screens.
    await resetToLoggedOutState();

    // Fire-and-forget cleanup tasks.
    void orderTrackingService.clearAll();

    // Unregister push notification token before logout
    if (token) {
      void pushNotificationService.unregisterToken(token);
    }
    pushNotificationService.cleanup();
  }, [resetToLoggedOutState]);

  const markProfileCompleted = async () => {
    await AsyncStorage.setItem("profileCompleted", "true");
    setProfileCompleted(true);
  };

  // Initialize push notifications after login
  const initializePushNotifications = useCallback(async (navigationRef) => {
    const token = await getAccessToken();
    if (token) {
      console.log("🔔 AuthProvider: Initializing push notifications...");
      if (navigationRef) {
        pushNotificationService.setNavigationRef(navigationRef);
      }
      const result = await pushNotificationService.initialize(token);
      console.log("Push notifications initialized:", result.success);
      return result;
    }
    return { success: false };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        authTransitionMode,
        authInitialRoute,
        authInitialParams,
        skipSplashOnAuth,
        userRole,
        profileCompleted,
        // Admin-specific
        adminStatus,
        forcePasswordChange,
        onboardingCompleted,
        onboardingStep,
        adminStatusLoading,
        // Methods
        login,
        signup,
        logout,
        preparePostLoginTransition,
        clearAuthTransitionMode,
        refreshAuthState,
        markProfileCompleted,
        fetchAdminStatus,
        setOnboardingStep,
        setOnboardingCompleted,
        setAdminStatus,
        initializePushNotifications,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
