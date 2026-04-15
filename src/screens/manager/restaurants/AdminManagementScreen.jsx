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
import OptimizedImage from "../../../components/common/OptimizedImage";
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

const statusColors = {
  active: { bg: "#E6F9EE", text: "#06C168" },
  pending: { bg: "#FFF7ED", text: "#D97706" },
  suspended: { bg: "#FFF7ED", text: "#EA580C" },
  rejected: { bg: "#FEF2F2", text: "#DC2626" },
  default: { bg: "#F3F4F6", text: "#6B7280" },
};

const AdminManagementScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (search.trim()) params.append("search", search.trim());
      const res = await fetch(
        `${API_URL}/manager/admins?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) setAdmins(data.admins || []);
    } catch (err) {
      console.error("Failed to load admins:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(() => fetchAdmins(), 300);
    return () => clearTimeout(t);
  }, [fetchAdmins]);

  const updateStatus = async (adminId, nextStatus) => {
    setActionLoading(adminId);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/admins/${adminId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === adminId ? { ...a, admin_status: nextStatus } : a,
          ),
        );
      } else {
        Alert.alert("Error", data?.message || "Failed to update status");
      }
    } catch (err) {
      Alert.alert("Error", "Network error");
    } finally {
      setActionLoading("");
    }
  };

  const filters = ["all", "active", "pending", "suspended", "rejected"];

  const renderAdmin = ({ item }) => {
    const sc = statusColors[item.admin_status] || statusColors.default;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {item.restaurants?.logo_url ? (
              <OptimizedImage
                uri={item.restaurants.logo_url}
                style={styles.logoImg}
              />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {item.full_name || "(Not provided)"}
            </Text>
            <Text style={styles.email}>{item.email}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>
              {item.admin_status || "unknown"}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Restaurant: </Text>
            {item.restaurants?.restaurant_name || "-"}
          </Text>
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Phone: </Text>
            {item.phone || "-"}
          </Text>
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Profile: </Text>
            {item.profile_completed ? "Completed" : "Incomplete"}
          </Text>
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Created: </Text>
            {item.created_at
              ? new Date(item.created_at).toLocaleDateString()
              : "-"}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {item.admin_status !== "active" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#06C168" }]}
              onPress={() => updateStatus(item.id, "active")}
              disabled={actionLoading === item.id}
            >
              <Text style={styles.actionBtnText}>
                {actionLoading === item.id ? "Saving..." : "Activate"}
              </Text>
            </TouchableOpacity>
          )}
          {item.admin_status !== "suspended" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#EA580C" }]}
              onPress={() => updateStatus(item.id, "suspended")}
              disabled={actionLoading === item.id}
            >
              <Text style={styles.actionBtnText}>
                {actionLoading === item.id ? "Saving..." : "Suspend"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Admins"
        showBack
        onMenuPress={() => setDrawerOpen(true)}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Restaurant & Admin"
        items={ADMIN_DRAWER_ITEMS}
        activeRoute={route.name}
        navigation={navigation}
      />
      <View style={styles.headerPad}>
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
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterPill,
                statusFilter === f && styles.filterPillActive,
              ]}
              onPress={() => setStatusFilter(f)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === f && styles.filterPillTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={admins}
        renderItem={renderAdmin}
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
              <Text style={styles.emptyText}>No admins found</Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={fetchAdmins}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerPad: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 12, color: "#6B7280", marginTop: 2, marginBottom: 12 },

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

  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  filterPillActive: { backgroundColor: "#4F46E5" },
  filterPillText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  filterPillTextActive: { color: "#fff" },

  list: { paddingHorizontal: 16, paddingBottom: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatarWrap: { marginRight: 10 },
  logoImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  name: { fontSize: 14, fontWeight: "700", color: "#111827" },
  email: { fontSize: 11, color: "#6B7280", marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },

  cardMeta: { marginBottom: 10 },
  metaText: { fontSize: 11, color: "#374151", marginBottom: 2 },
  metaLabel: { color: "#9CA3AF" },

  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },
});

export default AdminManagementScreen;
