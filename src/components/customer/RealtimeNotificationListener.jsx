import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../context/NotificationContext';

/**
 * RealtimeNotificationListener - Listens to Supabase realtime for order updates
 * Place inside CustomerNavigator
 */
const RealtimeNotificationListener = ({ userId }) => {
  const { addNotification } = useNotifications();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to order updates for this customer
    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          const order = payload.new;
          addNotification({
            title: 'Order Update',
            message: `Order #${order.id} is now ${order.status}`,
            type: 'delivery',
            data: { orderId: order.id, status: order.status },
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
  }, [userId, addNotification]);

  return null; // Renderless component
};

export default RealtimeNotificationListener;
