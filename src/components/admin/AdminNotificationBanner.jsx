import React from 'react';
import NotificationBar from '../common/NotificationBar';
import useAdminNotifications from '../../hooks/useAdminNotifications';

/**
 * AdminNotificationBanner - Shows important admin alerts (new orders, low stock, etc.)
 */
const AdminNotificationBanner = ({ restaurantId, onPress }) => {
  const { notifications, unreadCount } = useAdminNotifications(restaurantId);

  const latestUnread = notifications.find((n) => !n.read);

  if (!latestUnread) return null;

  return (
    <NotificationBar
      visible={true}
      message={latestUnread.message || `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`}
      type={latestUnread.type || 'info'}
      onPress={() => onPress?.(latestUnread)}
    />
  );
};

export default AdminNotificationBanner;
