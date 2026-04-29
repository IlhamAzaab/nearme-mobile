/**
 * Push Notification Service for NearMe
 *
 * Works in:
 * - Expo Go (development testing on physical devices)
 * - EAS Development builds
 * - EAS Production builds (Play Store / App Store)
 *
 * Features:
 * - Sound on every notification (foreground + background + locked)
 * - Works when app is locked/background/killed
 * - Android notification channels with sound
 * - iOS sound and badge support
 * - Auto-registers push token with backend
 * - Handles notification taps for navigation
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";
import { API_URL } from "../config/env";
import alarmService from "./alarmService";

// Detect if running in Expo Go (no native push support since SDK 53)
const isExpoGo = Constants.appOwnership === "expo";
// Map notification types to the roles they are intended for.
// Types not listed here are considered role-agnostic (shown to everyone).
const NOTIFICATION_ROLE_MAP = {
  new_order: "admin",
  order_reminder: "admin",
  new_delivery: "driver",
  unassigned_delivery_alert: "manager",
  payment_received: "driver",
  deposit_approved: "driver",
  admin_payment_received: "admin",
  restaurant_approval: "admin",
  admin_approval: "admin",
  driver_approval: "driver",
  order_update: "customer",
};

const PUSH_REGISTER_RETRY_AT_KEY = "pushRegisterRetryAt";
const PUSH_LAST_REGISTER_KEY = "pushLastRegisterKey";
const PUSH_REGISTER_COOLDOWN_MS = 5 * 60 * 1000;
const PUSH_REGISTER_TIMEOUT_MS = 12000;
const RETRYABLE_PUSH_STATUSES = new Set([
  408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526,
]);

function isRetryablePushStatus(status) {
  return RETRYABLE_PUSH_STATUSES.has(Number(status));
}

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function getPushRegisterUrls(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  const urls = [`${normalized}/push/register-token`];

  if (!/\/api(?:$|\/)/i.test(normalized)) {
    urls.push(`${normalized}/api/push/register-token`);
  }

  return Array.from(new Set(urls));
}

function toAppNotification({ title, body, data, createdAt }) {
  const d = data || {};
  const notificationId =
    d.notificationId ||
    d.notification_id ||
    d.id ||
    `push:${d.type || "general"}:${d.orderId || d.order_id || ""}:${title || ""}:${body || ""}`;

  return {
    id: String(notificationId),
    title: title || "Notification",
    message: body || d.message || "",
    created_at: createdAt || new Date().toISOString(),
    is_read: false,
    type: d.type || "info",
    order_id: d.orderId || d.order_id,
    data: {
      ...d,
      orderId: d.orderId || d.order_id,
    },
    _transient: !(d.notificationId || d.notification_id || d.id),
  };
}
// ─── FOREGROUND HANDLER ───────────────────────────────────────
// Controls what happens when a notification arrives while app is OPEN.
// Alarm pulse notifications (isAlarm=true) suppress the banner so the
// in-app modal stays clean, but we still play the sound.
// Role-mismatched notifications are silently suppressed.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    const isAlarmPulse = data.isAlarm === "true" || data.isAlarm === true;

    // Suppress notifications not intended for the current user role
    const type = data?.type;
    if (type && NOTIFICATION_ROLE_MAP[type]) {
      const currentRole = await AsyncStorage.getItem("role");
      const normalizedRole = currentRole
        ? String(currentRole).trim().toLowerCase()
        : null;
      if (normalizedRole && normalizedRole !== NOTIFICATION_ROLE_MAP[type]) {
        console.log(
          `[Push] Suppressing banner for "${type}" — not for role "${normalizedRole}"`,
        );
        return {
            shouldShowBanner: false,
            shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
    }

    return {
      shouldShowBanner: !isAlarmPulse, // no banner for alarm pulses
      shouldShowList: !isAlarmPulse,
      shouldPlaySound: true, // always play sound
      shouldSetBadge: !isAlarmPulse,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

// ─── ANDROID CHANNELS (Required for Android 8+) ──────────────
if (Platform.OS === "android") {
  // Default channel
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    description: "General notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#06C168",
    sound: "default",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Order updates channel (non-urgent)
  Notifications.setNotificationChannelAsync("orders", {
    name: "Order Updates",
    description: "Notifications about your orders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#06C168",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // URGENT orders channel — persistent ringing for new orders/deliveries
  // This channel uses MAX importance which shows as heads-up notification
  // and keeps ringing until user interacts.
  // sound: "alarm" → references res/raw/alarm.mp3 compiled into the APK
  // via the expo-notifications plugin `sounds` array in app.config.js.
  // ⚠️ Android cannot update a channel's sound after first creation.
  //    Clear app data or reinstall if the custom sound doesn't apply.
  Notifications.setNotificationChannelAsync("urgent_orders", {
    name: "Urgent Orders & Deliveries",
    description: "New orders and delivery requests that ring until you respond",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500, 200, 500],
    lightColor: "#ef4444",
    sound: "alarm",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Alerts channel — for manager unassigned delivery alerts
  Notifications.setNotificationChannelAsync("alerts", {
    name: "Critical Alerts",
    description: "Urgent alerts about unassigned deliveries and issues",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
    lightColor: "#ef4444",
    sound: "default",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Payments channel
  Notifications.setNotificationChannelAsync("payments", {
    name: "Payments",
    description: "Payment and withdrawal notifications",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#06C168",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Milestones channel
  Notifications.setNotificationChannelAsync("milestones", {
    name: "Milestones & Achievements",
    description: "Daily milestone achievements",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 150, 300, 150, 300],
    lightColor: "#f59e0b",
    sound: "default",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Approval notifications channel - MAX priority
  Notifications.setNotificationChannelAsync("approvals", {
    name: "Approvals",
    description: "Restaurant and driver approval notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    lightColor: "#06C168",
    sound: "default",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

class PushNotificationService {
  constructor() {
    this.navigationRef = null;
    this.foregroundSubscription = null;
    this.responseSubscription = null;
    this.isInitialized = false;
    this._userRole = null; // stored on initialize
    this._lastRegisterSuccess = false;

    this._onUrgentNotification = null; // callback for in-app modal
    this._initializePromise = null;
    this._pushInitInProgress = false;
    this._lastInitKey = null;
    this._lastNetworkWarnAt = 0;
    this._lastHandledNotificationResponseId = null;
  }

  TOKEN_RETRY_COOLDOWN_MS = 10 * 60 * 1000;
  NETWORK_WARN_COOLDOWN_MS = 60 * 1000;
  LAST_TOKEN_FAILURE_AT_KEY = "@push_last_token_network_failure_at";

  _isNetworkError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.includes("network request failed") ||
      message.includes("fetch failed") ||
      message.includes("network")
    );
  }

  _logNetworkWarnOnce(message, error = null) {
    const now = Date.now();
    if (now - this._lastNetworkWarnAt < this.NETWORK_WARN_COOLDOWN_MS) {
      return;
    }
    this._lastNetworkWarnAt = now;
    if (error) {
      console.warn(message, error?.message || error);
    } else {
      console.warn(message);
    }
  }

  async _hasExpoNetworkConnectivity() {
    // Probe Expo host before requesting a push token.
    // This avoids noisy expo-notifications warnings when device is offline.
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      try {
        controller?.abort();
      } catch {}
    }, 4000);

    try {
      const response = await fetch("https://exp.host", {
        method: "HEAD",
        cache: "no-store",
        signal: controller?.signal,
      });
      return response.ok;
    } catch (error) {
      if (this._isNetworkError(error)) {
        this._logNetworkWarnOnce(
          "[Push] Network unavailable. Skipping Expo token fetch for now.",
        );
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async _getCurrentUserContext() {
    try {
      const [roleRaw, userIdRaw] = await Promise.all([
        AsyncStorage.getItem("role"),
        AsyncStorage.getItem("userId"),
      ]);

      const role = roleRaw ? String(roleRaw).trim().toLowerCase() : null;
      const userId = userIdRaw ? String(userIdRaw).trim() : null;
      return { role, userId };
    } catch {
      return { role: null, userId: null };
    }
  }

  async _buildRegisterKey(expoPushToken, deviceId) {
    const { role, userId } = await this._getCurrentUserContext();
    if (!expoPushToken || !deviceId || !userId || !role) return null;
    return `${role}:${userId}:${deviceId}:${expoPushToken}`;
  }

  async _shouldSkipTokenFetchForCooldown() {
    try {
      const raw = await AsyncStorage.getItem(this.LAST_TOKEN_FAILURE_AT_KEY);
      const lastFailureAt = Number(raw || 0);
      if (!lastFailureAt) return false;
      const elapsed = Date.now() - lastFailureAt;
      return elapsed < this.TOKEN_RETRY_COOLDOWN_MS;
    } catch {
      return false;
    }
  }

  async _markTokenNetworkFailure() {
    try {
      await AsyncStorage.setItem(
        this.LAST_TOKEN_FAILURE_AT_KEY,
        String(Date.now()),
      );
    } catch {}
  }

  async _clearTokenNetworkFailure() {
    try {
      await AsyncStorage.removeItem(this.LAST_TOKEN_FAILURE_AT_KEY);
    } catch {}
  }

  /**
   * Check whether a notification is relevant for the current user role.
   * Returns true if the notification should be processed, false if it should be ignored.
   */
  _isNotificationForCurrentRole(data) {
    const type = data?.type;
    if (!type) return true; // no type → allow
    const requiredRole = NOTIFICATION_ROLE_MAP[type];
    if (!requiredRole) return true; // not role-specific → allow
    if (!this._userRole) return true; // role unknown → allow (safety fallback)
    return this._userRole === requiredRole;
  }

  /**
   * Set navigation reference for handling notification taps
   */
  setNavigationRef(ref) {
    this.navigationRef = ref;
  }

  /**
   * Register a callback for urgent notifications (new_order, new_delivery)
   * The callback receives { title, body, data } and should show an in-app modal
   */
  onUrgentNotification(callback) {
    this._onUrgentNotification = callback;
  }

  onNotificationReceived(callback) {
    this._onNotificationReceived =
      typeof callback === "function" ? callback : null;
  }

  onNotificationOpened(callback) {
    this._onNotificationOpened =
      typeof callback === "function" ? callback : null;
  }

  // ─── PERSISTENT RINGING ───────────────────────────────────────

  /**
   * Start persistent alarm for urgent notifications.
   * Uses expo-av to loop the custom alarm.mp3 continuously.
   * Works in foreground AND while the app is minimised
   * (Audio.setAudioModeAsync staysActiveInBackground:true).
   */
  async startAlarm(title, body, data = {}) {
    console.log("[Push] 🔔 Starting alarm:", title);
    await alarmService.start();
  }

  /**
   * Stop the persistent alarm. Call when user accepts or rejects.
   */
  async stopAlarm() {
    await alarmService.stop();
  }

  /**
   * Check if alarm is currently ringing
   */
  isAlarmActive() {
    return alarmService.isPlaying();
  }

  // ─── PERMISSION ──────────────────────────────────────────────

  /**
   * Request notification permission
   * Android 13+: Shows system dialog
   * iOS: Shows "Allow Notifications?" dialog
   */
  async requestPermission() {
    if (!Device.isDevice) {
      console.log("[Push] Not a physical device - wont work");
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Permission denied");
      return false;
    }

    console.log("[Push] Permission granted");
    return true;
  }

  /**
   * Get current permission status
   */
  async getPermissionStatus() {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  /**
   * Show alert guiding user to enable notifications in phone settings
   */
  showEnableNotificationsAlert() {
    Alert.alert(
      "Enable Notifications",
      "Turn on notifications to receive updates about orders, deliveries, and approvals.",
      [
        { text: "Not Now", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => {
            if (Platform.OS === "ios") {
              Linking.openURL("app-settings:");
            } else {
              Linking.openSettings();
            }
          },
        },
      ],
    );
  }

  // ─── PUSH TOKEN ─────────────────────────────────────────────

  /**
   * Get Expo Push Token
   *
   * NOTE: Since SDK 53, remote push does NOT work in Expo Go on Android.
   * You MUST use a development build (eas build --profile development).
   * iOS Expo Go still supports push tokens.
   */
  async getExpoPushToken() {
    try {
      if (await this._shouldSkipTokenFetchForCooldown()) {
        this._logNetworkWarnOnce(
          "[Push] Skipping Expo token fetch due to recent network failure cooldown.",
        );
        return null;
      }

      const hasNetwork = await this._hasExpoNetworkConnectivity();
      if (!hasNetwork) {
        await this._markTokenNetworkFailure();
        return null;
      }

      if (!Device.isDevice) {
        console.log("[Push] Need physical device");
        return null;
      }

      // Expo Go on Android cannot get push tokens since SDK 53
      if (isExpoGo && Platform.OS === "android") {
        console.log(
          "[Push] Expo Go on Android - remote push not supported. Use development build.",
        );
        return null;
      }

      // Get projectId from app.json config
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      let tokenData;

      if (projectId && projectId !== "YOUR_PROJECT_ID_HERE") {
        console.log("[Push] Getting token with projectId:", projectId);
        tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      } else {
        console.log("[Push] Getting token without projectId...");
        tokenData = await Notifications.getExpoPushTokenAsync();
      }

      const token = tokenData.data;
      console.log("[Push] Got token:", token);

      await this._clearTokenNetworkFailure();
      await AsyncStorage.setItem("expoPushToken", token);
      return token;
    } catch (error) {
      if (this._isNetworkError(error)) {
        await this._markTokenNetworkFailure();
        this._logNetworkWarnOnce(
          "[Push] Token fetch skipped after network error. Will retry later.",
          error,
        );
        return null;
      }

      console.error("[Push] Token error:", error);
      return null;
    }
  }

  // ─── DEVICE ID ──────────────────────────────────────────────

  async getDeviceId() {
    let deviceId = await AsyncStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  }

  // ─── REGISTER / UNREGISTER WITH BACKEND ─────────────────────

  /**
   * Register push token with your backend
   *
   * FLOW:
   * 1. User logs in as admin
   * 2. App gets Expo Push Token
   * 3. App sends token to YOUR backend: POST /push/register-token
   * 4. Backend saves: { userId, expoPushToken, deviceType }
   * 5. When manager approves, backend fetches admin's token
   * 6. Backend calls Expo Push API with that token
   * 7. Expo sends notification to the device (via FCM/APNs)
   * 8. Device shows notification with sound, even if locked
   */
  async registerToken(authToken) {
    try {
      if (!authToken) {
        console.log("[Push] Skipping register: missing auth token");
        return false;
      }

      const retryAtRaw = await AsyncStorage.getItem(PUSH_REGISTER_RETRY_AT_KEY);
      const retryAt = Number(retryAtRaw || 0);
      if (retryAt > Date.now()) {
        const waitSec = Math.ceil((retryAt - Date.now()) / 1000);
        console.log(`[Push] Register cooldown active, retrying in ${waitSec}s`);
        return false;
      }

      const hasPermission = await this.requestPermission();
      if (!hasPermission) return false;

      const expoPushToken = await this.getExpoPushToken();
      if (!expoPushToken) return false;

      const deviceId = await this.getDeviceId();

      const registerKey = await this._buildRegisterKey(
        expoPushToken,
        deviceId,
      );
      if (registerKey) {
        const lastKey = await AsyncStorage.getItem(PUSH_LAST_REGISTER_KEY);
        if (lastKey === registerKey) {
          console.log("[Push] Register skipped (unchanged token/user/device)");
          return true;
        }
      }

      console.log("[Push] Registering with backend...");
      console.log("[Push] Token:", expoPushToken);
      console.log("[Push] Device:", deviceId, Platform.OS);

      // Use rateLimitedFetch with retry on 429 to handle rate limits
      const { rateLimitedFetch } = require("../utils/rateLimitedFetch");
      const registerUrls = getPushRegisterUrls(API_URL);

      for (let i = 0; i < registerUrls.length; i += 1) {
        const url = registerUrls[i];
        let timeoutId;
        try {
          const controller = new AbortController();
          timeoutId = setTimeout(
            () => controller.abort(),
            PUSH_REGISTER_TIMEOUT_MS,
          );

          const response = await rateLimitedFetch(
            url,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                expoPushToken,
                deviceType: Platform.OS,
                deviceId,
              }),
              signal: controller.signal,
            },
            { deduplicate: false },
          );

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            await AsyncStorage.removeItem(PUSH_REGISTER_RETRY_AT_KEY);
            if (registerKey) {
              await AsyncStorage.setItem(PUSH_LAST_REGISTER_KEY, registerKey);
            }
            console.log("[Push] Registered!", data);
            return true;
          }

          const err = await response.json().catch(() => ({}));
          const isRetryable = isRetryablePushStatus(response.status);

          if (isRetryable) {
            await AsyncStorage.setItem(
              PUSH_REGISTER_RETRY_AT_KEY,
              String(Date.now() + PUSH_REGISTER_COOLDOWN_MS),
            );
            console.warn(
              "[Push] Register temporarily unavailable:",
              response.status,
              err,
            );
            return false;
          }

          // Non-retryable errors (401/403/404 etc) are expected when
          // a temporary token is used before session exchange.
          console.warn("[Push] Register failed:", response.status, err);
          return false;
        } catch (endpointError) {
          const isAbort = endpointError?.name === "AbortError";
          const canTryNext = i < registerUrls.length - 1;

          if (canTryNext) {
            console.warn(
              `[Push] Register endpoint failed, trying fallback: ${url}`,
            );
            continue;
          }

          await AsyncStorage.setItem(
            PUSH_REGISTER_RETRY_AT_KEY,
            String(Date.now() + PUSH_REGISTER_COOLDOWN_MS),
          );

          if (isAbort) {
            console.warn("[Push] Register timed out, will retry later");
            return false;
          }

          throw endpointError;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      }

      return false;
    } catch (error) {
      console.error("[Push] Register error:", error);
      return false;
    }
  }

  /**
   * Unregister token on logout (security)
   */
  async unregisterToken(authToken) {
    try {
      const deviceId = await this.getDeviceId();

      if (authToken) {
        const { rateLimitedFetch } = require("../utils/rateLimitedFetch");
        await rateLimitedFetch(
          `${API_URL}/push/unregister-token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ deviceId }),
          },
          { deduplicate: false },
        );
      }

      await AsyncStorage.removeItem("expoPushToken");
      console.log("[Push] Token unregistered");
    } catch (error) {
      console.error("[Push] Unregister error:", error);
    }
  }

  // ─── NOTIFICATION LISTENERS ────────────────────────────────

  /**
   * Handle notifications in FOREGROUND (app is open)
   * For urgent/persistent notifications, starts the alarm & triggers the in-app modal
   */
  setupForegroundHandler() {
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
    }

    this.foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body, data } = notification.request.content;
        console.log("[Push] Foreground:", { title, body, data });

        // IMPORTANT: Ignore alarm pulse notifications fired by this service itself.
        // They have isAlarm:"true" and would cause an infinite loop if processed.
        if (data?.isAlarm === "true" || data?.isAlarm === true) {
          return;
        }

        // Role-based filtering: ignore notifications not meant for this user
        if (!this._isNotificationForCurrentRole(data)) {
          console.log(
            `[Push] Ignoring notification type "${data?.type}" — not for role "${this._userRole}"`,
          );
          return;
        }

        if (this._onNotificationReceived) {
          this._onNotificationReceived(
            toAppNotification({
              title,
              body,
              data,
              createdAt: new Date().toISOString(),
            }),
          );
        }

        // Check if this is a persistent/urgent notification
        const isPersistent =
          data?.persistent === "true" || data?.persistent === true;
        const isUrgent =
          data?.type === "new_order" || data?.type === "order_reminder";
        const shouldOpenUrgentModal =
          (isPersistent || isUrgent) && data?.type !== "new_delivery";

        if (shouldOpenUrgentModal) {
          // Start persistent alarm (sound + modal)
          this.startAlarm(title, body, data);

          // Trigger in-app modal via callback
          if (this._onUrgentNotification) {
            this._onUrgentNotification({ title, body, data });
          }
        }
      },
    );
  }

  /**
   * Handle notification TAPS
   */
  setupNotificationResponseHandler() {
    if (this.responseSubscription) {
      this.responseSubscription.remove();
    }

    this.responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("[Push] Tapped notification");
        const content = response.notification.request.content;
        const notifData = content.data || {};
        const tapPayload = {
          ...notifData,
          _notificationTitle: content.title,
          _notificationBody: content.body,
          _notificationCreatedAt: new Date().toISOString(),
        };

        // Role-based filtering: ignore notifications not meant for this user
        if (!this._isNotificationForCurrentRole(notifData)) {
          console.log(
            `[Push] Ignoring tapped notification type "${notifData?.type}" — not for role "${this._userRole}"`,
          );
          return;
        }

        if (this._onNotificationOpened) {
          this._onNotificationOpened(
            toAppNotification({
              title: content.title,
              body: content.body,
              data: notifData,
              createdAt: new Date().toISOString(),
            }),
          );
        }

        // Navigate based on notification type
        this.handleNotificationPress(tapPayload);

        // If urgent notification tapped from background/locked screen, show modal
        const isPersistent =
          notifData?.persistent === "true" || notifData?.persistent === true;
        const isUrgent =
          notifData?.type === "new_order" ||
          notifData?.type === "order_reminder";
        const shouldOpenUrgentModal =
          (isPersistent || isUrgent) && notifData?.type !== "new_delivery";
        if (shouldOpenUrgentModal) {
          this.startAlarm(content.title, content.body, notifData);
          if (this._onUrgentNotification) {
            this._onUrgentNotification({
              title: content.title,
              body: content.body,
              data: notifData,
            });
          }
        }
      });
  }

  /**
   * Check if app was opened from a notification (killed state)
   */
  async getInitialNotification() {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const responseId =
        response?.notification?.request?.identifier ||
        response?.notification?.date ||
        null;

      if (
        responseId &&
        this._lastHandledNotificationResponseId === String(responseId)
      ) {
        return;
      }

      this._lastHandledNotificationResponseId = responseId
        ? String(responseId)
        : String(Date.now());

      try {
        await Notifications.clearLastNotificationResponseAsync?.();
      } catch {
        // Older SDKs may not expose clear API.
      }

      console.log("[Push] App opened from notification");
      const content = response.notification.request.content;
      const notifData = content.data || {};
      const openPayload = {
        ...notifData,
        _notificationTitle: content.title,
        _notificationBody: content.body,
        _notificationCreatedAt: new Date().toISOString(),
      };

      // Extra delay — navigation ref and modal callback must be ready
      setTimeout(async () => {
        // Role-based filtering: ignore notifications not meant for this user
        if (!this._isNotificationForCurrentRole(notifData)) {
          console.log(
            `[Push] Ignoring initial notification type "${notifData?.type}" — not for role "${this._userRole}"`,
          );
          return;
        }

        if (this._onNotificationOpened) {
          this._onNotificationOpened(
            toAppNotification({
              title: content.title,
              body: content.body,
              data: notifData,
              createdAt: new Date().toISOString(),
            }),
          );
        }

        this.handleNotificationPress(openPayload);

        // If urgent notification, show modal (even when app was killed)
        const isPersistent =
          notifData?.persistent === "true" || notifData?.persistent === true;
        const isUrgent =
          notifData?.type === "new_order" ||
          notifData?.type === "order_reminder";
        const shouldOpenUrgentModal =
          (isPersistent || isUrgent) && notifData?.type !== "new_delivery";
        if (shouldOpenUrgentModal) {
          this.startAlarm(content.title, content.body, notifData);
          if (this._onUrgentNotification) {
            this._onUrgentNotification({
              title: content.title,
              body: content.body,
              data: notifData,
            });
          }
        }
      }, 2000);
    }
  }

  // ─── NOTIFICATION TAP NAVIGATION ──────────────────────────

  handleNotificationPress(data) {
    const { type, screen, orderId, paymentId } = data || {};
    console.log("[Push] Navigate:", { type, screen, orderId, paymentId });

    if (!this.navigationRef) return;
    const nav = this.navigationRef;

    switch (type) {
      case "restaurant_approval":
      case "admin_approval":
        nav.reset({ index: 0, routes: [{ name: "AdminMain" }] });
        break;
      case "driver_approval":
        nav.reset({ index: 0, routes: [{ name: "DriverMain" }] });
        break;
      case "order_update":
        nav.navigate("MainTabs", {
          screen: "Home",
          params: {
            screen: "Notifications",
            params: {
              openFromPush: true,
              notification: {
                id: String(
                  data?.notificationId ||
                    data?.notification_id ||
                    `push-${Date.now()}`,
                ),
                title: data?._notificationTitle || "Order Update",
                message:
                  data?._notificationBody ||
                  data?.message ||
                  "You have a new order update.",
                created_at:
                  data?._notificationCreatedAt || new Date().toISOString(),
                is_read: false,
                order_id: orderId || data?.order_id,
                data: {
                  ...data,
                  orderId: orderId || data?.order_id,
                },
                _transient: !(data?.notificationId || data?.notification_id),
              },
            },
          },
        });
        break;
      case "new_order":
      case "order_reminder":
        // AdminTabs screen is 'Orders' inside the 'AdminMain' stack screen
        nav.navigate("AdminMain", { screen: "Orders" });
        break;
      case "new_delivery":
        // DriverTabs screen is 'Available' inside the 'DriverTabs' stack screen
        nav.navigate("DriverTabs", {
          screen: "Available",
          params: {
            focusDeliveryId: String(
              data?.deliveryId || data?.delivery_id || "",
            ).trim(),
            deliveryId: String(
              data?.deliveryId || data?.delivery_id || "",
            ).trim(),
            focusSource: "push_notification",
            focusRequestedAt: Date.now(),
          },
        });
        break;
      case "payment_received":
        nav.navigate("DriverWithdrawals", {
          paymentId: paymentId ? String(paymentId) : null,
        });
        break;
      case "deposit_approved":
        nav.navigate("DriverDeposits");
        break;
      case "admin_payment_received":
        nav.navigate("AdminWithdrawals");
        break;
      case "unassigned_delivery_alert":
        nav.navigate("Reports", { screen: "PendingDeliveries" });
        break;
      case "milestone":
        // Navigate based on user screen in data
        if (screen) nav.navigate(screen);
        break;
      default:
        if (screen) nav.navigate(screen);
        break;
    }
  }

  // ─── INITIALIZE ───────────────────────────────────────────

  /**
   * Full initialization - call after login or on app start
   */
  async initialize(authToken) {
    if (this.isInitialized && this._lastInitKey && this._lastRegisterSuccess) {
      return { success: true, skipped: true, isExpoGo };
    }
    if (this._initializePromise) {
      return this._initializePromise;
    }

    this._pushInitInProgress = true;
    this._initializePromise = this._initialize(authToken);
    try {
      return await this._initializePromise;
    } finally {
      this._initializePromise = null;
      this._pushInitInProgress = false;
    }
  }

  async _initialize(authToken) {
    console.log("[Push] Initializing...");

    // Store the user role so we can filter notifications by role
    const { role, userId } = await this._getCurrentUserContext();
    this._userRole = role;
    this._lastInitKey = role && userId ? `${role}:${userId}` : null;
    console.log("[Push] User role:", this._userRole);

    // Warn if running in Expo Go on Android
    if (isExpoGo && Platform.OS === "android") {
      console.log(
        "[Push] Running in Expo Go on Android - remote push not available.",
      );
      console.log(
        "[Push] Local notifications still work. Use dev build for full push support.",
      );
    }

    try {
      // Register token with backend (will gracefully skip in Expo Go Android)
      const registered = await this.registerToken(authToken);
      this._lastRegisterSuccess = Boolean(registered);

      // Setup listeners (even if backend fails, for local testing)
      this.setupForegroundHandler();
      this.setupNotificationResponseHandler();

      // Check if app opened from notification
      if (!isExpoGo || Platform.OS !== "android") {
        await this.getInitialNotification();
      }

      this.isInitialized = true;
      console.log("[Push] Done! Registered:", registered);

      return { success: registered, isExpoGo };
    } catch (error) {
      console.error("[Push] Init error:", error);
      return { success: false, isExpoGo };
    }
  }

  /**
   * Cleanup (call on logout)
   */
  cleanup() {
    alarmService.stop(); // fire-and-forget — no need to await on logout
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }
    if (this.responseSubscription) {
      this.responseSubscription.remove();
      this.responseSubscription = null;
    }
    this._onUrgentNotification = null;
    this._onNotificationReceived = null;
    this._onNotificationOpened = null;
    this._userRole = null;
    this.isInitialized = false;
    this._lastInitKey = null;
    this._lastRegisterSuccess = false;
  }

  // ─── LOCAL NOTIFICATIONS ──────────────────────────────────

  /**
   * Send a local notification WITH SOUND
   * Good for testing - triggers in 1 second
   */
  async scheduleLocalNotification(title, body, data = {}) {
    const channelId = data.type?.includes("approval")
      ? "approvals"
      : data.type?.includes("order")
        ? "orders"
        : "default";

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === "android" ? { channelId } : {}),
      },
      trigger: {
        type: "timeInterval",
        seconds: 1,
      },
    });
  }

  // ─── REMOTE TEST ─────────────────────────────────────────

  /**
   * Send test notification via YOUR backend
   */
  async sendTestNotification(authToken) {
    try {
      const response = await fetch(`${API_URL}/push/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "NearMe Test",
          body: "Push notifications are working! You will get notified when your restaurant is approved.",
          data: { type: "test" },
          sound: "default",
          channelId: "default",
        }),
      });

      const result = await response.json();
      console.log("[Push] Test result:", result);
      return result;
    } catch (error) {
      console.error("[Push] Test error:", error);
      throw error;
    }
  }

  // ─── BADGE ──────────────────────────────────────────────

  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  async clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
    await this.setBadgeCount(0);
  }
}

export default new PushNotificationService();
