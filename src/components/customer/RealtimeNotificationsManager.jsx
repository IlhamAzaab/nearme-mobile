import React from 'react';
import RealtimeNotificationListener from './RealtimeNotificationListener';
import CustomerSocketConnector from './CustomerSocketConnector';

/**
 * RealtimeNotificationsManager - Manages all realtime notification channels
 * Place at the top level of CustomerNavigator
 */
const RealtimeNotificationsManager = ({ userId }) => {
  return (
    <>
      <RealtimeNotificationListener userId={userId} />
      <CustomerSocketConnector userId={userId} />
    </>
  );
};

export default RealtimeNotificationsManager;
