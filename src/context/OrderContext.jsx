import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import supabase from "../services/supabaseClient";
import { getAccessToken } from "../lib/authStorage";

const OrderContext = createContext(null);

// ─── Status Constants (shared across app) ─────────────────────────────────
export const ACTIVE_STATUSES = [
  "placed", "pending", "accepted", "preparing", "ready", "picked_up", "on_the_way",
  "driver_accepted", "driver_assigned", "received",
];
export const PAST_STATUSES = [
  "delivered", "cancelled", "rejected", "failed",
];

// Helper to get the displayable status from an order object
// Priority: effective_status > delivery_status > status (normalised to lowercase)
export const getOrderStatus = (order) => {
  const normalize = (value) =>
    typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "_") : "";

  const raw = normalize(
    order?.effective_status ||
      order?.delivery_status ||
      order?.status ||
      order?.delivery?.status,
  );

  // Timestamp flags are the strongest source for historical orders.
  if (order?.cancelled_at || order?.cancellation_reason) return "cancelled";
  if (order?.delivered_at) return "delivered";

  if (raw) {
    const aliasMap = {
      accepted_by_driver: "driver_accepted",
      driveraccepted: "driver_accepted",
      on_theway: "on_the_way",
      onway: "on_the_way",
      pickedup: "picked_up",
      complete: "delivered",
      completed: "delivered",
      done: "delivered",
    };
    return aliasMap[raw] || raw;
  }

  // If backend omits explicit status, infer active states from payment_status.
  const paymentStatus = normalize(order?.payment_status);
  if (paymentStatus === "pending") return "pending";
  if (paymentStatus === "paid") return "accepted";

  return "placed";
};

function extractOrdersFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.orders)) return data.data.orders;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

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

      const token = (await getAccessToken()) || (await AsyncStorage.getItem("token"));
      if (!token || token === "null") return false;

      // Fetch active + past explicitly so heavy active traffic does not hide history.
      const [activeRes, pastRes] = await Promise.all([
        fetch(`${API_BASE_URL}/orders/my-orders?status=active&limit=200&offset=0`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/orders/my-orders?status=past&limit=200&offset=0`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [activeData, pastData] = await Promise.all([
        activeRes.json().catch(() => ({})),
        pastRes.json().catch(() => ({})),
      ]);

      // Fallback to legacy endpoint if filtered endpoints fail.
      let orderList = [];
      if (activeRes.ok || pastRes.ok) {
        const merged = [
          ...extractOrdersFromResponse(activeData),
          ...extractOrdersFromResponse(pastData),
        ];

        const deduped = new Map();
        merged.forEach((order) => {
          if (order?.id) deduped.set(order.id, order);
        });
        orderList = Array.from(deduped.values());
      } else {
        const res = await fetch(`${API_BASE_URL}/orders/my-orders?limit=400&offset=0`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return false;
        orderList = extractOrdersFromResponse(data);
      }

      // For active orders, also fetch /delivery-status to get effective_status
      const activeIds = orderList
        .filter((o) => ACTIVE_STATUSES.includes(getOrderStatus(o)))
        .map((o) => o.id)
        .slice(0, 10); // cap at 10 to avoid too many requests

      if (activeIds.length > 0) {
        const results = await Promise.allSettled(
          activeIds.map(async (id) => {
            try {
              const r = await fetch(`${API_BASE_URL}/orders/${id}/delivery-status`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!r.ok) return null;
              const d = await r.json().catch(() => null);
              if (!d) return null;
              return { id, effective_status: d.effective_status || d.delivery_status || d.status || null };
            } catch { return null; }
          }),
        );
        // Merge effective_status back into the order objects
        const statusMap = {};
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value?.effective_status) {
            statusMap[r.value.id] = r.value.effective_status;
          }
        });
        orderList.forEach((o) => {
          if (statusMap[o.id]) o.effective_status = statusMap[o.id];
        });
      }

      // Keep latest orders first to match customer expectation.
      orderList.sort((a, b) => {
        const aTime = new Date(a?.placed_at || a?.created_at || 0).getTime();
        const bTime = new Date(b?.placed_at || b?.created_at || 0).getTime();
        return bTime - aTime;
      });

      setOrders(orderList);

      // Update badge count (active orders)
      const activeCount = orderList.filter((o) => ACTIVE_STATUSES.includes(getOrderStatus(o))).length;
      setOrdersBadgeCount(activeCount);

      return true;
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
            // Re-fetch to get effective_status from delivery-status endpoint
            fetchOrders("silent");
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

  // ── Background polling: keep active orders in sync (every 10s) ──────────
  useEffect(() => {
    const hasActive = orders.some((o) => ACTIVE_STATUSES.includes(getOrderStatus(o)));
    if (!hasActive) return;

    const interval = setInterval(() => fetchOrders("silent"), 10000);
    return () => clearInterval(interval);
  }, [orders, fetchOrders]);

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
