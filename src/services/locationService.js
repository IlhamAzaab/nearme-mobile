import apiClient from './api';

const locationService = {
  async updateDriverLocation(latitude, longitude) {
    return apiClient.post('/location/update', { latitude, longitude });
  },

  async getDriverLocation(driverId) {
    return apiClient.get(`/location/driver/${driverId}`);
  },

  async getNearbyDrivers(latitude, longitude, radius = 5) {
    return apiClient.post('/location/nearby-drivers', { 
      latitude, 
      longitude, 
      radius 
    });
  },

  async geocodeAddress(address) {
    return apiClient.post('/location/geocode', { address });
  },

  async reverseGeocode(latitude, longitude) {
    return apiClient.post('/location/reverse-geocode', { latitude, longitude });
  },

  async calculateDistance(origin, destination) {
    return apiClient.post('/location/distance', { origin, destination });
  },

  async getOptimizedRoute(waypoints) {
    return apiClient.post('/location/optimize-route', { waypoints });
  },
};

export default locationService;
