import React, { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useDriverDeliveryNotifications } from '../../context/DriverDeliveryNotificationContext';

/**
 * DriverDeliveryNotificationListener - Listens for new delivery requests via Supabase realtime
 */
const DriverDeliveryNotificationListener = ({ driverId }) => {
  const { addNotification } = useDriverDeliveryNotifications();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-deliveries-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_requests',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          addNotification({
            id: payload.new.id,
            title: 'New Delivery Request!',
            message: `Pickup from ${payload.new.restaurant_name || 'restaurant'}`,
            type: 'delivery',
            data: payload.new,
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [driverId, addNotification]);

  return null;
};

export default DriverDeliveryNotificationListener;
