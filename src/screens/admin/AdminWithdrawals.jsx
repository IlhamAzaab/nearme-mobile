import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const DEFAULT_SUMMARY = {
  total_earnings: 0,
  total_withdrawals: 0,
  remaining_balance: 0,
  previous_balance: 0,
  today_earnings: 0,
  today_withdrawals: 0,
  last_30_days_earnings: 0,
  last_30_days_withdrawals: 0,
  payment_count: 0,
};

const SKELETON_LOOP_MS = 900;

export default function AdminWithdrawals() {
  const queryClient = useQueryClient();
  const [selectedPayment, setSelectedPayment] = useState(null);

  const modalTranslateY = useRef(new Animated.Value(280)).current;
  const skeletonOpacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 1,
          duration: SKELETON_LOOP_MS,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.55,
          duration: SKELETON_LOOP_MS,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [skeletonOpacity]);

  useEffect(() => {
    if (!selectedPayment) {
      modalTranslateY.setValue(280);
      return;
    }

    Animated.spring(modalTranslateY, {
      toValue: 0,
      friction: 9,
      tension: 75,
      useNativeDriver: true,
    }).start();
  }, [modalTranslateY, selectedPayment]);

  const summaryQuery = useQuery({
    queryKey: ["admin", "withdrawals", "summary"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${API_URL}/admin/withdrawals/admin/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok || !data.summary) {
        throw new Error(data?.message || "Failed to load withdrawal summary");
      }

      return data.summary;
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin", "withdrawals", "history"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${API_URL}/admin/withdrawals/admin/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to load withdrawal history");
      }

      return data.payments || [];
    },
  });

  const summary = summaryQuery.data || DEFAULT_SUMMARY;
  const payments = paymentsQuery.data || [];

  const loading =
    (summaryQuery.isLoading && !summaryQuery.data) ||
    (paymentsQuery.isLoading && !paymentsQuery.data?.length);
  const error =
    summaryQuery.error?.message || paymentsQuery.error?.message || null;
  const refreshing = summaryQuery.isFetching || paymentsQuery.isFetching;

  const pendingBalance = useMemo(
    () =>
      Math.max(
        0,
        Number(summary.remaining_balance || 0) -
          Number(summary.today_earnings || 0),
      ),
    [summary.remaining_balance, summary.today_earnings],
  );

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
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

  const openProofUrl = (url) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const animatedSkeletonStyle = { opacity: skeletonOpacity };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.skeletonHeader}>
            <Animated.View
              style={[
                styles.skeleton,
                animatedSkeletonStyle,
                { width: 170, height: 28, marginBottom: 8 },
              ]}
            />
            <Animated.View
              style={[
                styles.skeleton,
                animatedSkeletonStyle,
                { width: 96, height: 4, borderRadius: 999 },
              ]}
            />
          </View>

          <View style={styles.skeletonHeroCard}>
            <Animated.View
              style={[
                styles.skeletonGreen,
                animatedSkeletonStyle,
                { width: 100, height: 10, marginBottom: 12 },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonGreen,
                animatedSkeletonStyle,
                { width: 190, height: 40, marginBottom: 10 },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonGreen,
                animatedSkeletonStyle,
                { width: 130, height: 10, marginBottom: 6 },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonGreen,
                animatedSkeletonStyle,
                { width: 120, height: 22 },
              ]}
            />
          </View>

          <View style={styles.skeletonCard}>
            <Animated.View
              style={[
                styles.skeleton,
                animatedSkeletonStyle,
                { width: 130, height: 14, marginBottom: 10 },
              ]}
            />
            <Animated.View
              style={[
                styles.skeleton,
                animatedSkeletonStyle,
                { width: 150, height: 34, marginBottom: 10 },
              ]}
            />
            <View style={styles.skeletonGridTwo}>
              {[1, 2].map((i) => (
                <View key={i} style={styles.skeletonMiniCard}>
                  <Animated.View
                    style={[
                      styles.skeleton,
                      animatedSkeletonStyle,
                      { width: 70, height: 9, marginBottom: 8 },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeleton,
                      animatedSkeletonStyle,
                      { width: 90, height: 16 },
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.skeletonCard}>
            <Animated.View
              style={[
                styles.skeleton,
                animatedSkeletonStyle,
                { width: 130, height: 14, marginBottom: 10 },
              ]}
            />
            <View style={styles.skeletonGridTwo}>
              {[1, 2].map((i) => (
                <View key={i} style={styles.skeletonMiniCard}>
                  <Animated.View
                    style={[
                      styles.skeleton,
                      animatedSkeletonStyle,
                      { width: 64, height: 9, marginBottom: 8 },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeleton,
                      animatedSkeletonStyle,
                      { width: 94, height: 16 },
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.skeletonPaymentList}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonPaymentCard}>
                <Animated.View
                  style={[
                    styles.skeleton,
                    animatedSkeletonStyle,
                    { width: 38, height: 38, borderRadius: 19 },
                  ]}
                />
                <View style={styles.skeletonPaymentInfo}>
                  <Animated.View
                    style={[
                      styles.skeleton,
                      animatedSkeletonStyle,
                      { width: 110, height: 14, marginBottom: 6 },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeleton,
                      animatedSkeletonStyle,
                      { width: 150, height: 11 },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[
                    styles.skeleton,
                    animatedSkeletonStyle,
                    { width: 40, height: 12 },
                  ]}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#06C168"]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Withdrawals</Text>
            <View style={styles.headerUnderline} />
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshIcon}>R</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TOTAL EARNED</Text>
          <Text style={styles.heroAmount}>
            Rs.{Number(summary.total_earnings || 0).toFixed(2)}
          </Text>

          <View style={styles.heroSubWrap}>
            <Text style={styles.heroSubLabel}>TOTAL RECEIVE</Text>
            <Text style={styles.heroSubAmount}>
              Rs.{Number(summary.total_withdrawals || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardHeading}>BALANCE TO RECEIVE</Text>
          <Text style={styles.cardAmount}>
            Rs.{Number(summary.remaining_balance || 0).toFixed(2)}
          </Text>

          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>PENDING BALANCE</Text>
              <Text style={styles.statValue}>
                Rs.{pendingBalance.toFixed(2)}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>TODAY EARNED</Text>
              <Text style={styles.statValue}>
                Rs.{Number(summary.today_earnings || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Last 30 Days</Text>
          </View>
          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>EARNED</Text>
              <Text style={styles.statValue}>
                Rs.{Number(summary.last_30_days_earnings || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, styles.statValueGreen]}>
                Rs.{Number(summary.last_30_days_withdrawals || 0).toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>RECEIVE</Text>
            </View>
          </View>
        </View>

        <View style={styles.historySection}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>
              Payment History ({payments.length})
            </Text>
          </View>

          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>[]</Text>
              </View>
              <Text style={styles.emptyTitle}>No withdrawals yet</Text>
              <Text style={styles.emptySubtitle}>
                Payments from management will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.paymentsList}>
              {payments.map((payment) => (
                <TouchableOpacity
                  key={payment.id}
                  style={styles.paymentCard}
                  onPress={() => setSelectedPayment(payment)}
                  activeOpacity={0.85}
                >
                  <View style={styles.paymentIconContainer}>
                    <Text style={styles.paymentIcon}>OK</Text>
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentAmount}>
                      Rs.{parseFloat(payment.amount).toFixed(2)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {formatDate(payment.created_at)} at{" "}
                      {formatTime(payment.created_at)}
                    </Text>
                    {payment.note ? (
                      <Text style={styles.paymentNote} numberOfLines={1}>
                        {payment.note}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.paymentArrow}>
                    <Text style={styles.paymentViewText}>View</Text>
                    <Text style={styles.paymentArrowIcon}>{">"}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedPayment}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedPayment(null)}
        >
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: modalTranslateY }] },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle}>
                <View style={styles.modalHandleBar} />
              </View>

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment Details</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedPayment(null)}
                >
                  <Text style={styles.modalCloseIcon}>X</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalAmountSection}>
                <Text style={styles.modalAmountLabel}>AMOUNT RECEIVED</Text>
                <Text style={styles.modalAmountValue}>
                  Rs.
                  {selectedPayment
                    ? parseFloat(selectedPayment.amount).toFixed(2)
                    : "0.00"}
                </Text>
                <View style={styles.modalStatusBadge}>
                  <View style={styles.modalStatusDot} />
                  <Text style={styles.modalStatusText}>Completed</Text>
                </View>
              </View>

              <View style={styles.modalDetailsBox}>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Date</Text>
                  <Text style={styles.modalDetailValue}>
                    {selectedPayment
                      ? formatDate(selectedPayment.created_at)
                      : "-"}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Time</Text>
                  <Text style={styles.modalDetailValue}>
                    {selectedPayment
                      ? formatTime(selectedPayment.created_at)
                      : "-"}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Transaction ID</Text>
                  <Text style={[styles.modalDetailValue, styles.monoFont]}>
                    {selectedPayment?.id?.substring(0, 12).toUpperCase() || "-"}
                  </Text>
                </View>
                {selectedPayment?.note ? (
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Note</Text>
                    <Text
                      style={[
                        styles.modalDetailValue,
                        { flex: 1, textAlign: "right" },
                      ]}
                    >
                      {selectedPayment.note}
                    </Text>
                  </View>
                ) : null}
              </View>

              {selectedPayment?.proof_url ? (
                <View style={styles.proofSection}>
                  <Text style={styles.proofLabel}>TRANSFER RECEIPT</Text>
                  {selectedPayment.proof_type === "pdf" ? (
                    <TouchableOpacity
                      style={styles.proofPdfCard}
                      onPress={() => openProofUrl(selectedPayment.proof_url)}
                    >
                      <View style={styles.proofPdfIcon}>
                        <Text style={styles.proofPdfEmoji}>PDF</Text>
                      </View>
                      <View style={styles.proofPdfInfo}>
                        <Text style={styles.proofPdfTitle}>
                          View PDF Receipt
                        </Text>
                        <Text style={styles.proofPdfSubtitle}>
                          Tap to open in browser
                        </Text>
                      </View>
                      <Text style={styles.proofPdfArrow}>Open</Text>
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
                        <Text style={styles.proofImageHint}>
                          Tap image to view full size
                        </Text>
                        <Text style={styles.proofImageOpen}>Open</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
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
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 28,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 34,
  },
  headerUnderline: {
    marginTop: 3,
    width: 96,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#06C168",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16a34a",
  },

  heroCard: {
    backgroundColor: "#E6F9F1",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B8F0D0",
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1f2937",
    letterSpacing: 0.5,
  },
  heroAmount: {
    marginTop: 2,
    fontSize: 34,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.4,
  },
  heroSubWrap: {
    marginTop: 10,
  },
  heroSubLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.5,
  },
  heroSubAmount: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "800",
    color: "#06C168",
  },

  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1f2937",
    letterSpacing: 0.4,
  },
  cardAmount: {
    marginTop: 2,
    fontSize: 31,
    fontWeight: "800",
    color: "#ea580c",
    lineHeight: 36,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionAccent: {
    width: 4,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#06C168",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  statCell: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.4,
  },
  statValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  statValueGreen: {
    color: "#06C168",
  },

  historySection: {
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 28,
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyIcon: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9ca3af",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 3,
    textAlign: "center",
  },

  paymentsList: {
    gap: 10,
  },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E6F9F1",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentIcon: {
    fontSize: 10,
    fontWeight: "700",
    color: "#06C168",
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 10,
  },
  paymentAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  paymentDate: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
    fontWeight: "500",
  },
  paymentNote: {
    marginTop: 3,
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  paymentArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  paymentViewText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
  },
  paymentArrowIcon: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: -1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHandle: {
    alignItems: "center",
    paddingVertical: 10,
  },
  modalHandleBar: {
    width: 38,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9ca3af",
  },
  modalAmountSection: {
    alignItems: "center",
    paddingVertical: 14,
  },
  modalAmountLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#06C168",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  modalAmountValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 36,
  },
  modalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  modalStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#06C168",
  },
  modalStatusText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
  },
  modalDetailsBox: {
    backgroundColor: "#f9fafb",
    marginHorizontal: 18,
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalDetailLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  modalDetailValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
  },
  monoFont: {
    fontFamily: "monospace",
  },

  proofSection: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    paddingBottom: 28,
  },
  proofLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  proofPdfCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  proofPdfIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  proofPdfEmoji: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ef4444",
  },
  proofPdfInfo: {
    flex: 1,
    marginLeft: 10,
  },
  proofPdfTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  proofPdfSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
    fontWeight: "500",
  },
  proofPdfArrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
  },
  proofImageContainer: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  proofImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#f9fafb",
  },
  proofImageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  proofImageHint: {
    fontSize: 10,
    color: "#9ca3af",
  },
  proofImageOpen: {
    fontSize: 10,
    fontWeight: "700",
    color: "#06C168",
  },

  skeletonHeader: {
    marginBottom: 16,
  },
  skeleton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  skeletonGreen: {
    backgroundColor: "#B8F0D0",
    borderRadius: 6,
  },
  skeletonHeroCard: {
    backgroundColor: "#E6F9F1",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B8F0D0",
    marginBottom: 12,
  },
  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  skeletonGridTwo: {
    flexDirection: "row",
    gap: 8,
  },
  skeletonMiniCard: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  skeletonPaymentList: {
    gap: 10,
  },
  skeletonPaymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  skeletonPaymentInfo: {
    flex: 1,
    marginLeft: 10,
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    width: "100%",
    maxWidth: 300,
  },
  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ef4444",
    textAlign: "center",
    lineHeight: 36,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 10,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    textAlign: "center",
    fontWeight: "600",
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#DC2626",
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
