import React, { useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';

/**
 * AdminSocketConnector - Connects admin/restaurant to realtime updates
 */
const AdminSocketConnector = ({ restaurantId }) => {
  const { on, off, isConnected } = useSocket();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!isConnected || !restaurantId) return;

    const handleNewOrder = (data) => {
      addNotification({
        title: 'New Order! 🎉',
        message: `Order #${data.orderId} received - ETB ${data.total}`,
        type: 'success',
        data,
      });
    };

    const handleOrderCancelled = (data) => {
      addNotification({
        title: 'Order Cancelled',
        message: `Order #${data.orderId} was cancelled`,
        type: 'warning',
        data,
      });
    };

    const handleDriverAssigned = (data) => {
      addNotification({
        title: 'Driver Assigned',
        message: `Driver ${data.driverName} assigned to order #${data.orderId}`,
        type: 'info',
        data,
      });
    };

    on('new_order', handleNewOrder);
    on('order_cancelled', handleOrderCancelled);
    on('driver_assigned', handleDriverAssigned);

    return () => {
      off('new_order', handleNewOrder);
      off('order_cancelled', handleOrderCancelled);
      off('driver_assigned', handleDriverAssigned);
    };
  }, [isConnected, restaurantId, on, off, addNotification]);

  return null;
};

export default AdminSocketConnector;
