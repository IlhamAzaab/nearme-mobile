import apiClient from './api';

const authService = {
  async login(email, password) {
    return apiClient.post('/auth/login', { email, password });
  },

  async signup(email, password, name) {
    return apiClient.post('/auth/signup', { email, password, name });
  },

  async logout() {
    return apiClient.post('/auth/logout');
  },

  async verifyEmail(token) {
    return apiClient.post('/auth/verify-email', { token });
  },

  async forgotPassword(email) {
    return apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token, password) {
    return apiClient.post('/auth/reset-password', { token, password });
  },

  async refreshToken(refreshToken) {
    return apiClient.post('/auth/refresh-token', { refreshToken });
  },

  async getCurrentUser() {
    return apiClient.get('/auth/me');
  },
};

export default authService;
