import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

export default function ManagerOrderDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params;

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchOrderDetails = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token =
        (await getAccessToken()) || (await AsyncStorage.getItem("token"));
      if (!token) throw new Error("No authentication token");

      const res = await fetch(`${API_URL}/manager/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json().catch(() => ({}));

      if (res.ok && payload.order) {
        setOrderData(payload.order);
      } else {
        setErrorMessage(payload.message || "Failed to load order details");
      }
    } catch (err) {
      setErrorMessage(err?.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const handleDeleteOrder = async () => {
    Alert.alert(
      "Delete Order",
      "Are you sure? This will permanently delete the order and completely remove its associated earnings from manager, driver, and restaurant.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const token =
                (await getAccessToken()) || (await AsyncStorage.getItem("token"));
              const res = await fetch(`${API_URL}/manager/orders/${orderId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              
              if (res.ok) {
                Alert.alert("Success", "Order deleted successfully.");
                navigation.goBack();
              } else {
                const data = await res.json().catch(() => ({}));
                Alert.alert("Error", data.message || "Failed to delete order");
              }
            } catch (e) {
              Alert.alert("Error", "Server error while deleting order.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleCall = (phone) => {
    if (!phone) {
      Alert.alert("Notice", "No phone number available.");
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const formatTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDuration = (placed, delivered) => {
    if (!placed || !delivered) return "—";
    const d1 = new Date(placed).getTime();
    const d2 = new Date(delivered).getTime();
    if (isNaN(d1) || isNaN(d2)) return "—";
    const diff = Math.max(0, d2 - d1);
    const mins = Math.floor(diff / 60000);
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  };

  const fmt = (v) =>
    `Rs.${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#06C168" />
      </SafeAreaView>
    );
  }

  if (errorMessage || !orderData) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>{errorMessage || "Order not found"}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchOrderDetails}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: "#06C168", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{orderData.order_number}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status & Timing Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status & Timings</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Status</Text>
              <View style={[styles.statusBadge, { alignSelf: "flex-start", marginTop: 4 }]}>
                <Text style={[styles.statusText, { 
                  color: orderData.delivery_status === "delivered" ? "#15803D" :
                         orderData.delivery_status === "cancelled" || orderData.delivery_status === "rejected" || orderData.delivery_status === "failed" ? "#B91C1C" :
                         "#1D4ED8"
                }]}>
                  {orderData.delivery_status?.replace(/_/g, " ") || "—"}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Duration</Text>
              <Text style={[styles.value, { marginLeft: 0, marginTop: 4, fontSize: 15, fontWeight: "700" }]}>
                {calculateDuration(orderData.placed_at, orderData.delivered_at)}
              </Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Placed At</Text>
              <Text style={[styles.value, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                {formatTime(orderData.placed_at)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Delivered At</Text>
              <Text style={[styles.value, { marginLeft: 0, marginTop: 4, fontSize: 13 }]}>
                {formatTime(orderData.delivered_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>
              {orderData.customer_name || "—"}
              {orderData.customer_total_orders > 0 && (
                <Text style={{ color: "#6B7280", fontSize: 12 }}>
                  {" "}
                  ({orderData.customer_total_orders} Orders)
                </Text>
              )}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <TouchableOpacity onPress={() => handleCall(orderData.customers?.phone)}>
              <Text style={[styles.value, styles.linkText]}>
                {orderData.customers?.phone || "—"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Address</Text>
            <Text style={[styles.value, { flex: 1, textAlign: "right" }]}>
              {orderData.customers?.address || "—"}
            </Text>
          </View>
        </View>

        {/* Restaurant Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Restaurant Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{orderData.restaurant_name || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <TouchableOpacity onPress={() => handleCall(orderData.restaurant_phone)}>
              <Text style={[styles.value, styles.linkText]}>
                {orderData.restaurant_phone || "—"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Driver Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driver Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{orderData.driver_name || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <TouchableOpacity onPress={() => handleCall(orderData.driver_phone)}>
              <Text style={[styles.value, styles.linkText]}>
                {orderData.driver_phone || "—"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Food Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ordered Items</Text>
          {orderData.items?.length > 0 ? (
            orderData.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {item.quantity}x {item.food_name}
                  </Text>
                  {item.variant_name && (
                    <Text style={styles.itemDesc}>{item.variant_name}</Text>
                  )}
                </View>
                <Text style={styles.itemPrice}>
                  Rs. {parseFloat(item.total_price || 0).toFixed(2)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.itemDesc}>No items found</Text>
          )}
        </View>

        {/* Financial Breakdown */}
        <View style={styles.formulaCard}>
          <Text style={styles.formulaTitle}>FINANCIAL BREAKDOWN</Text>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaKey}>Food Subtotal</Text>
            <Text style={styles.formulaVal}>{fmt(orderData.subtotal)}</Text>
          </View>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaKey}>Delivery Fee</Text>
            <Text style={styles.formulaVal}>{fmt(orderData.delivery_fee)}</Text>
          </View>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaKey}>Service Fee</Text>
            <Text style={styles.formulaVal}>{fmt(orderData.service_fee)}</Text>
          </View>
          <View style={styles.formulaDivider} />
          
          <View style={styles.formulaRow}>
            <Text style={[styles.formulaKey, { fontWeight: "700" }]}>Total Collected</Text>
            <Text style={[styles.formulaVal, { fontWeight: "700" }]}>
              {fmt(orderData.total_amount)}
            </Text>
          </View>
          <View style={styles.formulaDivider} />

          <View style={styles.formulaRow}>
            <Text style={[styles.formulaKey, { color: "#FCA5A5" }]}>− Restaurant Pay</Text>
            <Text style={[styles.formulaVal, { color: "#FCA5A5" }]}>
              {fmt(orderData.admin_subtotal)}
            </Text>
          </View>
          <View style={styles.formulaRow}>
            <Text style={[styles.formulaKey, { color: "#FCA5A5" }]}>− Driver Pay</Text>
            <Text style={[styles.formulaVal, { color: "#FCA5A5" }]}>
              {fmt(orderData.driver_earning)}
            </Text>
          </View>
          <View style={styles.formulaDivider} />

          <View style={styles.formulaRow}>
            <Text style={[styles.formulaKey, { color: "#13EC80", fontWeight: "700" }]}>
              = Manager Earning
            </Text>
            <Text style={[styles.formulaVal, { color: "#13EC80", fontSize: 18, fontWeight: "800" }]}>
              {fmt(orderData.manager_earning)}
            </Text>
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteOrder}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteBtnText}>Delete Order</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  errorText: { color: "#DC2626", fontSize: 16, fontWeight: "600" },
  retryBtn: { marginTop: 16, backgroundColor: "#06C168", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 12 },
  
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  label: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  value: { fontSize: 14, color: "#1F2937", fontWeight: "500", marginLeft: 20 },
  linkText: { color: "#2563EB", textDecorationLine: "underline" },
  
  statusBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, color: "#4B5563", fontWeight: "700", textTransform: "capitalize" },
  
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 10 },

  itemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  itemName: { fontSize: 14, color: "#1F2937", fontWeight: "600" },
  itemDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  itemPrice: { fontSize: 14, color: "#1F2937", fontWeight: "700" },

  formulaCard: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  formulaTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  formulaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  formulaKey: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  formulaVal: { color: "#fff", fontWeight: "700", fontSize: 13 },
  formulaDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 8,
  },

  deleteBtn: {
    backgroundColor: "#DC2626",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  deleteBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
