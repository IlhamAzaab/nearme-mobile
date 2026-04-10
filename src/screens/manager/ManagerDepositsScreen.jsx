import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerDrawer from "../../components/manager/ManagerDrawer";
import ManagerHeader from "../../components/manager/ManagerHeader";
import { API_URL } from "../../config/env";

const SRI_LANKA_TIME_ZONE = "Asia/Colombo";

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

const periods = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "all_time", label: "All Time" },
];

export default function ManagerDepositsScreen() {
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [summary, setSummary] = useState({
    total_sales_today: 0,
    todays_sales: 0,
    prev_pending: 0,
    pending: 0,
    paid: 0,
    pending_deposits_count: 0,
  });
  const [deposits, setDeposits] = useState([]);
  const prevTabRef = useRef(activeTab);

  const fetchDepositsForTab = useCallback(async (tabStatus) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const status = tabStatus === "pending" ? "pending" : "approved";
      const url =
        tabStatus === "pending"
          ? `${API_URL}/driver/deposits/manager/pending`
          : `${API_URL}/driver/deposits/manager/all?status=${status}&limit=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.success ? data.deposits || [] : [];
    } catch (error) {
      console.error("Failed to fetch deposits:", error);
      return [];
    }
  }, []);

  const fetchSummary = useCallback(
    async (period) => {
      try {
        const token = await AsyncStorage.getItem("token");
        const p = period || selectedPeriod;
        const res = await fetch(
          `${API_URL}/driver/deposits/manager/summary?period=${p}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (data.success) setSummary(data.summary);
      } catch (error) {
        console.error("Failed to fetch summary:", error);
      }
    },
    [selectedPeriod],
  );

  const fetchDeposits = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const status = activeTab === "pending" ? "pending" : "approved";
      const url =
        activeTab === "pending"
          ? `${API_URL}/driver/deposits/manager/pending`
          : `${API_URL}/driver/deposits/manager/all?status=${status}&limit=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setDeposits(data.deposits || []);
    } catch (error) {
      console.error("Failed to fetch deposits:", error);
    }
  }, [activeTab]);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      await Promise.all([fetchSummary(), fetchDeposits()]);
      setLoading(false);
      setRefreshing(false);
    },
    [fetchSummary, fetchDeposits],
  );

  useEffect(() => {
    fetchData(true);
  }, []);

  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      setDeposits([]);
      setTabLoading(true);
      prevTabRef.current = activeTab;
      fetchDepositsForTab(activeTab).then((newDeposits) => {
        setDeposits(newDeposits);
        setTabLoading(false);
      });
    }
  }, [activeTab, fetchDepositsForTab]);

  const formatCurrency = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: SRI_LANKA_TIME_ZONE,
    });
  };

  const getTransferId = (id) =>
    String(id || "-")
      .substring(0, 12)
      .toUpperCase();

  const getDriverInitials = (name) => {
    if (!name) return "DR";
    const parts = name.split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const getPreviewUrl = (deposit) => {
    if (!deposit?.proof_url) return "";
    const isPdf =
      deposit.proof_type === "pdf" || deposit.proof_url?.includes(".pdf");
    if (isPdf && deposit.proof_url.includes("cloudinary.com")) {
      let url = deposit.proof_url;
      if (url.includes("/raw/upload/"))
        url = url.replace("/raw/upload/", "/image/upload/");
      return url
        .replace("/upload/", "/upload/pg_1,w_200,h_280,c_fill/")
        .replace(".pdf", ".jpg");
    }
    return deposit.proof_url;
  };

  const getPeriodTitle = () => {
    const map = {
      today: "Overall Performance",
      yesterday: "Yesterday's Report",
      this_week: "This Week",
      this_month: "This Month",
      all_time: "All Time",
    };
    return map[selectedPeriod] || "Overall Performance";
  };

  const getSalesLabel = () => {
    if (selectedPeriod === "today") return "Today's Sales";
    if (selectedPeriod === "yesterday") return "Day's Sales";
    return "Period Sales";
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ManagerHeader
          title="Driver Deposits"
          onMenuPress={() => setDrawerOpen(true)}
        />
        <ManagerDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sectionTitle="Driver Management"
          items={DRIVER_DRAWER_ITEMS}
          activeRoute="ManagerDeposits"
          navigation={navigation}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#13ECB9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Driver Deposits"
        onMenuPress={() => setDrawerOpen(true)}
        onRefresh={() => fetchData(false)}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Driver Management"
        items={DRIVER_DRAWER_ITEMS}
        activeRoute="ManagerDeposits"
        navigation={navigation}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(false)}
            colors={["#13ECB9"]}
          />
        }
      >
        {/* Period Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.periodScroll}
        >
          {periods.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.periodBtn,
                selectedPeriod === p.key && styles.periodBtnActive,
              ]}
              onPress={() => {
                setSelectedPeriod(p.key);
                setRefreshing(true);
                fetchSummary(p.key).then(() => setRefreshing(false));
              }}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === p.key && styles.periodTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>{getPeriodTitle()}</Text>
              <Text style={styles.heroAmount}>
                {formatCurrency(summary.total_sales_today)}
              </Text>
              <Text style={styles.heroSubLabel}>
                {selectedPeriod === "today"
                  ? "Total Sales Today"
                  : "Total Sales"}
              </Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name="trending-up" size={20} color="#111816" />
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroBottom}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroMetaLabel}>{getSalesLabel()}</Text>
              <Text style={styles.heroMetaValue}>
                {formatCurrency(summary.todays_sales)}
              </Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={{ flex: 1, paddingLeft: 16 }}>
              <Text style={styles.heroMetaLabel}>Prev. Pending</Text>
              <Text style={styles.heroMetaValue}>
                {formatCurrency(summary.prev_pending)}
              </Text>
            </View>
          </View>
        </View>

        {/* Metric Cards */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="hourglass-outline" size={14} color="#F59E0B" />
              <Text style={styles.metricLabel}>PENDING</Text>
            </View>
            <Text style={styles.metricValue}>
              {formatCurrency(summary.pending)}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#13ECB9"
              />
              <Text style={styles.metricLabel}>PAID</Text>
            </View>
            <Text style={styles.metricValue}>
              {formatCurrency(summary.paid)}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "pending" && styles.tabActive]}
            onPress={() => setActiveTab("pending")}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={activeTab === "pending" ? "#111816" : "#618980"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "pending" && styles.tabTextActive,
              ]}
            >
              Pending
            </Text>
            {summary.pending_deposits_count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {summary.pending_deposits_count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "approved" && styles.tabActive]}
            onPress={() => setActiveTab("approved")}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={activeTab === "approved" ? "#111816" : "#618980"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "approved" && styles.tabTextActive,
              ]}
            >
              Approved
            </Text>
          </TouchableOpacity>
        </View>

        {/* List Header */}
        <Text style={styles.sectionLabel}>
          {activeTab === "pending"
            ? "PENDING SUBMISSIONS"
            : "APPROVED DEPOSITS"}
        </Text>

        {/* Deposits List */}
        {tabLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#13ECB9" />
          </View>
        ) : deposits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={
                activeTab === "pending"
                  ? "mail-outline"
                  : "checkmark-done-outline"
              }
              size={48}
              color="#D1D5DB"
            />
            <Text style={styles.emptyText}>
              {activeTab === "pending"
                ? "No pending deposits to review"
                : "No approved deposits yet"}
            </Text>
          </View>
        ) : (
          deposits.map((deposit) => (
            <View key={deposit.id} style={styles.depositCard}>
              <View style={styles.depositRow}>
                <View style={styles.depositAvatar}>
                  <Text style={styles.depositAvatarText}>
                    {getDriverInitials(deposit.driver?.full_name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.depositName}>
                    {deposit.driver?.full_name || "Driver"}
                  </Text>
                  <Text style={styles.depositPhone}>
                    {deposit.driver?.phone ||
                      deposit.driver?.email ||
                      "No contact"}
                  </Text>
                  <Text style={styles.depositDate}>
                    {formatDateTime(deposit.created_at)}
                  </Text>
                  <Text style={styles.depositTransferId}>
                    {`Transfer ID: ${getTransferId(deposit.id)}`}
                  </Text>
                </View>
                <View style={styles.depositRight}>
                  <Text style={styles.depositAmount}>
                    {formatCurrency(
                      activeTab === "approved"
                        ? deposit.approved_amount
                        : deposit.amount,
                    )}
                  </Text>
                  <View
                    style={[
                      styles.depositStatus,
                      {
                        backgroundColor:
                          deposit.status === "pending"
                            ? "#FEF3C7"
                            : deposit.status === "approved"
                              ? "#DCFCE7"
                              : "#FEE2E2",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.depositStatusText,
                        {
                          color:
                            deposit.status === "pending"
                              ? "#A16207"
                              : deposit.status === "approved"
                                ? "#15803D"
                                : "#B91C1C",
                        },
                      ]}
                    >
                      {deposit.status === "pending"
                        ? "Awaiting"
                        : deposit.status}
                    </Text>
                  </View>
                </View>
              </View>

              {activeTab === "pending" && (
                <View style={styles.depositActions}>
                  <View style={styles.proofThumb}>
                    {deposit.proof_url ? (
                      <Image
                        source={{ uri: getPreviewUrl(deposit) }}
                        style={styles.proofImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.proofPlaceholder}>
                        <Ionicons
                          name="image-outline"
                          size={20}
                          color="#9CA3AF"
                        />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.verifyBtn}
                    onPress={() =>
                      navigation.navigate("VerifyDeposit", {
                        depositId: deposit.id,
                      })
                    }
                  >
                    <Text style={styles.verifyBtnText}>VERIFY DEPOSIT</Text>
                    <Ionicons name="arrow-forward" size={14} color="#111816" />
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === "approved" && deposit.review_note && (
                <View style={styles.noteWrap}>
                  <Text style={styles.noteText}>
                    <Text style={{ fontWeight: "500" }}>Note: </Text>
                    {deposit.review_note}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8F8" },
  scrollContent: { padding: 16, paddingBottom: 30 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },

  // Period
  periodScroll: { marginBottom: 12 },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    marginRight: 8,
  },
  periodBtnActive: { backgroundColor: "#13ECB9", borderColor: "#13ECB9" },
  periodText: { fontSize: 11, fontWeight: "700", color: "#618980" },
  periodTextActive: { color: "#111816" },

  // Hero
  heroCard: {
    backgroundColor: "#13ECB9",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#13ECB9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  heroLabel: {
    color: "#111816",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.7,
  },
  heroAmount: {
    color: "#111816",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 4,
  },
  heroSubLabel: {
    color: "#111816",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  heroIconWrap: {
    backgroundColor: "rgba(255,255,255,0.3)",
    padding: 8,
    borderRadius: 8,
  },
  heroDivider: { height: 1, backgroundColor: "rgba(17,24,22,0.1)" },
  heroBottom: { flexDirection: "row", paddingTop: 16 },
  heroMetaLabel: {
    color: "#111816",
    fontSize: 11,
    fontWeight: "500",
    opacity: 0.7,
  },
  heroMetaValue: {
    color: "#111816",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 2,
  },
  heroMetaDivider: { width: 1, backgroundColor: "rgba(17,24,22,0.1)" },

  // Metrics
  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DBE6E3",
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#618980",
    letterSpacing: 1,
  },
  metricValue: { fontSize: 18, fontWeight: "700", color: "#111816" },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(229,231,235,0.5)",
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: "700", color: "#618980" },
  tabTextActive: { color: "#111816" },
  tabBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#618980",
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  // Empty
  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 12,
  },

  // Deposit Card
  depositCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    marginBottom: 12,
    overflow: "hidden",
  },
  depositRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  depositAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(19,236,185,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  depositAvatarText: { color: "#13ECB9", fontWeight: "700", fontSize: 14 },
  depositName: { fontSize: 15, fontWeight: "700", color: "#111816" },
  depositPhone: {
    fontSize: 11,
    fontWeight: "500",
    color: "#618980",
    marginTop: 1,
  },
  depositDate: { fontSize: 11, color: "#618980", marginTop: 1 },
  depositTransferId: {
    fontSize: 10,
    color: "#4B5563",
    marginTop: 2,
    fontWeight: "700",
  },
  depositRight: { alignItems: "flex-end" },
  depositAmount: { fontSize: 14, fontWeight: "700", color: "#111816" },
  depositStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  depositStatusText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // Actions
  depositActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  proofThumb: {
    width: 80,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    overflow: "hidden",
  },
  proofImage: { width: "100%", height: "100%" },
  proofPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  verifyBtn: {
    flex: 1,
    backgroundColor: "#13ECB9",
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  verifyBtnText: {
    color: "#111816",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Note
  noteWrap: { paddingHorizontal: 16, paddingBottom: 16 },
  noteText: { fontSize: 12, color: "#6B7280" },
});
