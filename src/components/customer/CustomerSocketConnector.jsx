import React, { useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';

/**
 * CustomerSocketConnector - Connects customer to realtime updates
 * Place this inside CustomerNavigator to auto-connect
 */
const CustomerSocketConnector = ({ userId }) => {
  const { on, off, isConnected } = useSocket();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!isConnected) return;

    const handleOrderUpdate = (data) => {
      addNotification({
        title: 'Order Update',
        message: data.message || `Order #${data.orderId} status changed to ${data.status}`,
        type: 'delivery',
        data,
      });
    };

    const handlePromotion = (data) => {
      addNotification({
        title: data.title || 'Special Offer!',
        message: data.message,
        type: 'info',
        data,
      });
    };

    on('order_update', handleOrderUpdate);
    on('promotion', handlePromotion);

    return () => {
      off('order_update', handleOrderUpdate);
      off('promotion', handlePromotion);
    };
  }, [isConnected, on, off, addNotification]);

  return null; // Renderless component
};

export default CustomerSocketConnector;
