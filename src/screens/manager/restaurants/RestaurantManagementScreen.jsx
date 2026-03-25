import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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

const statusColors = {
  active: { bg: "#E6F9EE", text: "#06C168" },
  pending: { bg: "#FFF7ED", text: "#D97706" },
  suspended: { bg: "#FFF7ED", text: "#EA580C" },
  rejected: { bg: "#FEF2F2", text: "#DC2626" },
  default: { bg: "#F3F4F6", text: "#6B7280" },
};

const FILTERS = ["all", "active", "pending", "suspended", "rejected"];

const RestaurantManagementScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showImageModal, setShowImageModal] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => fetchRestaurants(), 300);
    return () => clearTimeout(timer);
  }, [statusFilter, search]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(
        `${API_URL}/manager/restaurants?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) setRestaurants(data.restaurants || []);
    } catch (err) {
      console.error("Fetch restaurants error", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (restaurantId, nextStatus) => {
    setActionLoading(restaurantId);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/restaurants/${restaurantId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setRestaurants((prev) =>
          prev.map((r) =>
            r.id === restaurantId ? { ...r, restaurant_status: nextStatus } : r,
          ),
        );
        if (selectedRestaurant?.id === restaurantId) {
          setSelectedRestaurant((prev) => ({
            ...prev,
            restaurant_status: nextStatus,
          }));
        }
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
  const formatTime = (v) => v || "-";

  const badge = (status) => {
    const c = statusColors[status] || statusColors.default;
    return (
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.text }]}>
          {status || "unknown"}
        </Text>
      </View>
    );
  };

  /* ─── Detail Panel ─── */
  const renderDetailPanel = () => {
    if (!selectedRestaurant) return null;
    const r = selectedRestaurant;

    return (
      <View style={styles.detailPanel}>
        <TouchableOpacity
          style={styles.closeDetail}
          onPress={() => setSelectedRestaurant(null)}
        >
          <Ionicons name="close" size={20} color="#6B7280" />
        </TouchableOpacity>

        <Text style={styles.detailTitle}>Restaurant Details</Text>

        {r.cover_image_url && (
          <TouchableOpacity
            onPress={() =>
              setShowImageModal({
                url: r.cover_image_url,
                title: `${r.restaurant_name} - Cover`,
              })
            }
          >
            <Image
              source={{ uri: r.cover_image_url }}
              style={styles.coverImg}
            />
          </TouchableOpacity>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>BUSINESS REG. NO.</Text>
          <Text style={styles.detailValue}>
            {r.business_registration_number || "-"}
          </Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>FULL ADDRESS</Text>
          <Text style={styles.detailValue}>{r.address || "-"}</Text>
          <Text style={styles.detailSubValue}>
            {r.city || "-"}, {r.postal_code || "-"}
          </Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>ADMIN INFO</Text>
          <Text style={styles.detailValue}>{r.admins?.full_name || "-"}</Text>
          <Text style={styles.detailSubValue}>{r.admins?.email || "-"}</Text>
          <Text style={styles.detailSubValue}>{r.admins?.phone || "-"}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>OPERATING HOURS</Text>
          <Text style={styles.detailValue}>
            {formatTime(r.opening_time)} - {formatTime(r.close_time)}
          </Text>
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          {r.restaurant_status !== "active" && (
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: "#06C168" }]}
              onPress={() => updateStatus(r.id, "active")}
              disabled={actionLoading === r.id}
            >
              <Text style={styles.statusBtnText}>
                {actionLoading === r.id ? "Updating..." : "Activate"}
              </Text>
            </TouchableOpacity>
          )}
          {r.restaurant_status !== "suspended" && (
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: "#EA580C" }]}
              onPress={() => updateStatus(r.id, "suspended")}
              disabled={actionLoading === r.id}
            >
              <Text style={styles.statusBtnText}>
                {actionLoading === r.id ? "Updating..." : "Suspend"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderRestaurant = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.card,
        selectedRestaurant?.id === item.id && styles.cardSelected,
      ]}
      onPress={() => setSelectedRestaurant(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        {item.logo_url ? (
          <TouchableOpacity
            onPress={() =>
              setShowImageModal({
                url: item.logo_url,
                title: `${item.restaurant_name} - Logo`,
              })
            }
          >
            <Image source={{ uri: item.logo_url }} style={styles.cardLogo} />
          </TouchableOpacity>
        ) : (
          <View style={styles.cardLogoPlaceholder}>
            <Text style={styles.cardLogoText}>No Logo</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.restaurant_name}
            </Text>
            {badge(item.restaurant_status)}
          </View>
          <Text style={styles.cardCity}>
            {item.city || "-"} • {item.address || "-"}
          </Text>
          <View style={styles.cardInfoGrid}>
            <Text style={styles.cardInfoText}>
              <Text style={styles.cardInfoLabel}>Admin: </Text>
              {item.admins?.full_name || "-"}
            </Text>
            <Text style={styles.cardInfoText}>
              <Text style={styles.cardInfoLabel}>Contact: </Text>
              {item.admins?.phone || "-"}
            </Text>
            <Text style={styles.cardInfoText}>
              <Text style={styles.cardInfoLabel}>Hours: </Text>
              {formatTime(item.opening_time)} - {formatTime(item.close_time)}
            </Text>
            <Text style={styles.cardInfoText}>
              <Text style={styles.cardInfoLabel}>Created: </Text>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Restaurants"
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

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons
          name="search-outline"
          size={18}
          color="#9CA3AF"
          style={{ marginLeft: 12 }}
        />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or city"
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
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
                styles.filterText,
                statusFilter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#13ECB9" />
        </View>
      ) : (
        <FlatList
          data={restaurants}
          renderItem={renderRestaurant}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="restaurant-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No restaurants found</Text>
            </View>
          }
          ListFooterComponent={renderDetailPanel}
        />
      )}

      {/* Image Modal */}
      <Modal visible={!!showImageModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.imgOverlay}
          activeOpacity={1}
          onPress={() => setShowImageModal(null)}
        >
          <View style={styles.imgModalContent}>
            <TouchableOpacity
              style={styles.imgCloseBtn}
              onPress={() => setShowImageModal(null)}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            {showImageModal && (
              <>
                <Image
                  source={{ uri: showImageModal.url }}
                  style={styles.imgModalImage}
                  resizeMode="contain"
                />
                <Text style={styles.imgModalTitle}>{showImageModal.title}</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 12, color: "#6B7280", marginTop: 4 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 13,
    color: "#111827",
  },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  filterPillActive: { backgroundColor: "#4F46E5" },
  filterText: { fontSize: 11, fontWeight: "700", color: "#6B7280" },
  filterTextActive: { color: "#fff" },

  listContent: { paddingHorizontal: 16, paddingBottom: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  cardSelected: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  cardRow: { flexDirection: "row" },
  cardLogo: { width: 56, height: 56, borderRadius: 10 },
  cardLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  cardLogoText: { fontSize: 8, color: "#9CA3AF" },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  cardCity: { fontSize: 11, color: "#6B7280", marginTop: 3 },
  cardInfoGrid: { marginTop: 6 },
  cardInfoLabel: { color: "#9CA3AF" },
  cardInfoText: {
    fontSize: 11,
    color: "#111827",
    marginTop: 2,
    fontWeight: "500",
  },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },

  /* Detail Panel */
  detailPanel: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  closeDetail: { alignSelf: "flex-end" },
  detailTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  coverImg: { width: "100%", height: 120, borderRadius: 10, marginBottom: 14 },
  detailSection: { marginBottom: 12 },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    color: "#111827",
    marginTop: 2,
    fontWeight: "500",
  },
  detailSubValue: { fontSize: 12, color: "#6B7280" },

  statusBtn: { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  statusBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  /* Image Modal */
  imgOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  imgModalContent: { width: "100%", alignItems: "center" },
  imgCloseBtn: { alignSelf: "flex-end", marginBottom: 10 },
  imgModalImage: { width: "100%", height: 350, borderRadius: 10 },
  imgModalTitle: {
    color: "#fff",
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
  },
});

export default RestaurantManagementScreen;
