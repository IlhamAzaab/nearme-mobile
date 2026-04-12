import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { DriverDashboardLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
];

const CHART_PERIOD_OPTIONS = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SRI_LANKA_TZ = "Asia/Colombo";

const getSriLankaDateKey = (dateValue) => {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA", {
    timeZone: SRI_LANKA_TZ,
  });
};

const getDateFromSriLankaKey = (key) => {
  if (!key) return null;
  const parsed = new Date(`${key}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const isDateInSelectedPeriod = (dateKey, selectedPeriod, todayKey) => {
  if (!dateKey || !todayKey) return false;

  if (selectedPeriod === "all") return true;
  if (selectedPeriod === "today") return dateKey === todayKey;

  if (selectedPeriod === "yesterday") {
    const todayDate = getDateFromSriLankaKey(todayKey);
    if (!todayDate) return false;
    todayDate.setDate(todayDate.getDate() - 1);
    const yesterdayKey = getSriLankaDateKey(todayDate);
    return dateKey === yesterdayKey;
  }

  const selectedDate = getDateFromSriLankaKey(dateKey);
  const currentDate = getDateFromSriLankaKey(todayKey);
  if (!selectedDate || !currentDate) return false;

  const diffMs = currentDate.getTime() - selectedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (selectedPeriod === "week") return diffDays >= 0 && diffDays < 7;
  if (selectedPeriod === "last30") return diffDays >= 0 && diffDays < 30;

  return false;
};

const formatCurrency = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

async function authFetchJson(url) {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

export default function DriverEarningsScreen({ navigation }) {
  const [period, setPeriod] = useState("all");
  const [chartPeriod, setChartPeriod] = useState("week");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const summaryQueryKey = ["driver", "earnings", "summary", period];
  const allTimeSummaryQueryKey = ["driver", "earnings", "summary", "all"];
  const historyQueryKey = ["driver", "earnings", "history"];
  const chartQueryKey = ["driver", "earnings", "chart", chartPeriod];

  const cachedSummary = queryClient.getQueryData(summaryQueryKey);
  const cachedAllTimeSummary = queryClient.getQueryData(allTimeSummaryQueryKey);
  const cachedHistory = queryClient.getQueryData(historyQueryKey);
  const cachedChart = queryClient.getQueryData(chartQueryKey);

  const summaryQuery = useQuery({
    queryKey: summaryQueryKey,
    queryFn: () =>
      authFetchJson(`${API_URL}/driver/earnings/summary?period=${period}`),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    initialData: cachedSummary || undefined,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const allTimeSummaryQuery = useQuery({
    queryKey: allTimeSummaryQueryKey,
    queryFn: () =>
      authFetchJson(`${API_URL}/driver/earnings/summary?period=all`),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    initialData: cachedAllTimeSummary || undefined,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: () =>
      authFetchJson(`${API_URL}/driver/earnings/history?limit=100`),
    staleTime: 60 * 1000,
    refetchInterval: 90 * 1000,
    initialData: cachedHistory || undefined,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const chartQuery = useQuery({
    queryKey: chartQueryKey,
    queryFn: () =>
      authFetchJson(
        `${API_URL}/driver/earnings/chart?chartPeriod=${chartPeriod}`,
      ),
    staleTime: 60 * 1000,
    refetchInterval: 90 * 1000,
    initialData: cachedChart || undefined,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["driver", "earnings"] });
    } finally {
      setRefreshing(false);
    }
  };

  const summary = summaryQuery.data?.summary || null;
  const allTimeSummary = allTimeSummaryQuery.data?.summary || null;
  const todayPerformance = summaryQuery.data?.today || null;
  const earnings = historyQuery.data?.earnings || [];
  const chartData = chartQuery.data?.chartData || [];

  const loading =
    (summaryQuery.isLoading && !summary) ||
    (historyQuery.isLoading && earnings.length === 0);

  const periodLabel = useMemo(() => {
    if (period === "all") return "All Time Earnings";
    if (period === "today") return "Today's Earnings";
    if (period === "yesterday") return "Yesterday's Earnings";
    if (period === "week") return "Last 7 Days Earnings";
    return "Last 30 Days Earnings";
  }, [period]);

  const dailyAvg = useMemo(() => {
    const totalEarnings = Number(allTimeSummary?.total_earnings || 0);
    const totalDeliveries = Number(allTimeSummary?.total_deliveries || 0);
    if (totalDeliveries <= 0) return 0;
    return totalEarnings / totalDeliveries;
  }, [allTimeSummary]);

  const periodDistanceKm = useMemo(() => {
    const todayKey = getSriLankaDateKey(new Date());
    if (!todayKey) return 0;

    return earnings.reduce((sum, item) => {
      const deliveryKey = getSriLankaDateKey(item?.delivered_at);
      if (!isDateInSelectedPeriod(deliveryKey, period, todayKey)) {
        return sum;
      }
      return sum + Number(item?.extra_distance_km || 0);
    }, 0);
  }, [earnings, period]);

  const chartSubtitle =
    chartPeriod === "week"
      ? "Last 7 Days"
      : chartPeriod === "month"
        ? "Last 30 Days"
        : "Last 12 Months";

  const dayWiseAnalytics = useMemo(() => {
    const itemsByDate = new Map();

    earnings.forEach((item) => {
      const key = getSriLankaDateKey(item?.delivered_at);
      if (!key) return;

      if (!itemsByDate.has(key)) {
        itemsByDate.set(key, {
          earned: 0,
          bonus: 0,
          tip: 0,
        });
      }

      const aggregate = itemsByDate.get(key);
      aggregate.earned += Number(item?.driver_earnings || 0);
      aggregate.bonus += Number(item?.bonus_amount || 0);
      aggregate.tip += Number(item?.tip_amount || 0);
    });

    const days = [];
    for (let i = 0; i < 30; i += 1) {
      const dayDate = new Date();
      dayDate.setDate(dayDate.getDate() - i);
      const key = getSriLankaDateKey(dayDate);
      if (!key) continue;

      const dateForLabel = getDateFromSriLankaKey(key);
      const aggregate = itemsByDate.get(key) || { earned: 0, bonus: 0, tip: 0 };

      days.push({
        key,
        dateLabel: dateForLabel
          ? dateForLabel.toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              timeZone: SRI_LANKA_TZ,
            })
          : key,
        dayLabel: dateForLabel
          ? dateForLabel.toLocaleDateString("en-IN", {
              weekday: "short",
              timeZone: SRI_LANKA_TZ,
            })
          : "-",
        earned: aggregate.earned,
        bonus: aggregate.bonus,
        tip: aggregate.tip,
      });
    }

    return days;
  }, [earnings]);

  const chartLabels = useMemo(() => {
    return chartData.map((item) => {
      const raw = String(item?.date || "");
      if (!raw) return "-";

      if (chartPeriod === "year") {
        const parts = raw.split("-");
        const monthIndex = Number(parts[1] || 1) - 1;
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return months[monthIndex] || raw;
      }

      const d = new Date(`${raw}T00:00:00`);
      if (Number.isNaN(d.getTime())) return raw;
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
  }, [chartData, chartPeriod]);

  const chartAmounts = useMemo(() => {
    if (!chartData.length) return [0];
    return chartData.map((item) => Number(item?.amount || 0));
  }, [chartData]);

  const hasError =
    summaryQuery.isError || historyQuery.isError || chartQuery.isError;
  const errorMessage =
    summaryQuery.error?.message ||
    historyQuery.error?.message ||
    chartQuery.error?.message ||
    "Failed to load earnings";

  if (loading) {
    return (
      <SafeAreaView
        style={s.container}
        edges={["left", "right", "top"]}
      >
        <DriverDashboardLoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={s.container}
      edges={["left", "right", "top"]}
    >
      <View style={{ flex: 1 }}>
        <DriverScreenSection
          screenKey="DriverEarnings"
          sectionIndex={0}
          style={s.headerSection}
        >
          <DriverScreenHeader
            title="Earnings"
            onBackPress={() => navigation.goBack()}
            rightIcon="refresh"
            onRightPress={onRefresh}
          />
        </DriverScreenSection>

        <DriverScreenSection
          screenKey="DriverEarnings"
          sectionIndex={1}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#06C168"]}
              />
            }
          >
            {hasError ? (
              <View style={s.errorCard}>
                <Text style={s.errorTitle}>Unable to load earnings</Text>
                <Text style={s.errorSubtitle}>{errorMessage}</Text>
                <TouchableOpacity style={s.retryButton} onPress={onRefresh}>
                  <Text style={s.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={s.periodHeaderWrap}>
              <Text style={s.periodHeaderText}>{periodLabel}</Text>
            </View>

            <View style={s.earningsCard}>
              <Text style={s.earningsLabel}>{periodLabel.toUpperCase()}</Text>
              <Text style={s.earningsAmount}>
                {formatCurrency(summary?.total_earnings)}
              </Text>
              <Text style={s.earningsDeliveries}>
                {summary?.total_deliveries || 0} deliveries
              </Text>

              <View style={s.periodGrid}>
                {PERIOD_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      s.periodChip,
                      period === option.value && s.periodChipActive,
                    ]}
                    onPress={() => setPeriod(option.value)}
                  >
                    <Text
                      style={[
                        s.periodChipText,
                        period === option.value && s.periodChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={s.withdrawalsCard}
              onPress={() => navigation.navigate("DriverWithdrawals")}
            >
              <View style={s.withdrawalsContent}>
                <Ionicons name="arrow-down-circle" size={24} color="#06C168" />
                <View style={s.withdrawalsTextWrap}>
                  <Text style={s.withdrawalsTitle}>My Withdrawals</Text>
                  <Text style={s.withdrawalsSubtitle}>
                    View payment history from management
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <View style={s.todayCard}>
              <View style={s.rowBetween}>
                <Text style={s.sectionTitle}>Today's Performance</Text>
                <Text style={s.sectionDate}>
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>

              <View style={s.todayGrid}>
                <View style={s.todayMetric}>
                  <Text style={s.todayMetricLabel}>Total Earnings</Text>
                  <Text style={s.todayMetricValue}>
                    {formatCurrency(todayPerformance?.earnings || 0)}
                  </Text>
                </View>
                <View style={s.todayMetric}>
                  <Text style={s.todayMetricLabel}>Deliveries</Text>
                  <Text style={s.todayMetricValue}>
                    {todayPerformance?.deliveries || 0}
                  </Text>
                </View>
              </View>

              <View style={s.avgRow}>
                <Text style={s.avgLabel}>Avg Per Delivery</Text>
                <Text style={s.avgValue}>
                  {formatCurrency(
                    (todayPerformance?.deliveries || 0) > 0
                      ? Number(todayPerformance?.earnings || 0) /
                          Number(todayPerformance?.deliveries || 1)
                      : 0,
                  )}
                </Text>
              </View>
            </View>

            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Daily Avg</Text>
                <Text style={s.statValue}>{formatCurrency(dailyAvg)}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Period Distance</Text>
                <Text style={s.statValue}>
                  {`${Number(periodDistanceKm || 0).toFixed(1)} km`}
                </Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Period Deliveries</Text>
                <Text style={s.statValue}>
                  {summary?.total_deliveries || 0}
                </Text>
              </View>
            </View>

            <View style={s.chartCard}>
              <View style={s.rowBetween}>
                <Text style={s.sectionTitle}>Earnings Performance</Text>
                <Text style={s.sectionDate}>{chartSubtitle}</Text>
              </View>

              <View style={s.chartPeriodRow}>
                {CHART_PERIOD_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setChartPeriod(option.value)}
                    style={[
                      s.chartPeriodButton,
                      chartPeriod === option.value && s.chartPeriodButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.chartPeriodText,
                        chartPeriod === option.value && s.chartPeriodTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {chartQuery.isLoading && chartData.length === 0 ? (
                <View style={s.chartPlaceholder}>
                  <Text style={s.chartPlaceholderText}>Loading chart...</Text>
                </View>
              ) : chartData.length === 0 ? (
                <View style={s.chartPlaceholder}>
                  <Text style={s.chartPlaceholderText}>
                    No chart data available
                  </Text>
                </View>
              ) : (
                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [{ data: chartAmounts, strokeWidth: 2 }],
                  }}
                  width={SCREEN_WIDTH - 56}
                  height={220}
                  yAxisLabel="Rs "
                  fromZero
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(6, 193, 104, ${opacity})`,
                    labelColor: (opacity = 1) =>
                      `rgba(107, 114, 128, ${opacity})`,
                    propsForDots: {
                      r: "3",
                      strokeWidth: "2",
                      stroke: "#06C168",
                    },
                  }}
                  bezier
                  style={s.chart}
                />
              )}
            </View>

            <View style={s.rowBetween}>
              <Text style={s.sectionTitle}>Last 30 Days Analytics</Text>
              <Text style={s.sectionDate}>Today First</Text>
            </View>

            {dayWiseAnalytics.length === 0 ? (
              <View style={s.emptyCard}>
                <Ionicons name="inbox" size={38} color="#d1d5db" />
                <Text style={s.emptyText}>No analytics yet</Text>
              </View>
            ) : (
              dayWiseAnalytics.map((item) => (
                <View key={item.key} style={s.analyticsCard}>
                  <View style={s.analyticsTopRow}>
                    <View style={s.analyticsDateWrap}>
                      <Text style={s.analyticsDateText}>{item.dateLabel}</Text>
                      <Text style={s.analyticsDayText}>{item.dayLabel}</Text>
                    </View>
                    <View style={s.analyticsEarningsWrap}>
                      <Text style={s.analyticsEarningsLabel}>Earned</Text>
                      <Text style={s.analyticsEarningsValue}>
                        {formatCurrency(item.earned)}
                      </Text>
                    </View>
                  </View>

                  <View style={s.analyticsDetailRow}>
                    <Text style={s.analyticsDetailText}>
                      {`Bonus: ${formatCurrency(item.bonus)}`}
                    </Text>
                    <Text style={s.analyticsDetailText}>
                      {`Tip: ${formatCurrency(item.tip)}`}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </DriverScreenSection>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  headerSection: {
    zIndex: 20,
    elevation: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  loader: { marginTop: 40 },
  scroll: { padding: 16, paddingBottom: 110 },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  errorTitle: { color: "#991b1b", fontWeight: "700", fontSize: 14 },
  errorSubtitle: { color: "#7f1d1d", fontSize: 12, marginTop: 4 },
  retryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  periodHeaderWrap: {
    alignSelf: "center",
    backgroundColor: "#e7f9ef",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  periodHeaderText: { color: "#0f5132", fontWeight: "700", fontSize: 12 },
  earningsCard: {
    backgroundColor: "#06C168",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  earningsLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  earningsAmount: {
    marginTop: 4,
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
  },
  earningsDeliveries: {
    marginTop: 6,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  periodGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodChip: {
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  periodChipActive: { backgroundColor: "#ffffff" },
  periodChipText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  periodChipTextActive: { color: "#0f172a" },
  withdrawalsCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  withdrawalsContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  withdrawalsTextWrap: { marginLeft: 10, flex: 1 },
  withdrawalsTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  withdrawalsSubtitle: { marginTop: 2, fontSize: 12, color: "#6b7280" },
  todayCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  sectionDate: { fontSize: 11, color: "#059669", fontWeight: "700" },
  todayGrid: { marginTop: 12, flexDirection: "row", gap: 10 },
  todayMetric: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
  },
  todayMetricLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  todayMetricValue: {
    marginTop: 6,
    fontSize: 20,
    color: "#111827",
    fontWeight: "800",
  },
  avgRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avgLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  avgValue: { fontSize: 15, color: "#111827", fontWeight: "700" },
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
    minHeight: 82,
  },
  statLabel: {
    fontSize: 10,
    color: "#6b7280",
    textTransform: "uppercase",
    fontWeight: "700",
  },
  statValue: {
    marginTop: 8,
    fontSize: 16,
    color: "#111827",
    fontWeight: "800",
  },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 14,
  },
  chartPeriodRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  chartPeriodButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chartPeriodButtonActive: { backgroundColor: "#06C168" },
  chartPeriodText: { fontSize: 11, color: "#4b5563", fontWeight: "700" },
  chartPeriodTextActive: { color: "#fff" },
  chart: { marginTop: 8, borderRadius: 12 },
  chartPlaceholder: {
    height: 190,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  chartPlaceholderText: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 26,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  analyticsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginTop: 8,
  },
  analyticsTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  analyticsDateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analyticsDateText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
  },
  analyticsDayText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
  },
  analyticsEarningsWrap: { alignItems: "flex-end" },
  analyticsEarningsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  analyticsEarningsValue: {
    marginTop: 2,
    fontSize: 15,
    color: "#111827",
    fontWeight: "800",
  },
  analyticsDetailRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  analyticsDetailText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
  },
});
