import React, { useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useManagerNotifications } from '../../context/ManagerNotificationContext';

/**
 * ManagerSocketConnector - Connects manager to realtime events
 */
const ManagerSocketConnector = ({ managerId }) => {
  const { on, off, isConnected } = useSocket();
  const { addNotification } = useManagerNotifications();

  useEffect(() => {
    if (!isConnected) return;

    const handleNewRestaurant = (data) => {
      addNotification({
        title: 'New Restaurant Registration',
        message: `${data.restaurantName} has registered and needs approval`,
        type: 'restaurant',
        data,
      });
    };

    const handleDriverRegistration = (data) => {
      addNotification({
        title: 'New Driver Application',
        message: `${data.driverName} has applied to be a driver`,
        type: 'driver',
        data,
      });
    };

    const handleWithdrawalRequest = (data) => {
      addNotification({
        title: 'Withdrawal Request',
        message: `${data.userName} requested ETB ${data.amount} withdrawal`,
        type: 'payment',
        data,
      });
    };

    const handleSystemAlert = (data) => {
      addNotification({
        title: data.title || 'System Alert',
        message: data.message,
        type: 'warning',
        data,
      });
    };

    on('new_restaurant', handleNewRestaurant);
    on('driver_registration', handleDriverRegistration);
    on('withdrawal_request', handleWithdrawalRequest);
    on('system_alert', handleSystemAlert);

    return () => {
      off('new_restaurant', handleNewRestaurant);
      off('driver_registration', handleDriverRegistration);
      off('withdrawal_request', handleWithdrawalRequest);
      off('system_alert', handleSystemAlert);
    };
  }, [isConnected, on, off, addNotification]);

  return null;
};

export default ManagerSocketConnector;
