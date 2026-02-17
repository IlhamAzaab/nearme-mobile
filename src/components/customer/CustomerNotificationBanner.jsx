import React from 'react';
import NotificationBar from '../common/NotificationBar';
import useCustomerNotifications from '../../hooks/useCustomerNotifications';

/**
 * CustomerNotificationBanner - Shows active order or promo notifications
 */
const CustomerNotificationBanner = ({ onPress }) => {
  const { notifications, unreadCount } = useCustomerNotifications();

  // Show the latest unread notification
  const latestUnread = notifications.find((n) => !n.read);

  if (!latestUnread) return null;

  return (
    <NotificationBar
      visible={true}
      message={latestUnread.message || latestUnread.title}
      type={latestUnread.type || 'info'}
      onPress={() => onPress?.(latestUnread)}
    />
  );
};

export default CustomerNotificationBanner;
