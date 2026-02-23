import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import supabase from "../services/supabaseClient";

const OrderContext = createContext(null);

// ─── Status Constants (shared across app) ─────────────────────────────────
export const ACTIVE_STATUSES = [
  "placed", "accepted", "preparing", "ready", "picked_up", "on_the_way",
  "PLACED", "DRIVER_ACCEPTED", "RECEIVED", "PICKED_UP", "ON_THE_WAY",
];
export const PAST_STATUSES = [
  "delivered", "cancelled", "rejected",
  "DELIVERED", "CANCELLED", "REJECTED",
];

export function OrderProvider({ children }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNewOrder, setHasNewOrder] = useState(false); // green dot badge
  const [newOrderIds, setNewOrderIds] = useState(new Set()); // "NEW" badge per order
  const [ordersBadgeCount, setOrdersBadgeCount] = useState(0); // active order count for tab
  const isInitialized = useRef(false);

  // ── Fetch orders from API ────────────────────────────────────────────────
  const fetchOrders = useCallback(async (mode = "silent") => {
    // mode: "initial" (spinner), "refresh" (pull-to-refresh), "silent" (background)
    try {
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "initial") setLoading(true);

      const token = await AsyncStorage.getItem("token");
      if (!token || token === "null") return false;

      const res = await fetch(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const list = data.orders || data || [];
        const orderList = Array.isArray(list) ? list : [];
        setOrders(orderList);

        // Update badge count (active orders)
        const activeCount = orderList.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
        setOrdersBadgeCount(activeCount);

        return true;
      }
      return false;
    } catch (e) {
      console.log("OrderContext fetchOrders error:", e);
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Add a freshly placed order (called from CheckoutScreen) ──────────────
  const addNewOrder = useCallback((order) => {
    if (!order?.id) return;

    setOrders((prev) => {
      // Prevent duplicates
      if (prev.some((o) => o.id === order.id)) return prev;
      return [order, ...prev];
    });

    // Mark as new for badge + animation
    setNewOrderIds((prev) => new Set(prev).add(order.id));
    setHasNewOrder(true);

    // Update badge
    setOrdersBadgeCount((prev) => prev + 1);
  }, []);

  // ── Mark orders as seen (clear badges when user views orders) ────────────
  const markOrdersSeen = useCallback(() => {
    setHasNewOrder(false);
    // Clear "NEW" badges after a delay so animation finishes
    setTimeout(() => setNewOrderIds(new Set()), 3000);
  }, []);

  // ── Supabase Realtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;

    const setupRealtime = async () => {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) return;

      const channel = supabase
        .channel(`customer-orders-ctx-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === payload.new.id ? { ...o, ...payload.new } : o))
            );
            // Update badge count
            setOrders((current) => {
              const activeCount = current.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
              setOrdersBadgeCount(activeCount);
              return current;
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            // New order from realtime — add it
            if (payload.new) {
              addNewOrder(payload.new);
            }
            fetchOrders("silent");
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    };

    const cleanup = setupRealtime();
    return () => {
      cleanup.then?.((fn) => fn?.());
    };
  }, [fetchOrders, addNewOrder]);

  const value = {
    orders,
    loading,
    refreshing,
    hasNewOrder,
    newOrderIds,
    ordersBadgeCount,
    fetchOrders,
    addNewOrder,
    markOrdersSeen,
    setOrders,
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) {
    // Fallback for screens rendered before OrderProvider is ready
    return {
      orders: [],
      loading: false,
      refreshing: false,
      hasNewOrder: false,
      newOrderIds: new Set(),
      ordersBadgeCount: 0,
      fetchOrders: async () => false,
      addNewOrder: () => {},
      markOrdersSeen: () => {},
      setOrders: () => {},
    };
  }
  return context;
}
