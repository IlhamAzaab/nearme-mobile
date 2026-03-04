import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerDrawer from "../../../components/manager/ManagerDrawer";
import ManagerHeader from "../../../components/manager/ManagerHeader";
import { API_URL } from "../../../config/env";

const ADMIN_DRAWER_ITEMS = [
  {
    route: "AdminPayments",
    label: "Admin Payments",
    icon: "wallet-outline",
    tabTarget: "Admins",
  },
  { route: "AddAdmin", label: "Add Admin", icon: "person-add-outline" },
  {
    route: "AdminManagement",
    label: "Admin Management",
    icon: "people-outline",
  },
  {
    route: "RestaurantManagement",
    label: "Restaurant Management",
    icon: "restaurant-outline",
  },
  {
    route: "PendingRestaurants",
    label: "Pending Restaurants",
    icon: "time-outline",
  },
];

const AdminPaymentsScreen = () => {
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [summary, setSummary] = useState({
    total_to_pay: 0,
    paid_today: 0,
    restaurant_count: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [summaryRes, restaurantsRes] = await Promise.all([
        fetch(`${API_URL}/manager/admin-payments/summary`, { headers }),
        fetch(`${API_URL}/manager/admin-payments/restaurants`, { headers }),
      ]);
      const summaryData = await summaryRes.json();
      const restaurantsData = await restaurantsRes.json();
      if (summaryData.success) setSummary(summaryData.summary);
      if (restaurantsData.success) setRestaurants(restaurantsData.restaurants);
    } catch (error) {
      console.error("Failed to fetch admin payments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRestaurants = restaurants.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(q) ||
      (r.admin_email || "").toLowerCase().includes(q) ||
      (r.phone || "").includes(q)
    );
  });

  const renderRestaurant = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("ProcessAdminPayment", { restaurantId: item.id })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>
                {(item.name || "R").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.admin_email || "No admin email"}
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{item.order_count || 0} orders</Text>
            <Text style={styles.statText}>
              Earned: Rs.{item.total_earnings?.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.amountCol}>
          <Text
            style={[
              styles.amount,
              { color: item.withdrawal_balance > 0 ? "#DC2626" : "#059669" },
            ]}
          >
            Rs.{item.withdrawal_balance?.toFixed(2)}
          </Text>
          <Text style={styles.balanceLabel}>Balance</Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Admin Payments"
        onMenuPress={() => setDrawerOpen(true)}
        onRefresh={fetchData}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Restaurant & Admin"
        items={ADMIN_DRAWER_ITEMS}
        activeRoute="AdminPayments"
        navigation={navigation}
      />
      <View style={styles.headerPad}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
            ]}
          >
            <View style={styles.summaryIconRow}>
              <Ionicons name="wallet-outline" size={16} color="#EF4444" />
              <Text style={styles.summaryLabel}>Total to Pay</Text>
            </View>
            <Text style={[styles.summaryValue, { color: "#DC2626" }]}>
              Rs.{summary.total_to_pay?.toFixed(2)}
            </Text>
            <Text style={styles.summaryNote}>
              {summary.restaurant_count} restaurant
              {summary.restaurant_count !== 1 ? "s" : ""}
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
            ]}
          >
            <View style={styles.summaryIconRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="#22C55E"
              />
              <Text style={styles.summaryLabel}>Paid Today</Text>
            </View>
            <Text style={[styles.summaryValue, { color: "#16A34A" }]}>
              Rs.{summary.paid_today?.toFixed(2)}
            </Text>
            <Text style={styles.summaryNote}>Transfers completed today</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons
            name="search-outline"
            size={16}
            color="#94A3B8"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search restaurants..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        <Text style={styles.sectionTitle}>
          Restaurants ({filteredRestaurants.length})
        </Text>
      </View>

      <FlatList
        data={filteredRestaurants}
        renderItem={renderRestaurant}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color="#13ECB9" />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="storefront-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "No restaurants match your search"
                  : "No restaurants found"}
              </Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={fetchData}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerPad: { paddingHorizontal: 16, paddingTop: 8 },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1 },
  summaryIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: "500", color: "#6B7280" },
  summaryValue: { fontSize: 19, fontWeight: "700", marginBottom: 2 },
  summaryNote: { fontSize: 10, color: "#9CA3AF" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#111827" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },

  list: { paddingHorizontal: 16, paddingBottom: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  logoWrap: { marginRight: 10 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  logoText: { fontSize: 18, fontWeight: "700", color: "#3B82F6" },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 11, color: "#6B7280", marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 3 },
  statText: { fontSize: 10, color: "#9CA3AF" },
  amountCol: { alignItems: "flex-end", marginRight: 6 },
  amount: { fontSize: 14, fontWeight: "700" },
  balanceLabel: { fontSize: 9, color: "#9CA3AF" },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },
});

export default AdminPaymentsScreen;
