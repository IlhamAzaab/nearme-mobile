/**
 * OrderTrackingService
 * 
 * Tracks which orders have been displayed to the admin to prevent
 * showing the same order multiple times.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@nearme_displayed_orders';
const HANDLED_STORAGE_KEY = '@nearme_handled_orders';

class OrderTrackingService {
  constructor() {
    this._displayedOrders = new Set();
    this._handledOrders = new Set();
    this._initialized = false;
  }

  /**
   * Initialize the service by loading displayed and handled orders from storage
   */
  async initialize() {
    if (this._initialized) return;
    
    try {
      const [storedDisplayed, storedHandled] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(HANDLED_STORAGE_KEY),
      ]);

      if (storedDisplayed) {
        this._displayedOrders = new Set(JSON.parse(storedDisplayed));
        console.log(`[OrderTracking] Loaded ${this._displayedOrders.size} displayed orders`);
      }
      if (storedHandled) {
        this._handledOrders = new Set(JSON.parse(storedHandled));
        console.log(`[OrderTracking] Loaded ${this._handledOrders.size} handled orders`);
      }
      this._initialized = true;
    } catch (err) {
      console.error('[OrderTracking] Initialize error:', err);
      this._displayedOrders = new Set();
      this._handledOrders = new Set();
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
   * Check if an order has been handled
   * @param {string} orderId - The order ID to check
   * @returns {boolean} true if already handled
   */
  async hasBeenHandled(orderId) {
    if (!this._initialized) await this.initialize();
    return this._handledOrders.has(String(orderId));
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
   * Mark an order as handled (accepted/rejected) - removes from displayed set, adds to handled set
   * @param {string} orderId - The order ID to mark
   */
  async markAsHandled(orderId) {
    if (!this._initialized) await this.initialize();
    
    const key = String(orderId);
    this._displayedOrders.delete(key);
    
    // Add to handled list and cap size at 100 to prevent infinite growth
    this._handledOrders.add(key);
    if (this._handledOrders.size > 100) {
      const firstVal = this._handledOrders.values().next().value;
      this._handledOrders.delete(firstVal);
    }

    await this._persist();
    console.log(`[OrderTracking] Removed order ${orderId} from tracking & marked as handled`);
  }

  /**
   * Clear all displayed and handled orders (useful for testing or logout)
   */
  async clearAll() {
    this._displayedOrders.clear();
    this._handledOrders.clear();
    await this._persist();
    console.log('[OrderTracking] Cleared all displayed and handled orders');
  }

  /**
   * Get count of displayed orders
   */
  getDisplayedCount() {
    return this._displayedOrders.size;
  }

  /**
   * Persist the displayed and handled orders sets to AsyncStorage
   */
  async _persist() {
    try {
      const displayed = Array.from(this._displayedOrders);
      const handled = Array.from(this._handledOrders);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(displayed)),
        AsyncStorage.setItem(HANDLED_STORAGE_KEY, JSON.stringify(handled)),
      ]);
    } catch (err) {
      console.error('[OrderTracking] Persist error:', err);
    }
  }
}

export default new OrderTrackingService();
