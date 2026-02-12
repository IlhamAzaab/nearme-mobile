import * as Notifications from 'expo-notifications';
import apiClient from './api';

const notificationService = {
  async registerForPushNotifications() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      throw new Error('Push notification permission denied');
    }
    
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  },

  async savePushToken(token) {
    return apiClient.post('/notifications/token', { token });
  },

  async getNotifications() {
    return apiClient.get('/notifications');
  },

  async markAsRead(notificationId) {
    return apiClient.patch(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead() {
    return apiClient.post('/notifications/read-all');
  },

  async deleteNotification(notificationId) {
    return apiClient.delete(`/notifications/${notificationId}`);
  },

  configureNotifications() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  },
};

export default notificationService;
