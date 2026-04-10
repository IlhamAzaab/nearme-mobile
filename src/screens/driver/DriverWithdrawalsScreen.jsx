import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { DriverDashboardLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const SRI_LANKA_TIME_ZONE = "Asia/Colombo";

const parseStoredLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatCurrency = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const isRawPdfUrl = (payment) => {
  if (!payment?.proof_url) return false;
  const isPdf = payment.proof_type === "pdf";
  return isPdf && payment.proof_url.includes("/raw/upload/");
};

const getPreviewUrl = (payment) => {
  if (!payment?.proof_url) return "";

  const isPdf =
    payment.proof_type === "pdf" || payment.proof_url?.includes(".pdf");

  if (isPdf && payment.proof_url.includes("/raw/upload/")) {
    return "";
  }

  if (isPdf && payment.proof_url.includes("cloudinary.com")) {
    let url = payment.proof_url;
    url = url.replace("/upload/", "/upload/pg_1/");

    if (url.includes(".pdf")) {
      url = url.replace(".pdf", ".jpg");
    } else if (!url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      url = `${url}.jpg`;
    }

    return url;
  }

  return payment.proof_url;
};

async function authFetchJson(url) {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

export default function DriverWithdrawalsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [proofViewer, setProofViewer] = useState({
    open: false,
    url: null,
    type: null,
    payment: null,
  });

  const summaryQuery = useQuery({
    queryKey: ["driver", "withdrawals", "summary"],
    queryFn: async () => {
      const data = await authFetchJson(
        `${API_URL}/driver/withdrawals/my/summary`,
      );
      if (!data?.summary) {
        throw new Error(data?.message || "Failed to load withdrawal summary");
      }
      return data.summary;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    initialData: () =>
      queryClient.getQueryData(["driver", "withdrawals", "summary"]),
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
  });

  const historyQuery = useQuery({
    queryKey: ["driver", "withdrawals", "history"],
    queryFn: async () => {
      const data = await authFetchJson(
        `${API_URL}/driver/withdrawals/my/history`,
      );
      return data.payments || [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    initialData: () =>
      queryClient.getQueryData(["driver", "withdrawals", "history"]),
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
  });

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["driver", "withdrawals"],
    });
  };

  const summary = summaryQuery.data || {
    total_earnings: 0,
    total_withdrawals: 0,
    remaining_balance: 0,
    today_earnings: 0,
    today_withdrawals: 0,
    payment_count: 0,
  };

  const payments = historyQuery.data || [];
  const loading =
    (summaryQuery.isLoading && !summaryQuery.data) ||
    (historyQuery.isLoading && !historyQuery.data);
  const refreshing = summaryQuery.isFetching || historyQuery.isFetching;

  const errorMessage =
    summaryQuery.error?.message || historyQuery.error?.message || null;

  const pendingBalance = Math.max(
    0,
    Number(summary.remaining_balance || 0) -
      Number(summary.today_earnings || 0),
  );

  const openTab = (tabName) => {
    if (tabName === "Payment") {
      navigation.navigate("DriverTabs", { screen: "Payment" });
      return;
    }

    if (tabName === "Active") {
      navigation.navigate("DriverMap");
      return;
    }

    navigation.navigate("DriverTabs", { screen: tabName });
  };

  const formatDate = (dateStr) => {
    const localDate = parseStoredLocalDate(dateStr);
    if (!localDate) return "-";

    return localDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: SRI_LANKA_TIME_ZONE,
    });
  };

  const formatTime = (dateStr) => {
    const localDate = parseStoredLocalDate(dateStr);
    if (!localDate) return "-";

    return localDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: SRI_LANKA_TIME_ZONE,
    });
  };

  const paymentCount = useMemo(() => payments.length, [payments]);

  useEffect(() => {
    const requestedPaymentId = route?.params?.paymentId;
    if (!requestedPaymentId || !payments.length) return;

    const matched = payments.find(
      (item) => String(item?.id) === String(requestedPaymentId),
    );

    if (matched) {
      setSelectedPayment(matched);
      navigation.setParams?.({ paymentId: null });
    }
  }, [route?.params?.paymentId, payments, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={["left", "right", "bottom"]}>
        <DriverDashboardLoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["left", "right", "bottom"]}>
      <View style={{ flex: 1 }}>
        <DriverScreenSection screenKey="DriverWithdrawals" sectionIndex={0}>
          <DriverScreenHeader
            title="My Withdrawals"
            onBackPress={() => navigation.goBack()}
            rightIcon="refresh"
            onRightPress={onRefresh}
          />
        </DriverScreenSection>

        <DriverScreenSection
          screenKey="DriverWithdrawals"
          sectionIndex={1}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={s.scrollView}
            contentContainerStyle={s.scroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#06C168"]}
                tintColor="#06C168"
              />
            }
          >
            {errorMessage ? (
              <View style={s.errorCard}>
                <Text style={s.errorTitle}>Unable to load withdrawals</Text>
                <Text style={s.errorSubtitle}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={s.balanceCard}>
              <Text style={s.balanceLabel}>BALANCE TO RECEIVE</Text>
              <Text style={s.balanceAmount}>
                {formatCurrency(summary.remaining_balance)}
              </Text>

              <View style={s.balanceGrid}>
                <View style={s.balanceCell}>
                  <Text style={s.balanceCellLabel}>PENDING BALANCE</Text>
                  <Text style={s.balanceCellValue}>
                    {formatCurrency(pendingBalance)}
                  </Text>
                </View>
                <View style={s.balanceCell}>
                  <Text style={s.balanceCellLabel}>TODAY EARNED</Text>
                  <Text style={s.balanceCellValue}>
                    {formatCurrency(summary.today_earnings)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.totalCard}>
              <Text style={s.totalLabel}>TOTAL EARNED</Text>
              <Text style={s.totalAmount}>
                {formatCurrency(summary.total_earnings)}
              </Text>

              <View style={s.totalReceiveWrap}>
                <Text style={s.totalReceiveLabel}>TOTAL RECEIVE</Text>
                <Text style={s.totalReceiveAmount}>
                  {formatCurrency(summary.total_withdrawals)}
                </Text>
              </View>
            </View>

            <View style={s.sectionHeaderRow}>
              <View style={s.sectionAccent} />
              <Text
                style={s.sectionTitle}
              >{`Payment History (${paymentCount})`}</Text>
            </View>

            {payments.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>No withdrawals yet</Text>
              </View>
            ) : (
              payments.map((payment) => (
                <TouchableOpacity
                  key={payment.id}
                  style={s.paymentCard}
                  activeOpacity={0.95}
                  onPress={() => setSelectedPayment(payment)}
                >
                  <View style={s.paymentLeftIcon}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#06C168"
                    />
                  </View>

                  <View style={s.paymentMain}>
                    <Text style={s.paymentAmount}>
                      {formatCurrency(Number(payment.amount || 0))}
                    </Text>
                    <Text style={s.paymentDateLine}>
                      {`${formatDate(payment.created_at)} at ${formatTime(payment.created_at)}`}
                    </Text>
                    <Text style={s.paymentId}>
                      {`Transfer ID: ${payment.id?.substring(0, 12).toUpperCase()}`}
                    </Text>
                  </View>

                  <View style={s.paymentRight}>
                    <Text style={s.paymentViewText}>View</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#9ca3af"
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </DriverScreenSection>
      </View>

      <View
        style={[
          s.bottomNav,
          { paddingBottom: insets.bottom, height: 70 + insets.bottom },
        ]}
      >
        <TouchableOpacity
          style={s.navItem}
          onPress={() => openTab("Dashboard")}
        >
          <Ionicons name="home" size={22} color="#9ca3af" />
          <Text style={s.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.navItem}
          onPress={() => openTab("Available")}
        >
          <Ionicons name="list" size={22} color="#9ca3af" />
          <Text style={s.navLabel}>Available</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => openTab("Active")}>
          <Ionicons name="location" size={22} color="#9ca3af" />
          <Text style={s.navLabel}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => openTab("Earnings")}>
          <Ionicons name="wallet" size={22} color="#9ca3af" />
          <Text style={s.navLabel}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => openTab("Payment")}>
          <Ionicons name="card" size={22} color="#9ca3af" />
          <Text style={s.navLabel}>Payment</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!selectedPayment}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedPayment(null)}>
          <View style={s.bottomSheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.bottomSheet}>
                <View style={s.sheetHandle} />

                <View style={s.sheetHeaderRow}>
                  <Text style={s.sheetTitle}>Payment Details</Text>
                  <TouchableOpacity onPress={() => setSelectedPayment(null)}>
                    <Ionicons name="close" size={22} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                {selectedPayment ? (
                  <>
                    <View style={s.sheetAmountWrap}>
                      <Text style={s.sheetAmountLabel}>AMOUNT RECEIVED</Text>
                      <Text style={s.sheetAmountText}>
                        {formatCurrency(selectedPayment.amount)}
                      </Text>
                      <View style={s.sheetStatusRow}>
                        <View style={s.sheetStatusDot} />
                        <Text style={s.sheetStatusText}>Completed</Text>
                      </View>
                    </View>

                    <View style={s.sheetMetaCard}>
                      <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Date</Text>
                        <Text style={s.metaValue}>
                          {formatDate(selectedPayment.created_at)}
                        </Text>
                      </View>
                      <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Time</Text>
                        <Text style={s.metaValue}>
                          {formatTime(selectedPayment.created_at)}
                        </Text>
                      </View>
                      <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Transaction ID</Text>
                        <Text style={s.metaValueMono}>
                          {selectedPayment.id?.substring(0, 12).toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {selectedPayment.proof_url ? (
                      <View>
                        <Text style={s.receiptLabel}>TRANSFER RECEIPT</Text>

                        {selectedPayment.proof_type === "pdf" ? (
                          <TouchableOpacity
                            style={s.receiptButton}
                            onPress={() =>
                              setProofViewer({
                                open: true,
                                url: selectedPayment.proof_url,
                                type: "pdf",
                                payment: selectedPayment,
                              })
                            }
                          >
                            <View style={s.receiptIconWrap}>
                              <Ionicons
                                name="document-text-outline"
                                size={22}
                                color="#ef4444"
                              />
                            </View>
                            <View style={s.receiptTextWrap}>
                              <Text style={s.receiptTitle}>
                                View PDF Receipt
                              </Text>
                              <Text style={s.receiptSub}>
                                Tap to preview here
                              </Text>
                            </View>
                            <Ionicons
                              name="open-outline"
                              size={16}
                              color="#9ca3af"
                            />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={s.receiptPreviewWrap}
                            onPress={() =>
                              setProofViewer({
                                open: true,
                                url: selectedPayment.proof_url,
                                type: "image",
                                payment: selectedPayment,
                              })
                            }
                          >
                            <Image
                              source={{ uri: selectedPayment.proof_url }}
                              style={s.receiptImage}
                              resizeMode="cover"
                            />
                            <View style={s.receiptPreviewFooter}>
                              <Text style={s.receiptPreviewHint}>
                                Tap image to preview full size
                              </Text>
                              <Text style={s.receiptPreviewView}>View</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={proofViewer.open}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() =>
          setProofViewer({ open: false, url: null, type: null, payment: null })
        }
      >
        <SafeAreaView style={s.viewerContainer}>
          <View style={s.viewerHeader}>
            <TouchableOpacity
              style={s.viewerBack}
              onPress={() =>
                setProofViewer({
                  open: false,
                  url: null,
                  type: null,
                  payment: null,
                })
              }
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
              <Text style={s.viewerBackText}>Back</Text>
            </TouchableOpacity>

            <Text style={s.viewerTitle}>
              {proofViewer.type === "pdf" ? "PDF RECEIPT" : "IMAGE RECEIPT"}
            </Text>

            <View style={s.viewerHeaderSpacer} />
          </View>

          <View style={s.viewerBody}>
            {proofViewer.type === "pdf" &&
            proofViewer.payment &&
            isRawPdfUrl(proofViewer.payment) ? (
              <View style={s.pdfFallbackWrap}>
                <Ionicons
                  name="document-text-outline"
                  size={52}
                  color="#f87171"
                />
                <Text style={s.pdfFallbackTitle}>
                  PDF first page unavailable
                </Text>
                <Text style={s.pdfFallbackSub}>
                  Preview could not be generated
                </Text>
              </View>
            ) : (proofViewer.type === "pdf" || proofViewer.type === "image") &&
              (getPreviewUrl(proofViewer.payment) || proofViewer.url) ? (
              <WebView
                source={{
                  uri: getPreviewUrl(proofViewer.payment) || proofViewer.url,
                }}
                style={s.viewerWebView}
                originWhitelist={["*"]}
                setBuiltInZoomControls
                setDisplayZoomControls={false}
                scalesPageToFit
                bounces={false}
                overScrollMode="never"
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  loader: { marginTop: 32 },
  scrollView: { flex: 1 },
  scroll: { padding: 14, paddingBottom: 120, gap: 12 },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
  },
  errorTitle: { color: "#991b1b", fontWeight: "700", fontSize: 13 },
  errorSubtitle: { color: "#7f1d1d", marginTop: 4, fontSize: 12 },
  totalCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#b7d9c2",
    borderRadius: 14,
    padding: 16,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    textTransform: "uppercase",
  },
  totalAmount: {
    marginTop: 0,
    fontSize: 30,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.8,
  },
  totalReceiveWrap: { marginTop: 8 },
  totalReceiveLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#111827",
  },
  totalReceiveAmount: {
    marginTop: 0,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.6,
  },
  balanceCard: {
    backgroundColor: "#5dd17c",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    textTransform: "uppercase",
  },
  balanceAmount: {
    marginTop: 4,
    fontSize: 36,
    fontWeight: "700",
    color: "#11111",
    letterSpacing: -0.8,
  },
  balanceGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  balanceCell: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  balanceCellLabel: {
    fontSize: 9,
    color: "#6b7280",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  balanceCellValue: {
    marginTop: 4,
    fontSize: 17,
    color: "#111827",
    fontWeight: "800",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  sectionAccent: {
    width: 3,
    height: 24,
    borderRadius: 2,
    backgroundColor: "#06C168",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    alignItems: "center",
  },
  emptyText: { color: "#6b7280", fontWeight: "600" },
  paymentCard: {
    backgroundColor: "#ffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  paymentLeftIcon: {
    width: 36,
    height: 36,
    borderRadius: 35,
    backgroundColor: "#ecfdf3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  paymentMain: { flex: 1 },
  paymentAmount: { fontSize: 16, fontWeight: "800", color: "#111827" },
  paymentDateLine: { marginTop: 2, fontSize: 11, color: "#6b7280" },
  paymentId: {
    marginTop: 4,
    fontSize: 10,
    color: "#374151",
    fontWeight: "500",
  },
  paymentRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  paymentViewText: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },
  sheetAmountWrap: { alignItems: "center", marginTop: 8, marginBottom: 10 },
  sheetAmountLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16a34a",
    textTransform: "uppercase",
  },
  sheetAmountText: {
    marginTop: 4,
    fontSize: 34,
    color: "#0f172a",
    fontWeight: "800",
  },
  sheetStatusRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  sheetStatusText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  sheetMetaCard: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLabel: { fontSize: 12, color: "#6b7280" },
  metaValue: { fontSize: 12, color: "#111827", fontWeight: "700" },
  metaValueMono: { fontSize: 12, color: "#111827", fontWeight: "700" },
  receiptLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  receiptButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
  },
  receiptIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptTextWrap: { flex: 1 },
  receiptTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  receiptSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  receiptPreviewWrap: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  receiptImage: { width: "100%", height: 160, backgroundColor: "#f9fafb" },
  receiptPreviewFooter: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  receiptPreviewHint: { fontSize: 11, color: "#9ca3af" },
  receiptPreviewView: { fontSize: 11, color: "#16a34a", fontWeight: "700" },
  viewerContainer: { flex: 1, backgroundColor: "#000" },
  viewerHeader: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0b0b0b",
  },
  viewerBack: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewerBackText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  viewerTitle: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  viewerHeaderSpacer: { width: 56 },
  viewerBody: { flex: 1 },
  viewerWebView: { flex: 1, backgroundColor: "#000" },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    paddingTop: 8,
    paddingHorizontal: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    zIndex: 30,
  },
  navItem: {
    width: 65,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    marginTop: 2,
  },
  pdfFallbackWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pdfFallbackTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  pdfFallbackSub: { color: "#9ca3af", fontSize: 13 },
});
