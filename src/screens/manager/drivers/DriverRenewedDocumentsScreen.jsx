import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
import { API_URL } from "../../../config/env";

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
  {
    route: "DriverRenewedDocuments",
    label: "Renewed Documents",
    icon: "document-text-outline",
  },
  { route: "AddDriver", label: "Add Driver", icon: "person-add-outline" },
];

const STATUS_OPTIONS = ["pending", "approved", "rejected", "all"];

const TYPE_LABELS = {
  license_front: "License Front",
  license_back: "License Back",
  insurance: "Insurance",
  revenue_license: "Annual License",
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatType(type) {
  return (
    TYPE_LABELS[type] ||
    String(type || "-")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export default function DriverRenewedDocumentsScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [renewedDocuments, setRenewedDocuments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeRejectId, setActiveRejectId] = useState("");

  const fetchRenewedDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const query = `status=${statusFilter}`;
      const response = await fetch(
        `${API_URL}/manager/renewed-documents?${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load renewed documents");
      }

      setRenewedDocuments(payload?.renewedDocuments || []);
    } catch (error) {
      Alert.alert(
        "Error",
        error?.message || "Unable to load renewed documents.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRenewedDocuments();
  }, [fetchRenewedDocuments]);

  const reviewRenewal = useCallback(
    async ({ renewalId, action, reason }) => {
      setActionLoadingId(renewalId);
      try {
        const token = await AsyncStorage.getItem("token");
        const response = await fetch(
          `${API_URL}/manager/renewed-documents/${renewalId}/review`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action, reason }),
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload?.message || "Failed to review renewal request",
          );
        }

        Alert.alert("Success", payload?.message || "Updated successfully.");
        await fetchRenewedDocuments();
      } catch (error) {
        Alert.alert(
          "Error",
          error?.message || "Unable to review renewal request.",
        );
      } finally {
        setActionLoadingId("");
      }
    },
    [fetchRenewedDocuments],
  );

  const pendingCount = useMemo(
    () => renewedDocuments.filter((item) => item.status === "pending").length,
    [renewedDocuments],
  );

  const openRejectModal = (renewalId) => {
    setActiveRejectId(renewalId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert("Reason required", "Please add a reason before rejecting.");
      return;
    }

    await reviewRenewal({
      renewalId: activeRejectId,
      action: "reject",
      reason: rejectReason.trim(),
    });

    setShowRejectModal(false);
    setActiveRejectId("");
    setRejectReason("");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Renewed Documents"
        showBack
        onMenuPress={() => setDrawerOpen(true)}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Driver Management"
        items={DRIVER_DRAWER_ITEMS}
        activeRoute={route.name}
        navigation={navigation}
      />

      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Renewed Documents</Text>
        <Text style={styles.pageSubtitle}>
          Pending approvals: {pendingCount}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filterRow}>
          {STATUS_OPTIONS.map((status) => {
            const active = status === statusFilter;
            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  active && styles.filterButtonActive,
                ]}
                onPress={() => setStatusFilter(status)}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.filterText, active && styles.filterTextActive]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#13ECB9" />
          </View>
        ) : renewedDocuments.length === 0 ? (
          <View style={styles.centerWrap}>
            <Ionicons name="document-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>No renewed document requests.</Text>
          </View>
        ) : (
          renewedDocuments.map((item) => {
            const reviewBusy = actionLoadingId === item.id;

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.typeText}>
                    {formatType(item.document_type)}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {(item.status || "pending").toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.metaText}>
                  Submitted: {formatDate(item.submitted_at)}
                </Text>
                <Text style={styles.metaText}>
                  Driver: {item.driver?.full_name || "-"}
                </Text>
                <Text style={styles.metaText}>
                  Email: {item.driver?.email || "-"}
                </Text>
                <Text style={styles.metaText}>
                  Phone: {item.driver?.phone || "-"}
                </Text>
                {!!item.review_reason && (
                  <Text style={styles.metaText}>
                    Reason: {item.review_reason}
                  </Text>
                )}

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => Linking.openURL(item.proposed_document_url)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.secondaryBtnText}>View File</Text>
                  </TouchableOpacity>

                  {item.status === "pending" && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.rejectBtn,
                          reviewBusy && styles.btnDisabled,
                        ]}
                        onPress={() => openRejectModal(item.id)}
                        disabled={reviewBusy}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.approveBtn,
                          reviewBusy && styles.btnDisabled,
                        ]}
                        onPress={() =>
                          reviewRenewal({
                            renewalId: item.id,
                            action: "approve",
                            reason: "Approved by manager",
                          })
                        }
                        disabled={reviewBusy}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.actionBtnText}>
                          {reviewBusy ? "..." : "Approve"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal transparent visible={showRejectModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Renewal Request</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Enter reason for rejection"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowRejectModal(false);
                  setActiveRejectId("");
                  setRejectReason("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={submitReject}
              >
                <Text style={styles.modalSubmitText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  pageHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  pageTitle: { fontSize: 21, fontWeight: "800", color: "#111827" },
  pageSubtitle: { marginTop: 4, fontSize: 12, color: "#64748B" },
  content: { padding: 16, gap: 10, paddingBottom: 24 },
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filterButton: {
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterButtonActive: { backgroundColor: "#4F46E5" },
  filterText: { fontSize: 11, fontWeight: "700", color: "#374151" },
  filterTextActive: { color: "#FFFFFF" },
  centerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 44,
  },
  emptyText: { marginTop: 10, color: "#94A3B8", fontSize: 13 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeText: { fontSize: 14, fontWeight: "800", color: "#111827" },
  statusBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: "800", color: "#4338CA" },
  metaText: { marginTop: 4, fontSize: 12, color: "#475569" },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: "auto",
  },
  secondaryBtnText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  approveBtn: {
    backgroundColor: "#06C168",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rejectBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
    fontSize: 13,
    color: "#0F172A",
    textAlignVertical: "top",
  },
  modalActions: { marginTop: 12, flexDirection: "row", gap: 8 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCancelText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalSubmitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
