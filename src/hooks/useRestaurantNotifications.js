import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Hook for managing restaurant/admin notifications (for restaurant owners)
 * @param {string} restaurantId
 * @returns {Object} Notification state and actions
 */
const useRestaurantNotifications = (restaurantId) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const response = await api.get(`/restaurant/${restaurantId}/notifications`);
      if (response.data) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.warn('[useRestaurantNotifications] Fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.put(`/restaurant/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.warn('[useRestaurantNotifications] markAsRead error:', error.message);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put(`/restaurant/${restaurantId}/notifications/read-all`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.warn('[useRestaurantNotifications] markAllAsRead error:', error.message);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 60000);
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

export default useRestaurantNotifications;
