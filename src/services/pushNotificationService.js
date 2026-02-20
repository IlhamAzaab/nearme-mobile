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

// ─── FOREGROUND HANDLER ───────────────────────────────────────
// Controls what happens when a notification arrives while app is OPEN.
// Alarm pulse notifications (isAlarm=true) suppress the banner so the
// in-app modal stays clean, but we still play the sound.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    const isAlarmPulse = data.isAlarm === "true" || data.isAlarm === true;
    return {
      shouldShowAlert: !isAlarmPulse, // no banner for alarm pulses
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
    lightColor: "#22c55e",
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
    lightColor: "#22c55e",
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
    lightColor: "#22c55e",
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
    lightColor: "#22c55e",
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

    this._onUrgentNotification = null; // callback for in-app modal
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

      await AsyncStorage.setItem("expoPushToken", token);
      return token;
    } catch (error) {
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
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return false;

      const expoPushToken = await this.getExpoPushToken();
      if (!expoPushToken) return false;

      const deviceId = await this.getDeviceId();

      console.log("[Push] Registering with backend...");
      console.log("[Push] Token:", expoPushToken);
      console.log("[Push] Device:", deviceId, Platform.OS);

      const response = await fetch(`${API_URL}/push/register-token`, {
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
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[Push] Registered!", data);
        return true;
      } else {
        const err = await response.json().catch(() => ({}));
        console.error("[Push] Register failed:", response.status, err);
        return false;
      }
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
        await fetch(`${API_URL}/push/unregister-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ deviceId }),
        });
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

        // Check if this is a persistent/urgent notification
        const isPersistent =
          data?.persistent === "true" || data?.persistent === true;
        const isUrgent =
          data?.type === "new_order" || data?.type === "new_delivery";

        if (isPersistent || isUrgent) {
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

        // Navigate based on notification type
        this.handleNotificationPress(notifData);

        // If urgent notification tapped from background/locked screen, show modal
        const isPersistent =
          notifData?.persistent === "true" || notifData?.persistent === true;
        const isUrgent =
          notifData?.type === "new_order" || notifData?.type === "new_delivery";
        if (isPersistent || isUrgent) {
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
      console.log("[Push] App opened from notification");
      const content = response.notification.request.content;
      const notifData = content.data || {};

      // Extra delay — navigation ref and modal callback must be ready
      setTimeout(() => {
        this.handleNotificationPress(notifData);

        // If urgent notification, show modal (even when app was killed)
        const isPersistent =
          notifData?.persistent === "true" || notifData?.persistent === true;
        const isUrgent =
          notifData?.type === "new_order" || notifData?.type === "new_delivery";
        if (isPersistent || isUrgent) {
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
    const { type, screen, orderId } = data || {};
    console.log("[Push] Navigate:", { type, screen, orderId });

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
        if (orderId) nav.navigate("OrderDetails", { orderId });
        break;
      case "new_order":
        // AdminTabs screen is 'Orders' inside the 'AdminMain' stack screen
        nav.navigate("AdminMain", { screen: "Orders" });
        break;
      case "new_delivery":
        // DriverTabs screen is 'Available' inside the 'DriverTabs' stack screen
        nav.navigate("DriverTabs", { screen: "Available" });
        break;
      case "payment_received":
        nav.navigate("DriverTabs", { screen: "Earnings" });
        break;
      case "unassigned_delivery_alert":
        nav.navigate("ManagerPendingDeliveries");
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
    console.log("[Push] Initializing...");

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
    this.isInitialized = false;
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
