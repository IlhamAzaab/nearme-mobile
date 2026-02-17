import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Image,
  Linking,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../config/env";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AdminWithdrawals() {
  const navigation = useNavigation();
  const [summary, setSummary] = useState({
    total_earnings: 0,
    total_withdrawals: 0,
    remaining_balance: 0,
    today_withdrawals: 0,
    payment_count: 0,
  });
  const [payments, setPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Animation for modal
  const slideAnim = useState(new Animated.Value(300))[0];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPayment) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [selectedPayment]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const [summaryRes, paymentsRes] = await Promise.all([
        fetch(`${API_URL}/admin/withdrawals/admin/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/admin/withdrawals/admin/history`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const summaryData = await summaryRes.json();
      const paymentsData = await paymentsRes.json();

      if (summaryRes.ok && summaryData.summary) {
        setSummary(summaryData.summary);
      }
      if (paymentsRes.ok) {
        setPayments(paymentsData.payments || []);
      }
    } catch (err) {
      console.error("Error fetching withdrawal data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getProgressPercentage = () => {
    if (summary.total_earnings > 0) {
      return Math.min(100, (summary.total_withdrawals / summary.total_earnings) * 100);
    }
    return 0;
  };

  const openProofUrl = (url) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  // Loading Skeleton
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header Skeleton */}
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeleton, { width: 150, height: 24, marginBottom: 8 }]} />
            <View style={[styles.skeleton, { width: 100, height: 16 }]} />
          </View>

          {/* Balance Card Skeleton */}
          <View style={styles.skeletonBalanceCard}>
            <View style={[styles.skeleton, styles.skeletonDark, { width: 100, height: 12, marginBottom: 12 }]} />
            <View style={[styles.skeleton, styles.skeletonDark, { width: 180, height: 40, marginBottom: 8 }]} />
            <View style={[styles.skeleton, styles.skeletonDark, { width: 140, height: 12 }]} />
          </View>

          {/* Stats Skeleton */}
          <View style={styles.statsGrid}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonStatCard}>
                <View style={[styles.skeleton, { width: 50, height: 10, marginBottom: 8 }]} />
                <View style={[styles.skeleton, { width: 70, height: 20 }]} />
              </View>
            ))}
          </View>

          {/* Progress Skeleton */}
          <View style={styles.skeletonProgressCard}>
            <View style={[styles.skeleton, { width: 100, height: 12, marginBottom: 12 }]} />
            <View style={[styles.skeleton, { width: "100%", height: 10, borderRadius: 5 }]} />
          </View>

          {/* Payment List Skeleton */}
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonPaymentCard}>
              <View style={[styles.skeleton, { width: 40, height: 40, borderRadius: 20 }]} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={[styles.skeleton, { width: 80, height: 16, marginBottom: 6 }]} />
                <View style={[styles.skeleton, { width: 120, height: 12 }]} />
              </View>
              <View style={[styles.skeleton, { width: 40, height: 16 }]} />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Error State
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#22c55e"]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Withdrawals</Text>
            <Text style={styles.headerSubtitle}>View your payment history</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshIcon}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Hero Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>BALANCE TO RECEIVE</Text>
          <Text style={styles.balanceAmount}>Rs.{summary.remaining_balance?.toFixed(2)}</Text>
          <Text style={styles.balanceHint}>This is what the platform owes you</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL EARNED</Text>
            <Text style={styles.statValue}>Rs.{summary.total_earnings?.toFixed(0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL RECEIVED</Text>
            <Text style={[styles.statValue, styles.statValueGreen]}>
              Rs.{summary.total_withdrawals?.toFixed(0)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY</Text>
            <Text style={[styles.statValue, styles.statValueGreen]}>
              Rs.{summary.today_withdrawals?.toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Progress Bar Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Payment Progress</Text>
            <Text style={styles.progressPercent}>{getProgressPercentage().toFixed(0)}% received</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${getProgressPercentage()}%` }]} />
          </View>
          <View style={styles.progressFooter}>
            <Text style={styles.progressReceived}>
              Received: Rs.{summary.total_withdrawals?.toFixed(0)}
            </Text>
            <Text style={styles.progressPending}>
              Pending: Rs.{summary.remaining_balance?.toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Payment History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyIcon}>🕐</Text>
            <Text style={styles.historyTitle}>Payment History ({payments.length})</Text>
          </View>

          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🧾</Text>
              </View>
              <Text style={styles.emptyTitle}>No withdrawals yet</Text>
              <Text style={styles.emptySubtitle}>Payments from management will appear here</Text>
            </View>
          ) : (
            <View style={styles.paymentsList}>
              {payments.map((payment) => (
                <TouchableOpacity
                  key={payment.id}
                  style={styles.paymentCard}
                  onPress={() => setSelectedPayment(payment)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentIconContainer}>
                    <Text style={styles.paymentIcon}>✓</Text>
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentAmount}>
                      Rs.{parseFloat(payment.amount).toFixed(2)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {formatDate(payment.created_at)} at {formatTime(payment.created_at)}
                    </Text>
                  </View>
                  <View style={styles.paymentArrow}>
                    <Text style={styles.paymentViewText}>View</Text>
                    <Text style={styles.paymentArrowIcon}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Payment Detail Modal */}
      <Modal
        visible={!!selectedPayment}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedPayment(null)}>
          <Animated.View
            style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Modal Handle */}
              <View style={styles.modalHandle}>
                <View style={styles.modalHandleBar} />
              </View>

              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment Details</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedPayment(null)}
                >
                  <Text style={styles.modalCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Amount Display */}
              <View style={styles.modalAmountSection}>
                <Text style={styles.modalAmountLabel}>AMOUNT RECEIVED</Text>
                <Text style={styles.modalAmountValue}>
                  Rs.{selectedPayment ? parseFloat(selectedPayment.amount).toFixed(2) : "0.00"}
                </Text>
                <View style={styles.modalStatusBadge}>
                  <View style={styles.modalStatusDot} />
                  <Text style={styles.modalStatusText}>Completed</Text>
                </View>
              </View>

              {/* Details Box */}
              <View style={styles.modalDetailsBox}>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Date</Text>
                  <Text style={styles.modalDetailValue}>
                    {selectedPayment ? formatDate(selectedPayment.created_at) : "-"}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Time</Text>
                  <Text style={styles.modalDetailValue}>
                    {selectedPayment ? formatTime(selectedPayment.created_at) : "-"}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Transaction ID</Text>
                  <Text style={[styles.modalDetailValue, styles.monoFont]}>
                    {selectedPayment?.id?.substring(0, 12).toUpperCase() || "-"}
                  </Text>
                </View>
                {selectedPayment?.note && (
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Note</Text>
                    <Text style={[styles.modalDetailValue, { flex: 1, textAlign: "right" }]}>
                      {selectedPayment.note}
                    </Text>
                  </View>
                )}
              </View>

              {/* Proof Section */}
              {selectedPayment?.proof_url && (
                <View style={styles.proofSection}>
                  <Text style={styles.proofLabel}>TRANSFER RECEIPT</Text>
                  {selectedPayment.proof_type === "pdf" ? (
                    <TouchableOpacity
                      style={styles.proofPdfCard}
                      onPress={() => openProofUrl(selectedPayment.proof_url)}
                    >
                      <View style={styles.proofPdfIcon}>
                        <Text style={styles.proofPdfEmoji}>📄</Text>
                      </View>
                      <View style={styles.proofPdfInfo}>
                        <Text style={styles.proofPdfTitle}>View PDF Receipt</Text>
                        <Text style={styles.proofPdfSubtitle}>Tap to open in browser</Text>
                      </View>
                      <Text style={styles.proofPdfArrow}>↗</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.proofImageContainer}
                      onPress={() => openProofUrl(selectedPayment.proof_url)}
                    >
                      <Image
                        source={{ uri: selectedPayment.proof_url }}
                        style={styles.proofImage}
                        resizeMode="contain"
                      />
                      <View style={styles.proofImageFooter}>
                        <Text style={styles.proofImageHint}>Tap image to view full size</Text>
                        <Text style={styles.proofImageOpen}>Open</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    fontSize: 20,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803d",
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -1,
  },
  balanceHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 6,
  },
  statValueGreen: {
    color: "#16a34a",
  },

  // Progress Card
  progressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  progressPercent: {
    fontSize: 12,
    color: "#6b7280",
  },
  progressBarBg: {
    height: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 5,
  },
  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressReceived: {
    fontSize: 10,
    fontWeight: "600",
    color: "#16a34a",
  },
  progressPending: {
    fontSize: 10,
    fontWeight: "600",
    color: "#d97706",
  },

  // History Section
  historySection: {
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  historyIcon: {
    fontSize: 18,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },

  // Empty State
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 40,
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4b5563",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },

  // Payment Card
  paymentsList: {
    gap: 12,
  },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  paymentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentIcon: {
    fontSize: 18,
    color: "#16a34a",
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
  },
  paymentDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  paymentArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paymentViewText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
  },
  paymentArrowIcon: {
    fontSize: 18,
    color: "#9ca3af",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  modalHandle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 18,
    color: "#9ca3af",
  },
  modalAmountSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  modalAmountLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16a34a",
    letterSpacing: 1,
    marginBottom: 4,
  },
  modalAmountValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#111827",
  },
  modalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  modalStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  modalStatusText: {
    fontSize: 12,
    color: "#6b7280",
  },
  modalDetailsBox: {
    backgroundColor: "#f9fafb",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  modalDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalDetailLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  modalDetailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
  },
  monoFont: {
    fontFamily: 'monospace',
  },
  proofSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 32,
  },
  proofLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 12,
  },
  proofPdfCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
  },
  proofPdfIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  proofPdfEmoji: {
    fontSize: 24,
  },
  proofPdfInfo: {
    flex: 1,
    marginLeft: 12,
  },
  proofPdfTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  proofPdfSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  proofPdfArrow: {
    fontSize: 16,
    color: "#9ca3af",
  },
  proofImageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  proofImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#f9fafb",
  },
  proofImageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  proofImageHint: {
    fontSize: 10,
    color: "#9ca3af",
  },
  proofImageOpen: {
    fontSize: 10,
    fontWeight: "600",
    color: "#16a34a",
  },

  // Skeleton Loading
  skeletonHeader: {
    marginBottom: 20,
  },
  skeleton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  skeletonDark: {
    backgroundColor: "#bbf7d0",
  },
  skeletonBalanceCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  skeletonStatCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  skeletonProgressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  skeletonPaymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginBottom: 12,
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#b91c1c",
  },
});
