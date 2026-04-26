import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  {
    route: "DriverRenewedDocuments",
    label: "Renewed Documents",
    icon: "document-text-outline",
  },
  { route: "AddDriver", label: "Add Driver", icon: "person-add-outline" },
];

const statusColors = {
  active: { bg: "#E6F9EE", text: "#06C168" },
  pending: { bg: "#FFF7ED", text: "#D97706" },
  suspended: { bg: "#FFF7ED", text: "#EA580C" },
  rejected: { bg: "#FEF2F2", text: "#DC2626" },
  default: { bg: "#F3F4F6", text: "#6B7280" },
};

const DriverManagementScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    fetchDrivers();
  }, [statusFilter, search]);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(
        `${API_URL}/manager/drivers?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) {
        setDrivers(data.drivers || []);
      }
    } catch (err) {
      console.error("Failed to load drivers:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const updateStatus = async (driverId, nextStatus) => {
    setActionLoading(driverId);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/drivers/${driverId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrivers((prev) =>
          prev.map((d) =>
            d.id === driverId ? { ...d, driver_status: nextStatus } : d,
          ),
        );
      } else {
        Alert.alert("Error", data?.message || "Failed to update status");
      }
    } catch (err) {
      Alert.alert("Error", "Network error while updating status");
    } finally {
      setActionLoading("");
    }
  };

  const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : "-");

  const getStatusColor = (status) =>
    statusColors[status] || statusColors.default;

  const renderDriver = ({ item }) => {
    const sc = getStatusColor(item.driver_status);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(item.full_name || "D")[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>
              {item.full_name || "(Not provided)"}
            </Text>
            <Text style={styles.email}>{item.email}</Text>
            <Text style={styles.meta}>
              {item.phone || "-"} · {item.driver_type || "-"} ·{" "}
              {item.city || "-"}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>
              {item.driver_status || "unknown"}
            </Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardMeta}>
            Profile: {item.profile_completed ? "Completed" : "Incomplete"} ·
            Created: {formatDate(item.created_at)}
          </Text>
          <View style={styles.actionRow}>
            {item.driver_status !== "active" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#06C168" }]}
                onPress={() => updateStatus(item.id, "active")}
                disabled={actionLoading === item.id}
              >
                <Text style={styles.actionBtnText}>
                  {actionLoading === item.id ? "..." : "Activate"}
                </Text>
              </TouchableOpacity>
            )}
            {item.driver_status !== "suspended" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#EA580C" }]}
                onPress={() => updateStatus(item.id, "suspended")}
                disabled={actionLoading === item.id}
              >
                <Text style={styles.actionBtnText}>
                  {actionLoading === item.id ? "..." : "Suspend"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Drivers"
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

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons
            name="search-outline"
            size={16}
            color="#94A3B8"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {["all", "active", "pending", "suspended", "rejected"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              statusFilter === f && styles.filterActive,
            ]}
            onPress={() => setStatusFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchDrivers}>
          <Ionicons name="refresh" size={16} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={drivers}
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
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No drivers found</Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={fetchDrivers}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#1F2937" },
  subtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },

  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },

  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
    alignItems: "center",
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  filterActive: { backgroundColor: "#4F46E5" },
  filterText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  filterTextActive: { color: "#fff" },
  refreshBtn: { padding: 6, marginLeft: "auto" },

  list: { paddingHorizontal: 16, paddingBottom: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTop: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(19,236,185,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 17, fontWeight: "700", color: "#13ECB9" },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700", color: "#111827" },
  email: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  meta: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },

  cardBottom: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  cardMeta: { fontSize: 11, color: "#9CA3AF", marginBottom: 8 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 10, fontSize: 14 },
});

export default DriverManagementScreen;
