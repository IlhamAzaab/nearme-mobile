import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import ManagerHeader from "../../components/manager/ManagerHeader";
import { API_URL } from "../../config/env";

const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "all", label: "All Time" },
];

const MANAGER_COUNT = 2;

export default function ManagerAccountScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [period, setPeriod] = useState("daily");
  const [earnings, setEarnings] = useState(null);
  const [managerInfo, setManagerInfo] = useState(null);

  // Fetch manager profile
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const res = await fetch(`${API_URL}/manager/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data?.manager) {
          setManagerInfo(data.manager);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // Fetch earnings summary
  const fetchEarnings = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      setEarningsLoading(true);
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const res = await fetch(
          `${API_URL}/manager/earnings/summary?period=${period}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setEarnings(data.summary || null);
        }
      } catch (err) {
        console.error("Failed to fetch earnings:", err);
      } finally {
        setEarningsLoading(false);
        setRefreshing(false);
      }
    },
    [period],
  );

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => logout() },
    ]);
  };

  const fmt = (v) =>
    `Rs.${Number(v || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const totalEarning = earnings?.total_earning || 0;
  const myEarning = totalEarning / MANAGER_COUNT;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label || "Today";

  const displayName = managerInfo?.username || user?.name || "Manager";
  const displayEmail = managerInfo?.email || user?.email || "";
  const displayPhone = managerInfo?.mobile_number || "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="My Account"
        showBack
        onRefresh={() => fetchEarnings(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchEarnings(true)}
            colors={["#06C168"]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#06C168" />
          </View>
        ) : (
          <>
            {/* Profile Card – gradient-style */}
            <View style={styles.profileCard}>
              <View style={styles.profileDecoCircle1} />
              <View style={styles.profileDecoCircle2} />
              <View style={styles.profileContent}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {displayEmail}
                  </Text>
                  {displayPhone ? (
                    <Text style={styles.profilePhone}>{displayPhone}</Text>
                  ) : null}
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>MANAGER</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ===== My Earnings Section ===== */}
            <View style={styles.earningsSection}>
              <View style={styles.earningsSectionHeader}>
                <Text style={styles.sectionTitle}>MY EARNINGS</Text>
                <Text style={styles.sectionSubtitle}>
                  Your share (1/{MANAGER_COUNT} of total manager earnings)
                </Text>
              </View>

              {/* Period Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodRow}
              >
                {PERIODS.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      styles.periodPill,
                      period === p.key && styles.periodPillActive,
                    ]}
                    onPress={() => setPeriod(p.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.periodPillText,
                        period === p.key && styles.periodPillTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {earningsLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#06C168" />
                </View>
              ) : (
                <>
                  {/* My Earnings Hero */}
                  <View style={styles.heroCard}>
                    <Text style={styles.heroLabel}>
                      {periodLabel} — My Share
                    </Text>
                    <Text style={styles.heroValue}>{fmt(myEarning)}</Text>
                  </View>

                  {/* Quick Stats Row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>TOTAL EARNINGS</Text>
                      <Text style={styles.statValue}>{fmt(totalEarning)}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>DELIVERED ORDERS</Text>
                      <Text style={styles.statValue}>
                        {earnings?.delivered_orders || 0}
                      </Text>
                    </View>
                  </View>

                  {/* Formula Breakdown */}
                  <View style={styles.formulaCard}>
                    <View style={styles.formulaRow}>
                      <Text style={styles.formulaLabel}>Total Collected</Text>
                      <Text style={styles.formulaValue}>
                        {fmt(earnings?.total_collected || 0)}
                      </Text>
                    </View>
                    <View style={styles.formulaRow}>
                      <Text style={[styles.formulaLabel, { color: "#D97706" }]}>
                        − Restaurant Pay
                      </Text>
                      <Text style={[styles.formulaValue, { color: "#D97706" }]}>
                        {fmt(earnings?.admin_total || 0)}
                      </Text>
                    </View>
                    <View style={styles.formulaRow}>
                      <Text style={[styles.formulaLabel, { color: "#0EA5E9" }]}>
                        − Driver Earnings
                      </Text>
                      <Text style={[styles.formulaValue, { color: "#0EA5E9" }]}>
                        {fmt(earnings?.total_driver_earnings || 0)}
                      </Text>
                    </View>
                    <View style={styles.formulaDivider} />
                    <View style={styles.formulaRow}>
                      <Text style={styles.formulaTotalLabel}>
                        Manager Earnings
                      </Text>
                      <Text style={styles.formulaTotalValue}>
                        {fmt(totalEarning)}
                      </Text>
                    </View>
                    <View style={styles.formulaRow}>
                      <Text style={styles.formulaLabel}>
                        ÷ {MANAGER_COUNT} managers
                      </Text>
                      <Text style={styles.formulaMyShare}>
                        {fmt(myEarning)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Quick Links */}
            <View style={styles.quickLinksSection}>
              <Text style={styles.sectionTitle}>QUICK LINKS</Text>

              <TouchableOpacity
                style={styles.quickLink}
                onPress={() => navigation.navigate("Earnings")}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.quickLinkIcon, { backgroundColor: "#DBEAFE" }]}
                >
                  <Ionicons name="bar-chart" size={18} color="#2563EB" />
                </View>
                <Text style={styles.quickLinkText}>Detailed Earnings</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickLink}
                onPress={() => navigation.navigate("Drivers")}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.quickLinkIcon, { backgroundColor: "#B8F0D0" }]}
                >
                  <Ionicons name="wallet" size={18} color="#06C168" />
                </View>
                <Text style={styles.quickLinkText}>Manage Deposits</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderBottomWidth: 0 }]}
                onPress={() => navigation.navigate("Reports")}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.quickLinkIcon, { backgroundColor: "#EDE9FE" }]}
                >
                  <Ionicons name="stats-chart" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.quickLinkText}>View Reports</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            {/* Version */}
            <Text style={styles.versionText}>NearMe Manager v1.0</Text>

            <View style={{ height: 30 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { paddingBottom: 20 },

  loadingBox: { paddingVertical: 60, alignItems: "center" },

  /* Profile Card */
  profileCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    overflow: "hidden",
    position: "relative",
  },
  profileDecoCircle1: {
    position: "absolute",
    top: -32,
    right: -32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  profileDecoCircle2: {
    position: "absolute",
    bottom: -24,
    left: -24,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    zIndex: 1,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  profileEmail: {
    fontSize: 13,
    color: "rgba(167, 243, 208, 0.7)",
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 11,
    color: "rgba(167, 243, 208, 0.5)",
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  roleText: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(167, 243, 208, 0.9)",
    letterSpacing: 1.5,
  },

  /* Earnings Section */
  earningsSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  earningsSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },

  /* Period Selector */
  periodRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    paddingBottom: 12,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  periodPillActive: { backgroundColor: "#06C168" },
  periodPillText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  periodPillTextActive: { color: "#fff" },

  /* Hero Card */
  heroCard: {
    backgroundColor: "#EDFBF2",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#B8F0D0",
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#06C168",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 30,
    fontWeight: "900",
    color: "#04553C",
  },

  /* Stats Row */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },

  /* Formula Breakdown */
  formulaCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  formulaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  formulaLabel: { fontSize: 13, color: "#6B7280" },
  formulaValue: { fontSize: 13, fontWeight: "600", color: "#374151" },
  formulaDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  formulaTotalLabel: { fontSize: 13, fontWeight: "700", color: "#111827" },
  formulaTotalValue: { fontSize: 13, fontWeight: "700", color: "#111827" },
  formulaMyShare: { fontSize: 14, fontWeight: "800", color: "#04553C" },

  /* Quick Links */
  quickLinksSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    paddingTop: 16,
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  quickLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  quickLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  /* Logout */
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },

  /* Version */
  versionText: {
    textAlign: "center",
    fontSize: 10,
    color: "#D1D5DB",
    fontWeight: "500",
    marginTop: 16,
  },
});
