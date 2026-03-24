import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import pushNotificationService from '../../services/pushNotificationService';

const UNREAD_COUNT_KEY = '@notifications_unread_count';
const LAST_SEEN_AT_KEY = '@notifications_last_seen_at';
const SEEN_NOTIFICATION_IDS_KEY = '@notifications_seen_ids';
const NotificationContext = createContext(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const appState = useRef(AppState.currentState);
  const navigationRef = useRef(null);

  // ─── Anti-stale-data mechanism ────────────────────────────────────────────
  // After marking all as read, we suppress server refreshes briefly
  // to prevent stale (pre-update) server data from overriding our 0 count.
  const suppressUntilRef = useRef(0);
  // Tracks the in-flight mark-as-read promise so refresh can await it.
  const pendingMarkReadRef = useRef(null);
  // Client-side cutoff for notifications already seen by the user.
  const lastSeenAtRef = useRef(0);
  const seenNotificationIdsRef = useRef(new Set());

  const getNotificationTimeMs = useCallback((notification) => {
    const raw = notification?.created_at || notification?.createdAt || notification?.timestamp;
    if (!raw) return 0;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }, []);

  const fetchCustomerNotifications = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    const role = await AsyncStorage.getItem('role');
    if (!token || role !== 'customer') {
      return [];
    }

    const res = await fetch(
      `${API_BASE_URL}/customer/notifications?limit=100&t=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );

    const data = await res.json().catch(() => ({}));
    return Array.isArray(data)
      ? data
      : Array.isArray(data?.notifications)
        ? data.notifications
        : [];
  }, []);

  // ─── Persist unread count to AsyncStorage ─────────────────────────────────
  const persistUnreadCount = useCallback(async (count) => {
    try {
      await AsyncStorage.setItem(UNREAD_COUNT_KEY, String(count));
    } catch (e) {
      console.log('[NotificationProvider] persistUnreadCount error:', e?.message);
    }
  }, []);

  // ─── Restore persisted unread count on mount ──────────────────────────────
  useEffect(() => {
    const restoreState = async () => {
      try {
        const stored = await AsyncStorage.getItem(UNREAD_COUNT_KEY);
        if (stored !== null) {
          const count = parseInt(stored, 10);
          if (!isNaN(count)) {
            setUnreadCount(count);
          }
        }

        const lastSeen = await AsyncStorage.getItem(LAST_SEEN_AT_KEY);
        if (lastSeen !== null) {
          const seenMs = parseInt(lastSeen, 10);
          if (!isNaN(seenMs)) {
            lastSeenAtRef.current = seenMs;
          }
        }

        const seenIdsRaw = await AsyncStorage.getItem(SEEN_NOTIFICATION_IDS_KEY);
        if (seenIdsRaw) {
          const parsed = JSON.parse(seenIdsRaw);
          if (Array.isArray(parsed)) {
            seenNotificationIdsRef.current = new Set(parsed.map((id) => String(id)));
          }
        }
      } catch (e) {
        console.log('[NotificationProvider] restoreState error:', e?.message);
      }
    };
    restoreState();
  }, []);

  const rememberSeenNotifications = useCallback(async (notificationIds) => {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;

    for (const id of notificationIds) {
      if (id !== null && id !== undefined) {
        seenNotificationIdsRef.current.add(String(id));
      }
    }

    // Keep memory bounded.
    const compact = Array.from(seenNotificationIdsRef.current).slice(-1000);
    seenNotificationIdsRef.current = new Set(compact);

    try {
      await AsyncStorage.setItem(SEEN_NOTIFICATION_IDS_KEY, JSON.stringify(compact));
    } catch (e) {
      console.log('[NotificationProvider] rememberSeenNotifications error:', e?.message);
    }
  }, []);

  const acknowledgeAllSeen = useCallback(async ({ suppressMs = 15000 } = {}) => {
    const now = Date.now();
    lastSeenAtRef.current = now;
    setUnreadCount(0);
    persistUnreadCount(0);
    pushNotificationService.setBadgeCount(0);
    suppressUntilRef.current = Math.max(suppressUntilRef.current, now + suppressMs);

    try {
      await AsyncStorage.setItem(LAST_SEEN_AT_KEY, String(now));
    } catch (e) {
      console.log('[NotificationProvider] acknowledgeAllSeen error:', e?.message);
    }
  }, [persistUnreadCount]);

  // ─── Fetch server-side unread count ───────────────────────────────────────
  const refreshUnreadCount = useCallback(async ({ force = false } = {}) => {
    try {
      // If we recently reset the count (optimistic), skip refresh to avoid
      // stale server data overwriting the 0.
      if (!force && Date.now() < suppressUntilRef.current) {
        return;
      }

      // If a mark-as-read operation is in flight, wait for it to finish
      // so the server has processed the updates before we re-query.
      if (pendingMarkReadRef.current) {
        await pendingMarkReadRef.current;
        pendingMarkReadRef.current = null;
      }

      const list = await fetchCustomerNotifications();
      const unread = list.filter((n) => {
        const id = String(n?.id ?? '');
        return !n.is_read
          && getNotificationTimeMs(n) > lastSeenAtRef.current
          && !seenNotificationIdsRef.current.has(id);
      }).length;

      // Double-check: if suppression kicked in while we were fetching, don't update
      if (!force && Date.now() < suppressUntilRef.current) {
        return;
      }

      setUnreadCount(unread);
      persistUnreadCount(unread);
    } catch (e) {
      console.log('[NotificationProvider] refreshUnreadCount error:', e?.message);
    }
  }, [fetchCustomerNotifications, getNotificationTimeMs, persistUnreadCount]);

  // Fetch unread count on mount
  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // Check push notification permission status on mount
  useEffect(() => {
    checkPushStatus();
  }, []);

  // Handle app state changes (background -> foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - refresh notification status
        checkPushStatus();
        refreshUnreadCount();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [refreshUnreadCount]);

  const checkPushStatus = async () => {
    const status = await pushNotificationService.getPermissionStatus();
    setPushEnabled(status === 'granted');

    const token = await AsyncStorage.getItem('expoPushToken');
    setPushToken(token);
  };

  // Set navigation reference for push notification handling
  const setNavigationRef = useCallback((ref) => {
    navigationRef.current = ref;
    pushNotificationService.setNavigationRef(ref);
  }, []);

  // Initialize push notifications (call after login)
  const initializePushNotifications = useCallback(async (authToken) => {
    console.log('[NotificationProvider] Initializing push notifications...');
    const result = await pushNotificationService.initialize(authToken);

    if (result.success) {
      setPushEnabled(true);
      const token = await AsyncStorage.getItem('expoPushToken');
      setPushToken(token);
    }

    return result;
  }, []);

  // Cleanup push notifications (call on logout)
  const cleanupPushNotifications = useCallback(async (authToken) => {
    console.log('[NotificationProvider] Cleaning up push notifications...');
    await pushNotificationService.unregisterToken(authToken);
    pushNotificationService.cleanup();
    setPushToken(null);
  }, []);

  // Request push notification permission
  const requestPushPermission = useCallback(async () => {
    const granted = await pushNotificationService.requestPermission();
    setPushEnabled(granted);
    return granted;
  }, []);

  // Show alert to enable notifications
  const showEnableNotificationsAlert = useCallback(() => {
    pushNotificationService.showEnableNotificationsAlert();
  }, []);

  // Add in-app notification (local)
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now().toString(),
      ...notification,
      is_read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => {
      const createdMs = getNotificationTimeMs(newNotification);
      const id = String(newNotification?.id ?? '');
      if (createdMs > 0 && createdMs <= lastSeenAtRef.current) {
        return prev;
      }
      if (seenNotificationIdsRef.current.has(id)) {
        return prev;
      }
      const next = prev + 1;
      persistUnreadCount(next);
      return next;
    });
  }, [getNotificationTimeMs, persistUnreadCount]);

  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => {
      const next = Math.max(0, prev - 1);
      persistUnreadCount(next);
      return next;
    });
  }, [persistUnreadCount]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    acknowledgeAllSeen({ suppressMs: 10000 });
  }, [acknowledgeAllSeen]);

  // Immediately reset unread count to 0 (optimistic update for instant UI)
  // Also activates a suppression window to prevent stale server data from
  // reverting the count back to the old value.
  const resetUnreadCount = useCallback(() => {
    // Suppress refreshes longer to avoid stale old count rebound.
    acknowledgeAllSeen({ suppressMs: 30000 });
  }, [acknowledgeAllSeen]);

  // Mark specific notification IDs as read on the server.
  // Stores the promise so refreshUnreadCount can await its completion.
  const markAllReadOnServer = useCallback(async (notificationIds) => {
    if (!notificationIds || notificationIds.length === 0) return;

    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const promise = Promise.all(
      notificationIds.map((id) =>
        fetch(
          `${API_BASE_URL}/customer/notifications/${id}/read`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
              Expires: '0',
            },
          },
        ).catch(() => { }),
      ),
    ).then(() => {
      // Keep minimum suppression to avoid stale rebound after server sync.
      suppressUntilRef.current = Math.max(suppressUntilRef.current, Date.now() + 5000);
      pendingMarkReadRef.current = null;
    });

    // Store the promise so refreshUnreadCount can await it
    pendingMarkReadRef.current = promise;
    return promise;
  }, []);

  const markAllReadForCustomer = useCallback(async () => {
    try {
      // Immediate UX requirement: once notifications are opened, do not show
      // previously seen count again unless a brand-new notification arrives.
      await acknowledgeAllSeen({ suppressMs: 30000 });

      const list = await fetchCustomerNotifications();
      await rememberSeenNotifications(list.map((n) => n?.id));
      setNotifications(list);

      const unreadIds = list.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length === 0) {
        markAllAsRead();
        return list.map((n) => ({ ...n, is_read: true }));
      }

      // Optimistic global update to keep badge stable at 0 immediately.
      resetUnreadCount();
      markAllAsRead();
      await markAllReadOnServer(unreadIds);

      const readList = list.map((n) => ({ ...n, is_read: true }));
      setNotifications(readList);
      return readList;
    } catch (e) {
      console.log('[NotificationProvider] markAllReadForCustomer error:', e?.message);
      return [];
    }
  }, [acknowledgeAllSeen, fetchCustomerNotifications, markAllAsRead, markAllReadOnServer, rememberSeenNotifications, resetUnreadCount]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    persistUnreadCount(0);
    pushNotificationService.clearAllNotifications();
  }, [persistUnreadCount]);

  // Send test notification (for debugging)
  const sendTestNotification = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      return await pushNotificationService.sendTestNotification(token);
    }
  }, []);

  // Schedule a local notification
  const scheduleLocalNotification = useCallback(async (title, body, data = {}) => {
    await pushNotificationService.scheduleLocalNotification(title, body, data);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        // In-app notifications
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        refreshUnreadCount,
        resetUnreadCount,
        acknowledgeAllSeen,
        markAllReadOnServer,
        fetchCustomerNotifications,
        markAllReadForCustomer,
        // Push notifications
        pushEnabled,
        pushToken,
        setNavigationRef,
        initializePushNotifications,
        cleanupPushNotifications,
        requestPushPermission,
        showEnableNotificationsAlert,
        sendTestNotification,
        scheduleLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
