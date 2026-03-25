import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";

export default function DriverWithdrawalsScreen({ navigation }) {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proofModal, setProofModal] = useState({ visible: false, url: "" });

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [sRes, hRes] = await Promise.all([
        fetch(`${API_URL}/driver/withdrawals/my/summary`, { headers }),
        fetch(`${API_URL}/driver/withdrawals/my/history`, { headers }),
      ]);
      const sData = await sRes.json();
      if (sData.success) setSummary(sData.summary || {});
      const hData = await hRes.json();
      if (hData.success) setHistory(hData.payments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const received = Number(summary?.total_withdrawals || 0);
  const earned = Number(summary?.total_earnings || 0);
  const remaining = Math.max(0, earned - received);
  const progress = earned > 0 ? Math.min(1, received / earned) : 0;

  const getStatusColors = (status) => {
    switch (status) {
      case "completed":
        return { bg: "#dcfce7", text: "#06C168" };
      case "pending":
        return { bg: "#fef9c3", text: "#ca8a04" };
      case "rejected":
        return { bg: "#fee2e2", text: "#dc2626" };
      default:
        return { bg: "#f3f4f6", text: "#6b7280" };
    }
  };

  if (loading)
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator
          size="large"
          color="#13ecb9"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.container}>
      <DriverScreenHeader
        title="Withdrawals"
        rightIcon="arrow-down"
        onBackPress={() => navigation.goBack()}
        onRightPress={() => navigation.navigate("DriverDepositsMain")}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor="#13ecb9"
          />
        }
      >
        {/* Hero Balance Card */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>Remaining Balance</Text>
          <Text style={s.heroAmount}>Rs {remaining.toFixed(2)}</Text>
          <Text style={s.heroSub}>Earnings not yet received</Text>
        </View>

        {/* Stats Grid */}
        <View style={s.statsGrid}>
          <View style={s.statBox}>
            <Text style={s.statValue}>Rs {earned.toFixed(2)}</Text>
            <Text style={s.statLabel}>Total Earned</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: "#13ecb9" }]}>
              Rs {received.toFixed(2)}
            </Text>
            <Text style={s.statLabel}>Total Received</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>
              Rs {Number(summary?.today_withdrawals || 0).toFixed(2)}
            </Text>
            <Text style={s.statLabel}>Today</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={s.progressCard}>
          <View style={s.progressHeader}>
            <Text style={s.progressLabel}>Payment Progress</Text>
            <Text style={s.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={s.progressBg}>
            <View
              style={[
                s.progressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
          <Text style={s.progressSub}>
            Rs {received.toFixed(2)} of Rs {earned.toFixed(2)} received
          </Text>
        </View>

        {/* History */}
        <Text style={s.sectionTitle}>Payment History</Text>
        {history.length === 0 ? (
          <View style={s.empty}>
            <Ionicons
              name="wallet"
              size={40}
              color="#d1d5db"
              style={{ marginBottom: 12 }}
            />
            <Text style={s.emptyText}>No withdrawal history</Text>
          </View>
        ) : (
          history.map((item) => {
            const sc = getStatusColors(item.status);
            return (
              <View key={item.id} style={s.historyItem}>
                <View style={s.historyLeft}>
                  <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.statusText, { color: sc.text }]}>
                      {item.status}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.historyAmount}>
                      Rs {Number(item.amount).toFixed(2)}
                    </Text>
                    <Text style={s.historyDate}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                {item.proof_url ? (
                  <TouchableOpacity
                    style={s.viewProofBtn}
                    onPress={() =>
                      setProofModal({ visible: true, url: item.proof_url })
                    }
                  >
                    <Text style={s.viewProofText}>View Proof</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Proof Modal */}
      <Modal visible={proofModal.visible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Payment Proof</Text>
            <TouchableOpacity
              style={s.openLinkBtn}
              onPress={() => Linking.openURL(proofModal.url)}
            >
              <Text style={s.openLinkText}>Open File</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.modalClose}
              onPress={() => setProofModal({ visible: false, url: "" })}
            >
              <Text style={s.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111816" },
  scroll: { padding: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#fff" },
  depositBtn: {
    backgroundColor: "#13ecb9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  depositBtnText: { fontSize: 13, color: "#111816", fontWeight: "700" },
  heroCard: {
    backgroundColor: "#1a2420",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e3029",
  },
  heroLabel: {
    fontSize: 12,
    color: "#618968",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: "800",
    color: "#13ecb9",
    marginBottom: 4,
  },
  heroSub: { fontSize: 13, color: "#618968" },
  statsGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: "#1a2420",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e3029",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: { fontSize: 11, color: "#618968" },
  progressCard: {
    backgroundColor: "#1a2420",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1e3029",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressLabel: { fontSize: 14, color: "#dbe6dd", fontWeight: "600" },
  progressPct: { fontSize: 14, color: "#13ecb9", fontWeight: "700" },
  progressBg: {
    height: 8,
    backgroundColor: "#1e3029",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: "#13ecb9", borderRadius: 4 },
  progressSub: { fontSize: 12, color: "#618968", marginTop: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#dbe6dd",
    marginBottom: 12,
  },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#618968" },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a2420",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1e3029",
  },
  historyLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },
  historyAmount: { fontSize: 15, fontWeight: "700", color: "#fff" },
  historyDate: { fontSize: 12, color: "#618968", marginTop: 2 },
  viewProofBtn: {
    backgroundColor: "#1e3029",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewProofText: { fontSize: 12, color: "#13ecb9", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "#1a2420",
    borderRadius: 20,
    padding: 24,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  openLinkBtn: {
    backgroundColor: "#13ecb9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  openLinkText: { fontSize: 14, fontWeight: "700", color: "#111816" },
  modalClose: { paddingVertical: 10 },
  modalCloseText: { fontSize: 14, color: "#618968" },
});
