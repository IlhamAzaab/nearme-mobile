import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  removeNotification: () => {},
  clearAll: () => {},
});

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationIdRef = useRef(0);

  const addNotification = useCallback((notification) => {
    const id = notification.id || ++notificationIdRef.current;
    const newNotification = {
      id,
      title: notification.title || '',
      message: notification.message || '',
      type: notification.type || 'info', // info, success, warning, error, delivery
      read: false,
      timestamp: new Date().toISOString(),
      data: notification.data || null,
      ...notification,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);

    return id;
  }, []);

  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === notificationId && !n.read) {
          return { ...n, read: true };
        }
        return n;
      })
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === notificationId);
      if (removed && !removed.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== notificationId);
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);

export default NotificationContext;
