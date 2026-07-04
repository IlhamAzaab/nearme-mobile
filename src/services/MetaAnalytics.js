import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

class MetaAnalyticsService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      // Auto-initialization is already enabled in app.config.js, but explicitly initializing
      // ensures the SDK is ready before logging events.
      await Settings.initializeSDK();
      this.isInitialized = true;
      console.log('[MetaAnalytics] SDK Initialized Successfully');
    } catch (error) {
      console.error('[MetaAnalytics] Initialization Error:', error);
      // We don't throw here to ensure app keeps running even if analytics fail
    }
  }

  safeLogEvent(eventName, params = {}) {
    try {
      // In development, you might want to log this out
      if (__DEV__) {
        console.log(`[MetaAnalytics] Logging Event: ${eventName}`, params);
      }
      AppEventsLogger.logEvent(eventName, params);
    } catch (error) {
      console.error(`[MetaAnalytics] Error logging event ${eventName}:`, error);
    }
  }

  safeLogPurchase(amount, currency, params = {}) {
    try {
      if (__DEV__) {
        console.log(`[MetaAnalytics] Logging Purchase: ${amount} ${currency}`, params);
      }
      AppEventsLogger.logPurchase(amount, currency, params);
    } catch (error) {
      console.error(`[MetaAnalytics] Error logging purchase:`, error);
    }
  }

  logSearch({ searchString, contentType = 'food' }) {
    this.safeLogEvent(AppEventsLogger.AppEvents.Searched, {
      [AppEventsLogger.AppEventParams.SearchString]: searchString,
      [AppEventsLogger.AppEventParams.ContentType]: contentType,
    });
  }

  logViewContent({ id, name, category, price, currency = 'LKR' }) {
    this.safeLogEvent(AppEventsLogger.AppEvents.ViewedContent, {
      [AppEventsLogger.AppEventParams.ContentID]: String(id),
      [AppEventsLogger.AppEventParams.Content]: name,
      [AppEventsLogger.AppEventParams.ContentType]: category || 'food',
      [AppEventsLogger.AppEventParams.Currency]: currency,
      valueToSum: price ? Number(price) : 0,
    });
  }

  logAddToCart({ id, name, price, quantity = 1, currency = 'LKR' }) {
    this.safeLogEvent(AppEventsLogger.AppEvents.AddedToCart, {
      [AppEventsLogger.AppEventParams.ContentID]: String(id),
      [AppEventsLogger.AppEventParams.Content]: name,
      [AppEventsLogger.AppEventParams.ContentType]: 'food',
      [AppEventsLogger.AppEventParams.Currency]: currency,
      [AppEventsLogger.AppEventParams.NumItems]: quantity,
      valueToSum: price ? Number(price) * quantity : 0,
    });
  }

  logInitiateCheckout({ totalValue, numItems, currency = 'LKR' }) {
    this.safeLogEvent(AppEventsLogger.AppEvents.InitiatedCheckout, {
      [AppEventsLogger.AppEventParams.NumItems]: numItems,
      [AppEventsLogger.AppEventParams.Currency]: currency,
      valueToSum: totalValue ? Number(totalValue) : 0,
    });
  }

  logPurchase({ orderId, totalValue, numItems, currency = 'LKR' }) {
    this.safeLogPurchase(Number(totalValue), currency, {
      [AppEventsLogger.AppEventParams.OrderID]: String(orderId),
      [AppEventsLogger.AppEventParams.NumItems]: numItems,
      [AppEventsLogger.AppEventParams.ContentType]: 'food_order',
    });
  }

  logAddToWishlist({ id, name, price, currency = 'LKR' }) {
    this.safeLogEvent(AppEventsLogger.AppEvents.AddedToWishlist, {
      [AppEventsLogger.AppEventParams.ContentID]: String(id),
      [AppEventsLogger.AppEventParams.Content]: name,
      [AppEventsLogger.AppEventParams.ContentType]: 'food',
      [AppEventsLogger.AppEventParams.Currency]: currency,
      valueToSum: price ? Number(price) : 0,
    });
  }
}

export const MetaAnalytics = new MetaAnalyticsService();
