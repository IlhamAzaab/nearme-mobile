import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
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
import { getAccessToken } from "../../../lib/authStorage";
import { API_URL } from "../../../config/env";

const CustomerDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const customerId = route.params?.customerId;

  const [loading, setLoading] = useState(true);
  const [detailData, setDetailData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [customerId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        setDetailData({ error: "No authentication token found. Please log in again." });
        setLoading(false);
        return;
      }

      const url = `${API_URL}/manager/reports/customers/${customerId}/details?limit=50`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();

      if (!res.ok) {
        setDetailData({ error: json?.message || "HTTP error " + res.status });
        setLoading(false);
        return;
      }

      setDetailData(json);
    } catch (err) {
      setDetailData({ error: "Fetch failed: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Permanently Remove Customer",
      `Remove this customer? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const token = await getAccessToken();
            try {
              setActionLoading(true);
              const res = await fetch(
                `${API_URL}/manager/reports/customers/${customerId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              const json = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(json?.message || "Failed to remove customer");
              }
              Alert.alert("Success", "Customer removed.");
              navigation.goBack();
            } catch (err) {
              Alert.alert("Action Failed", err.message || "Unable to remove customer");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F766E" />
        </View>
      </SafeAreaView>
    );
  }

  if (detailData?.error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={{ color: "#EF4444", padding: 20, textAlign: "center", fontSize: 14 }}>{detailData.error}</Text>
          <TouchableOpacity onPress={fetchDetails} style={{ backgroundColor: "#0F766E", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { customer, summary, orders, isAuthUserOnly } = detailData || {};

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAuthUserOnly ? "Incomplete Profile" : "Customer Details"}
        </Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.name}>{customer?.username || "Unnamed Customer"}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value} selectable>{customer?.email || "N/A"}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone</Text>
            <TouchableOpacity onPress={() => {
              if (customer?.phone) Linking.openURL(`tel:${customer.phone}`);
            }}>
              <Text style={[styles.value, styles.phoneValue]} selectable>
                {customer?.phone || "N/A"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value} selectable>{customer?.address || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>City</Text>
            <Text style={styles.value}>{customer?.city || "N/A"}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Account Created</Text>
            <Text style={styles.value}>
              {customer?.created_at ? new Date(customer.created_at).toLocaleString() : "N/A"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Total Orders</Text>
            <Text style={styles.value}>{summary?.total_orders || 0}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Total Spent</Text>
            <Text style={styles.value}>Rs.{Number(summary?.total_spent || 0).toFixed(2)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Manager Earnings</Text>
            <Text style={styles.value}>Rs.{Number(summary?.manager_earnings || 0).toFixed(2)}</Text>
          </View>

          {(!summary?.total_orders || summary.total_orders === 0) && (
            <TouchableOpacity 
              style={[styles.deleteBtn, actionLoading && { opacity: 0.5 }]} 
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Text style={styles.deleteBtnText}>
                {actionLoading ? "Removing..." : "Delete Account"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <View style={styles.card}>
          {(!orders || orders.length === 0) ? (
            <Text style={styles.emptyText}>No orders yet.</Text>
          ) : (
            orders.map((order, index) => (
              <View 
                key={order.id} 
                style={[styles.orderRow, index === orders.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderTitle}>#{order.order_number || order.id?.slice(-6)}</Text>
                  <Text style={styles.orderSub}>{order.restaurant_name || "Restaurant"}</Text>
                  <Text style={styles.orderSub}>
                    {order.placed_at ? new Date(order.placed_at).toLocaleString() : "N/A"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.orderAmount}>Rs.{Number(order.total_amount || 0).toFixed(0)}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{order.status || "N/A"}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  name: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 16 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  label: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  value: { fontSize: 13, color: "#0F172A", fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  phoneValue: { color: "#0F766E", textDecorationLine: "underline" },
  deleteBtn: {
    marginTop: 16,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12, marginLeft: 4 },
  emptyText: { fontSize: 13, color: "#64748B", fontStyle: "italic", textAlign: "center" },
  orderRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  orderTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  orderSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  orderAmount: { fontSize: 14, fontWeight: "700", color: "#0F766E" },
  statusBadge: {
    marginTop: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: "700", color: "#475569", textTransform: "uppercase" },
});

export default CustomerDetailsScreen;
