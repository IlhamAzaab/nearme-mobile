import React, { useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useDriverDeliveryNotifications } from '../../context/DriverDeliveryNotificationContext';

/**
 * DriverSocketConnector - Manages socket connection for driver
 */
const DriverSocketConnector = ({ driverId, location }) => {
  const { on, off, emit, isConnected } = useSocket();
  const { addNotification } = useDriverDeliveryNotifications();

  // Send location updates to server
  useEffect(() => {
    if (!isConnected || !location) return;

    emit('driver_location_update', {
      driverId,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date().toISOString(),
    });
  }, [isConnected, location, driverId, emit]);

  // Listen for delivery requests
  useEffect(() => {
    if (!isConnected) return;

    const handleDeliveryRequest = (data) => {
      addNotification({
        id: data.deliveryId,
        title: 'New Delivery! 🛵',
        message: `${data.restaurantName} → ${data.customerAddress}`,
        type: 'delivery',
        data,
      });
    };

    const handleDeliveryCancelled = (data) => {
      addNotification({
        title: 'Delivery Cancelled',
        message: `Delivery #${data.deliveryId} was cancelled`,
        type: 'warning',
        data,
      });
    };

    on('delivery_request', handleDeliveryRequest);
    on('delivery_cancelled', handleDeliveryCancelled);

    return () => {
      off('delivery_request', handleDeliveryRequest);
      off('delivery_cancelled', handleDeliveryCancelled);
    };
  }, [isConnected, on, off, addNotification]);

  return null;
};

export default DriverSocketConnector;
