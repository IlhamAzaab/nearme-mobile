import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  {
    route: "RestaurantReports",
    label: "Restaurants",
    icon: "restaurant-outline",
  },
  { route: "FinancialReports", label: "Financial", icon: "calculator-outline" },
  { route: "CustomerReports", label: "Customers", icon: "people-outline" },
  { route: "TimeAnalytics", label: "Time Analytics", icon: "time-outline" },
];

const CustomerReportsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef(null);

  // Instant search: debounce 300ms, show search spinner not full loading
  const handleSearchChange = (text) => {
    setSearchInput(text);
    setSearchLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(text);
      setPage(1);
    }, 300);
  };

  const fetchData = useCallback(async (isSearch = false) => {
    try {
      if (!isSearch) setLoading(true);
      const token = await getAccessToken();
      const params = new URLSearchParams({
        search,
        orderFilter,
        sortBy,
        sortOrder,
        page: String(page),
        limit: "15",
      });
      const res = await fetch(
        `${API_URL}/manager/reports/customers/management?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load customers");
      }
      setResult(data);
    } catch (e) {
      console.error("Customer report error", e);
      Alert.alert("Error", e.message || "Failed to load customers");
    } finally {
      setLoading(false);
      setSearchLoading(false);
      setRefreshing(false);
    }
  }, [orderFilter, page, search, sortBy, sortOrder]);

  // Single effect: runs when any filter/page/search changes
  useEffect(() => {
    fetchData(searchLoading);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSuspendToggle = async (customer) => {
    const nextSuspended = customer.status !== "suspended";
    const token = await getAccessToken();
    try {
      setActionLoadingId(customer.id);
      const res = await fetch(
        `${API_URL}/manager/reports/customers/${customer.id}/suspend`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            suspended: nextSuspended,
            reason: nextSuspended ? "Suspended by manager" : "",
          }),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || "Failed to update customer");
      }

      await fetchData();
    } catch (err) {
      Alert.alert("Action Failed", err.message || "Unable to update status");
    } finally {
      setActionLoadingId("");
    }
  };

  const handleDelete = async (customer) => {
    Alert.alert(
      "Permanently Remove Customer",
      `Remove ${customer.username || customer.email}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const token = await getAccessToken();
            try {
              setActionLoadingId(customer.id);
              const res = await fetch(
                `${API_URL}/manager/reports/customers/${customer.id}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              const json = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(json?.message || "Failed to remove customer");
              }
              await fetchData();
            } catch (err) {
              Alert.alert("Action Failed", err.message || "Unable to remove customer");
            } finally {
              setActionLoadingId("");
            }
          },
        },
      ],
    );
  };

  const handleOpenDetails = (customer) => {
    navigation.navigate("CustomerDetails", { customerId: customer.id });
  };

  const summary = result?.summary || {};
  const customers = result?.customers || [];
  const pagination = result?.pagination || { page: 1, totalPages: 1 };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Customer Management"
        showBack
        onRefresh={handleRefresh}
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
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#13ECB9" />
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Customer Management Center</Text>
              <Text style={styles.heroSubtitle}>
                Filter by order behavior, sort by spend/orders, and manage account status.
              </Text>
            </View>

            <View style={styles.metricWrap}>
              {[
                { label: "Total", value: summary.total_customers || 0 },
                { label: "With Orders", value: summary.with_orders || 0 },
                { label: "No Orders", value: summary.without_orders || 0 },
                { label: "Today", value: summary.today_created || 0, subtext: `+${summary.today_ordered || 0} Ordered` },
              ].map((m, i) => (
                <View key={i} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  {m.subtext && (
                    <Text style={styles.metricSubtext}>{m.subtext}</Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.filtersCard}>
              <TextInput
                value={searchInput}
                onChangeText={handleSearchChange}
                placeholder="Search name, email, phone, city"
                style={styles.input}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchLoading && (
                <ActivityIndicator size="small" color="#0F766E" style={{ marginVertical: 4 }} />
              )}

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Order Filter</Text>
                <View style={styles.inlineOptions}>
                  {["all", "with_orders", "without_orders"].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => {
                        setOrderFilter(value);
                        setPage(1);
                      }}
                      style={[
                        styles.optionPill,
                        orderFilter === value && styles.optionPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          orderFilter === value && styles.optionPillTextActive,
                        ]}
                      >
                        {value === "all"
                          ? "All"
                          : value === "with_orders"
                            ? "With Orders"
                            : "No Orders"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Sort By</Text>
                <View style={styles.inlineOptions}>
                  {["recent", "orders", "spend", "last_order"].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => {
                        setSortBy(value);
                        setPage(1);
                      }}
                      style={[
                        styles.optionPill,
                        sortBy === value && styles.optionPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          sortBy === value && styles.optionPillTextActive,
                        ]}
                      >
                        {value === "recent"
                          ? "Recent"
                          : value === "orders"
                            ? "Orders"
                            : value === "spend"
                              ? "Spend"
                              : "Last Order"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => {
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                  setPage(1);
                }}
              >
                <Ionicons
                  name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
                  size={14}
                  color="#0F766E"
                />
                <Text style={styles.sortButtonText}>
                  {sortOrder === "asc" ? "Ascending" : "Descending"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {customers.length === 0 ? (
                <Text style={styles.emptyText}>No customers found.</Text>
              ) : (
                customers.map((customer) => (
                  <View key={customer.id} style={styles.customerItem}>
                    <View style={styles.customerTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerName}>
                          {customer.username || "Unnamed"}
                        </Text>
                        <Text style={styles.customerSub} selectable={true}>{customer.email || "No email"}</Text>
                        <Text style={styles.customerSub} selectable={true}>{customer.phone || "No phone"}</Text>
                      </View>
                      {/* Replace Active badge with account created date */}
                      <View style={styles.createdBadge}>
                        <Text style={styles.createdLabel}>Joined</Text>
                        <Text style={styles.createdDate}>
                          {customer.created_at
                            ? new Date(customer.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit", month: "short", year: "numeric"
                              })
                            : "N/A"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailGrid}>
                      <Stat label="City" value={customer.city || "N/A"} />
                      <Stat label="Orders" value={customer.order_count || 0} />
                      <Stat
                        label="Spent"
                        value={`Rs.${Number(customer.total_spent || 0).toFixed(0)}`}
                      />
                      <Stat
                        label="Last Order"
                        value={
                          customer.last_order_at
                            ? new Date(customer.last_order_at).toLocaleDateString()
                            : "No orders"
                        }
                      />
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => handleOpenDetails(customer)}
                        disabled={actionLoadingId === customer.id}
                        style={styles.actionView}
                      >
                        <Text style={styles.actionViewText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={styles.pageBtn}
                disabled={(pagination.page || 1) <= 1 || refreshing}
                onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <Text style={styles.pageBtnText}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>
                {pagination.page || 1} / {pagination.totalPages || 1}
              </Text>
              <TouchableOpacity
                style={styles.pageBtn}
                disabled={(pagination.page || 1) >= (pagination.totalPages || 1) || refreshing}
                onPress={() =>
                  setPage((prev) => Math.min(pagination.totalPages || 1, prev + 1))
                }
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { padding: 12, paddingBottom: 28 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  heroCard: {
    backgroundColor: "#0F766E",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ECFEFF",
  },
  heroSubtitle: {
    fontSize: 12,
    color: "#CCFBF1",
    marginTop: 6,
    lineHeight: 18,
  },
  metricWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#64748B",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#04553C",
    marginTop: 4,
  },
  metricSubtext: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0F766E",
    marginTop: 2,
  },
  filtersCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
  },
  optionRow: { gap: 8 },
  optionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  inlineOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  optionPillActive: {
    borderColor: "#0F766E",
    backgroundColor: "#CCFBF1",
  },
  optionPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  optionPillTextActive: {
    color: "#0F766E",
  },
  sortButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#99F6E4",
    borderRadius: 14,
    backgroundColor: "#F0FDFA",
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F766E",
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  customerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  customerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  customerSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: "#DCFCE7",
  },
  statusSuspended: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // Created date badge (replaces status badge)
  createdBadge: {
    alignItems: "flex-end",
    paddingLeft: 8,
  },
  createdLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  createdDate: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F766E",
    marginTop: 1,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCell: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actionSuspend: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FEFCE8",
    paddingVertical: 8,
    alignItems: "center",
  },
  actionSuspendText: {
    color: "#92400E",
    fontWeight: "700",
    fontSize: 12,
  },
  actionRemove: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingVertical: 8,
    alignItems: "center",
  },
  actionRemoveText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 12,
  },
  paginationRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  pageBtnText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
  },
  pageInfo: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
    padding: 16,
    textAlign: "center",
  },
  actionView: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
  },
  actionViewText: { fontSize: 12, fontWeight: "700", color: "#0C4A6E" },
});

function Stat({ label, value }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default CustomerReportsScreen;
