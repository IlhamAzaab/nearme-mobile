import React, { createContext, useContext, useState, useCallback } from 'react';

const ManagerNotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
});

export const ManagerNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [
      { ...notification, id: notification.id || Date.now(), read: false },
      ...prev,
    ]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };

  return (
    <ManagerNotificationContext.Provider value={value}>
      {children}
    </ManagerNotificationContext.Provider>
  );
};

export const useManagerNotifications = () =>
  useContext(ManagerNotificationContext);

export default ManagerNotificationContext;
