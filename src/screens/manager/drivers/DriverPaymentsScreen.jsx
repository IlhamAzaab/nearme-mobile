import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
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

const DRIVER_DRAWER_ITEMS = [
  {
    route: "ManagerDeposits",
    label: "Driver Deposits",
    icon: "receipt-outline",
    tabTarget: "Drivers",
  },
  { route: "DriverPayments", label: "Driver Payments", icon: "wallet-outline" },
  {
    route: "DriverManagement",
    label: "Driver Management",
    icon: "people-outline",
  },
  {
    route: "DriverVerification",
    label: "Verify Driver",
    icon: "checkmark-circle-outline",
  },
  { route: "AddDriver", label: "Add Driver", icon: "person-add-outline" },
];

const DriverPaymentsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [summary, setSummary] = useState({
    total_to_pay: 0,
    paid_today: 0,
    driver_count: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [summaryRes, driversRes] = await Promise.all([
        fetch(`${API_URL}/manager/driver-payments/summary`, { headers }),
        fetch(`${API_URL}/manager/driver-payments/drivers`, { headers }),
      ]);
      const summaryData = await summaryRes.json();
      const driversData = await driversRes.json();
      if (summaryData.success) setSummary(summaryData.summary);
      if (driversData.success) setDrivers(driversData.drivers);
    } catch (error) {
      console.error("Failed to fetch driver payments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDrivers = drivers.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.full_name || "").toLowerCase().includes(q) ||
      (d.user_name || "").toLowerCase().includes(q) ||
      (d.phone || "").includes(q)
    );
  });

  const renderDriver = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("ProcessDriverPayment", { driverId: item.id })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.profile_photo_url ? (
            <Image
              source={{ uri: item.profile_photo_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(item.full_name || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={8} color="#fff" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.full_name || "Unknown Driver"}
            </Text>
            {item.is_verified && (
              <View style={styles.verifiedTag}>
                <Text style={styles.verifiedTagText}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {item.phone || "No phone"} · {item.delivery_count} deliveries
          </Text>
        </View>

        {/* Amount */}
        <View style={styles.amountCol}>
          <Text
            style={[
              styles.amount,
              { color: item.withdrawal_balance > 0 ? "#DC2626" : "#06C168" },
            ]}
          >
            Rs.{item.withdrawal_balance?.toFixed(2)}
          </Text>
          <Text style={styles.pendingLabel}>pending</Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Driver Payments"
        showBack
        onMenuPress={() => setDrawerOpen(true)}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Driver Management"
        items={DRIVER_DRAWER_ITEMS}
        activeRoute={route.name}
        navigation={navigation}
      />
      <View style={styles.headerPad}>
        {/* Summary Cards */}
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
              {summary.driver_count} active driver
              {summary.driver_count !== 1 ? "s" : ""}
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: "#EDFBF2", borderColor: "#9EEBBE" },
            ]}
          >
            <View style={styles.summaryIconRow}>
              <Ionicons name="card-outline" size={16} color="#06C168" />
              <Text style={styles.summaryLabel}>Paid Today</Text>
            </View>
            <Text style={[styles.summaryValue, { color: "#06C168" }]}>
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
            placeholder="Search drivers..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        <Text style={styles.sectionTitle}>
          <Ionicons name="people-outline" size={16} color="#13ECB9" /> Drivers (
          {filteredDrivers.length})
        </Text>
      </View>

      <FlatList
        data={filteredDrivers}
        renderItem={renderDriver}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color="#13ECB9" />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="person-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "No drivers match your search"
                  : "No active drivers found"}
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
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
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
    fontSize: 13,
    fontWeight: "700",
    color: "#111816",
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
  avatarWrap: { position: "relative", marginRight: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(19,236,185,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  avatarText: { fontSize: 17, fontWeight: "700", color: "#13ECB9" },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#06C168",
    borderRadius: 8,
    padding: 2,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 13, fontWeight: "700", color: "#111816", flexShrink: 1 },
  verifiedTag: {
    backgroundColor: "#EDFBF2",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verifiedTagText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#06C168",
    textTransform: "uppercase",
  },
  meta: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  amountCol: { alignItems: "flex-end", marginRight: 6 },
  amount: { fontSize: 13, fontWeight: "700" },
  pendingLabel: { fontSize: 9, color: "#9CA3AF" },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },
});

export default DriverPaymentsScreen;
