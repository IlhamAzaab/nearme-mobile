import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Hook for managing customer notifications
 * @returns {Object} Notification state and actions
 */
const useCustomerNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/customer/notifications');
      if (response.data) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.warn('[useCustomerNotifications] Fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.put(`/customer/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.warn('[useCustomerNotifications] markAsRead error:', error.message);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  return { notifications, unreadCount, loading, fetchNotifications, markAsRead };
};

export default useCustomerNotifications;
