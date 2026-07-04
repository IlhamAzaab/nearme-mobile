import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerDrawer from "../../../components/manager/ManagerDrawer";
import ManagerHeader from "../../../components/manager/ManagerHeader";
import { getAccessToken } from "../../../lib/authStorage";
import { API_URL } from "../../../config/env";

const REPORT_DRAWER_ITEMS = [
  { route: "SalesReports", label: "Sales", icon: "trending-up-outline" },
  { route: "DeliveryReports", label: "Delivery", icon: "car-outline" },
  { route: "RestaurantReports", label: "Restaurants", icon: "restaurant-outline" },
  { route: "FinancialReports", label: "Financial", icon: "calculator-outline" },
  { route: "CustomerReports", label: "Customers", icon: "people-outline" },
  { route: "ActiveCarts", label: "Active Carts", icon: "cart-outline" },
  { route: "TimeAnalytics", label: "Time Analytics", icon: "time-outline" },
];

function fmt(v) {
  return `Rs.${parseFloat(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Format date to YYYY-MM-DD
function toDateString(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(iso) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ActiveCartsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [carts, setCarts] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedDate, setSelectedDate] = useState(null); // null = all
  const [dateInput, setDateInput] = useState(""); // display string
  const [expandedCartId, setExpandedCartId] = useState(null);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async (targetPage = 1, dateFilter = selectedDate) => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        console.error("ActiveCarts: No token found");
        return;
      }

      let url = `${API_URL}/manager/reports/active-carts?page=${targetPage}&limit=30`;
      if (dateFilter) url += `&date=${dateFilter}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) {
        console.error("Active carts error:", json);
        return;
      }
      setCarts(json.carts || []);
      setSummary(json.summary || {});
      setPagination(json.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (e) {
      console.error("Active carts fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setPage(1);
    fetchData(1, selectedDate);
  }, [selectedDate]);

  const handleDateApply = () => {
    if (!dateInput.trim()) {
      setSelectedDate(null);
      return;
    }
    // Accept YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
    const val = dateInput.trim();
    let parsed = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      parsed = val;
    } else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(val)) {
      const parts = val.split(/[\/\-]/);
      parsed = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    setSelectedDate(parsed || null);
  };

  const clearDate = () => {
    setSelectedDate(null);
    setDateInput("");
  };

  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const loadPage = (p) => {
    setPage(p);
    fetchData(p, selectedDate);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Active Carts"
        showBack
        onMenuPress={() => setDrawerOpen(true)}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Reports"
        items={REPORT_DRAWER_ITEMS}
        activeRoute={route.name}
        navigation={navigation}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Summary Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="cart-outline" size={28} color="#fff" />
          </View>
          <View>
            <Text style={styles.heroLabel}>TOTAL ACTIVE CARTS</Text>
            <Text style={styles.heroCount}>{summary.total_active_carts ?? "--"}</Text>
            {selectedDate && (
              <Text style={styles.heroSub}>Filtered: {selectedDate}</Text>
            )}
          </View>
        </View>

        {/* Date Filter */}
        <View style={styles.filterCard}>
          <Ionicons name="calendar-outline" size={16} color="#64748B" />
          <TextInput
            style={styles.dateInput}
            placeholder="Filter by date (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
            value={dateInput}
            onChangeText={setDateInput}
            onSubmitEditing={handleDateApply}
            returnKeyType="search"
          />
          {selectedDate ? (
            <TouchableOpacity onPress={clearDate} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.applyBtn} onPress={handleDateApply}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Date Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {[0, 1, 2, 3, 6].map((daysAgo) => {
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            const ds = toDateString(d);
            const label = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;
            const active = selectedDate === ds;
            return (
              <TouchableOpacity
                key={daysAgo}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => {
                  if (active) { clearDate(); }
                  else { setSelectedDate(ds); setDateInput(ds); }
                }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
          {selectedDate && (
            <TouchableOpacity style={[styles.pill, { borderColor: "#EF4444" }]} onPress={clearDate}>
              <Text style={[styles.pillText, { color: "#EF4444" }]}>All Time</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Cart List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#13ECB9" />
            <Text style={styles.loadingText}>Loading carts...</Text>
          </View>
        ) : carts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="cart-outline" size={52} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {selectedDate ? `No active carts on ${selectedDate}` : "No active carts found"}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>
              {pagination.total} cart{pagination.total !== 1 ? "s" : ""} found
            </Text>
            {carts.map((cart) => {
              const expanded = expandedCartId === cart.id;
              return (
                <View key={cart.id} style={styles.cartCard}>
                  {/* Header row */}
                  <TouchableOpacity
                    style={styles.cartHeader}
                    onPress={() => setExpandedCartId(expanded ? null : cart.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cartHeaderLeft}>
                      <View style={styles.cartIconWrap}>
                        <Ionicons name="cart" size={18} color="#06C168" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {cart.customer.name}
                        </Text>
                        <Text style={styles.restaurantName} numberOfLines={1}>
                          🍽 {cart.restaurant.name}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cartHeaderRight}>
                      <Text style={styles.cartTotal}>{fmt(cart.cart_total)}</Text>
                      <Text style={styles.itemCount}>{cart.item_count} item{cart.item_count !== 1 ? "s" : ""}</Text>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#94A3B8"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Details */}
                  {expanded && (
                    <View style={styles.cartBody}>
                      {/* Customer Info */}
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>Customer Details</Text>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Name</Text>
                          <Text style={styles.infoValue}>{cart.customer.name}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.infoRow}
                          onPress={() => handleCall(cart.customer.phone)}
                        >
                          <Text style={styles.infoLabel}>Phone</Text>
                          <Text style={[styles.infoValue, styles.phoneLink]}>
                            {cart.customer.phone || "N/A"}
                          </Text>
                        </TouchableOpacity>
                        {cart.customer.email ? (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Email</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>
                              {cart.customer.email}
                            </Text>
                          </View>
                        ) : null}
                        {cart.customer.city ? (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>City</Text>
                            <Text style={styles.infoValue}>{cart.customer.city}</Text>
                          </View>
                        ) : null}
                        {cart.customer.address ? (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Address</Text>
                            <Text style={[styles.infoValue, { maxWidth: "60%", textAlign: "right" }]}>
                              {cart.customer.address}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Restaurant */}
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>Restaurant</Text>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Name</Text>
                          <Text style={styles.infoValue}>{cart.restaurant.name}</Text>
                        </View>
                      </View>

                      {/* Cart Items */}
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>
                          Cart Items ({cart.items.length})
                        </Text>
                        {cart.items.map((item, idx) => (
                          <View
                            key={item.id}
                            style={[
                              styles.cartItem,
                              idx === cart.items.length - 1 && { borderBottomWidth: 0 },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemName}>{item.food_name}</Text>
                              {item.size ? (
                                <Text style={styles.itemSize}>Size: {item.size}</Text>
                              ) : null}
                            </View>
                            <View style={styles.itemRight}>
                              <Text style={styles.itemQty}>×{item.quantity}</Text>
                              <Text style={styles.itemPrice}>{fmt(item.total_price)}</Text>
                            </View>
                          </View>
                        ))}
                        <View style={styles.cartTotalRow}>
                          <Text style={styles.cartTotalLabel}>Cart Total</Text>
                          <Text style={styles.cartTotalValue}>{fmt(cart.cart_total)}</Text>
                        </View>
                      </View>

                      {/* Timestamps */}
                      <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>Timeline</Text>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Cart Created</Text>
                          <Text style={styles.infoValue}>{formatDateTime(cart.created_at)}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Last Updated</Text>
                          <Text style={styles.infoValue}>{formatDateTime(cart.updated_at)}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => page > 1 && loadPage(page - 1)}
                  disabled={page <= 1}
                >
                  <Ionicons name="chevron-back" size={16} color={page <= 1 ? "#CBD5E1" : "#0F172A"} />
                </TouchableOpacity>
                <Text style={styles.pageText}>
                  Page {pagination.page} / {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= pagination.totalPages && styles.pageBtnDisabled]}
                  onPress={() => page < pagination.totalPages && loadPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={16} color={page >= pagination.totalPages ? "#CBD5E1" : "#0F172A"} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { padding: 16 },
  center: { alignItems: "center", paddingTop: 60 },
  loadingText: { color: "#94A3B8", marginTop: 8, fontSize: 13 },

  // Hero banner
  heroBanner: {
    backgroundColor: "#06C168",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroCount: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 42,
  },
  heroSub: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  // Filter
  filterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 2,
  },
  clearBtn: { padding: 2 },
  applyBtn: {
    backgroundColor: "#13ECB9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  applyBtnText: { fontSize: 12, fontWeight: "700", color: "#0F172A" },

  // Pills
  pillRow: { marginBottom: 14 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 6,
  },
  pillActive: { backgroundColor: "#13ECB9", borderColor: "#13ECB9" },
  pillText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  pillTextActive: { color: "#0F172A" },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Cart Card
  cartCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    overflow: "hidden",
  },
  cartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  cartHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cartIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E6F9EE",
    justifyContent: "center",
    alignItems: "center",
  },
  customerName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  restaurantName: { fontSize: 12, color: "#64748B", marginTop: 1 },
  cartHeaderRight: { alignItems: "flex-end", gap: 2 },
  cartTotal: { fontSize: 14, fontWeight: "800", color: "#06C168" },
  itemCount: { fontSize: 11, color: "#94A3B8" },

  // Cart Body
  cartBody: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  infoSection: {
    marginTop: 14,
  },
  infoSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  infoLabel: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  infoValue: { fontSize: 12, color: "#0F172A", fontWeight: "700", maxWidth: "55%", textAlign: "right" },
  phoneLink: { color: "#06C168", textDecorationLine: "underline" },

  // Cart Items
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemName: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  itemSize: { fontSize: 11, color: "#94A3B8", marginTop: 1, textTransform: "capitalize" },
  itemRight: { alignItems: "flex-end", gap: 2 },
  itemQty: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  itemPrice: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  cartTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  cartTotalLabel: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  cartTotalValue: { fontSize: 14, fontWeight: "800", color: "#06C168" },

  // Pagination
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 16,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  pageBtnDisabled: { borderColor: "#F1F5F9" },
  pageText: { fontSize: 13, fontWeight: "600", color: "#0F172A" },

  // Empty
  emptyWrap: { alignItems: "center", paddingTop: 60, paddingBottom: 20 },
  emptyText: { color: "#9CA3AF", marginTop: 10, fontSize: 13, textAlign: "center" },
});
