import apiClient from './api';

const deliveryService = {
  async getDeliveries(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return apiClient.get(`/deliveries?${query}`);
  },

  async getDeliveryById(id) {
    return apiClient.get(`/deliveries/${id}`);
  },

  async createDelivery(deliveryData) {
    return apiClient.post('/deliveries', deliveryData);
  },

  async updateDelivery(id, updates) {
    return apiClient.patch(`/deliveries/${id}`, updates);
  },

  async cancelDelivery(id) {
    return apiClient.post(`/deliveries/${id}/cancel`);
  },

  async acceptDelivery(id) {
    return apiClient.post(`/deliveries/${id}/accept`);
  },

  async completeDelivery(id) {
    return apiClient.post(`/deliveries/${id}/complete`);
  },

  async getAvailableDeliveries(location) {
    return apiClient.post('/deliveries/available', { location });
  },

  async getDriverActiveDeliveries() {
    return apiClient.get('/deliveries/driver/active');
  },

  async getDeliveryHistory() {
    return apiClient.get('/deliveries/history');
  },
};

export default deliveryService;
