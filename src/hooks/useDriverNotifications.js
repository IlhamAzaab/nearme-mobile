import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Hook for managing driver notifications
 * @param {string} driverId
 * @returns {Object} Notification state and actions
 */
const useDriverNotifications = (driverId) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!driverId) return;
    try {
      setLoading(true);
      const response = await api.get(`/driver/notifications?driverId=${driverId}`);
      if (response.data) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.warn('[useDriverNotifications] Fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.put(`/driver/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.warn('[useDriverNotifications] markAsRead error:', error.message);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/driver/notifications/read-all', { driverId });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.warn('[useDriverNotifications] markAllAsRead error:', error.message);
    }
  }, [driverId]);

  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000); // Poll every 30s for drivers
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};

export default useDriverNotifications;
