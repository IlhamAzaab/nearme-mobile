/**
 * OrderTrackingService
 * 
 * Tracks which orders have been displayed to the admin to prevent
 * showing the same order multiple times.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@nearme_displayed_orders';

class OrderTrackingService {
  constructor() {
    this._displayedOrders = new Set();
    this._initialized = false;
  }

  /**
   * Initialize the service by loading displayed orders from storage
   */
  async initialize() {
    if (this._initialized) return;
    
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const orders = JSON.parse(stored);
        this._displayedOrders = new Set(orders);
        console.log(`[OrderTracking] Loaded ${this._displayedOrders.size} displayed orders`);
      }
      this._initialized = true;
    } catch (err) {
      console.error('[OrderTracking] Initialize error:', err);
      this._displayedOrders = new Set();
      this._initialized = true;
    }
  }

  /**
   * Check if an order has been displayed
   * @param {string} orderId - The order ID to check
   * @returns {boolean} true if already displayed
   */
  async hasBeenDisplayed(orderId) {
    if (!this._initialized) await this.initialize();
    return this._displayedOrders.has(String(orderId));
  }

  /**
   * Mark an order as displayed
   * @param {string} orderId - The order ID to mark
   */
  async markAsDisplayed(orderId) {
    if (!this._initialized) await this.initialize();
    
    this._displayedOrders.add(String(orderId));
    await this._persist();
    console.log(`[OrderTracking] Marked order ${orderId} as displayed`);
  }

  /**
   * Mark an order as handled (accepted/rejected) - removes from displayed set
   * @param {string} orderId - The order ID to remove
   */
  async markAsHandled(orderId) {
    if (!this._initialized) await this.initialize();
    
    this._displayedOrders.delete(String(orderId));
    await this._persist();
    console.log(`[OrderTracking] Removed order ${orderId} from tracking`);
  }

  /**
   * Clear all displayed orders (useful for testing or logout)
   */
  async clearAll() {
    this._displayedOrders.clear();
    await this._persist();
    console.log('[OrderTracking] Cleared all displayed orders');
  }

  /**
   * Get count of displayed orders
   */
  getDisplayedCount() {
    return this._displayedOrders.size;
  }

  /**
   * Persist the displayed orders set to AsyncStorage
   */
  async _persist() {
    try {
      const orders = Array.from(this._displayedOrders);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (err) {
      console.error('[OrderTracking] Persist error:', err);
    }
  }
}

export default new OrderTrackingService();
