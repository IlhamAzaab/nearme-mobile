import React, { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';

/**
 * AdminSocketConnector - Connects admin/restaurant to realtime updates
 * Handles socket events and updates Orders screen via DeviceEventEmitter
 */
const ADMIN_ORDER_STATUS_EVENT = "admin:order_status_changed";

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
      const orderId = data?.order_id || data?.orderId;
      
      addNotification({
        title: 'Order Cancelled',
        message: `Order #${orderId} was cancelled by customer`,
        type: 'warning',
        data,
      });

      // Emit event to Orders screen to update the orders list
      // This will trigger removal or status update of the cancelled order
      if (orderId) {
        DeviceEventEmitter.emit(ADMIN_ORDER_STATUS_EVENT, {
          orderId: String(orderId),
          status: 'cancelled',
          reason: data?.cancelled_reason || data?.reason || 'Customer cancelled',
          source: 'orders_socket',
        });
      }
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
