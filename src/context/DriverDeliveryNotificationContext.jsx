import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabaseClient';

const DriverDeliveryNotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  activeDeliveryRequest: null,
  markAsRead: () => {},
  clearNotifications: () => {},
  acceptDelivery: () => {},
  rejectDelivery: () => {},
});

export const DriverDeliveryNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeDeliveryRequest, setActiveDeliveryRequest] = useState(null);

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const acceptDelivery = useCallback((deliveryId) => {
    setActiveDeliveryRequest(null);
    // TODO: Call delivery service to accept
  }, []);

  const rejectDelivery = useCallback((deliveryId) => {
    setActiveDeliveryRequest(null);
    // TODO: Call delivery service to reject
  }, []);

  // TODO: Set up Supabase realtime subscription for driver delivery notifications

  const value = {
    notifications,
    unreadCount,
    activeDeliveryRequest,
    addNotification,
    markAsRead,
    clearNotifications,
    acceptDelivery,
    rejectDelivery,
  };

  return (
    <DriverDeliveryNotificationContext.Provider value={value}>
      {children}
    </DriverDeliveryNotificationContext.Provider>
  );
};

export const useDriverDeliveryNotifications = () =>
  useContext(DriverDeliveryNotificationContext);

export default DriverDeliveryNotificationContext;
