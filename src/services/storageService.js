import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUTH_TOKEN: '@nearme_auth_token',
  USER: '@nearme_user',
  THEME: '@nearme_theme',
  ONBOARDING: '@nearme_onboarding_complete',
};

const storageService = {
  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage setItem error:', error);
      return false;
    }
  },

  async getItem(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage removeItem error:', error);
      return false;
    }
  },

  async clear() {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  },

  async getAllKeys() {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Storage getAllKeys error:', error);
      return [];
    }
  },

  // Auth specific helpers
  async saveAuthToken(token) {
    return this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  async getAuthToken() {
    return this.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async removeAuthToken() {
    return this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async saveUser(user) {
    return this.setItem(STORAGE_KEYS.USER, user);
  },

  async getUser() {
    return this.getItem(STORAGE_KEYS.USER);
  },

  async removeUser() {
    return this.removeItem(STORAGE_KEYS.USER);
  },
};

export { STORAGE_KEYS };
export default storageService;
