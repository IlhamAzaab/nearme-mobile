import React, { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../context/NotificationContext';

/**
 * DriverRealtimeNotificationListener - Listens for general driver notifications
 */
const DriverRealtimeNotificationListener = ({ driverId }) => {
  const { addNotification } = useNotifications();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-notifications-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${driverId}`,
        },
        (payload) => {
          addNotification({
            id: payload.new.id,
            title: payload.new.title,
            message: payload.new.message,
            type: payload.new.type || 'info',
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

export default DriverRealtimeNotificationListener;
