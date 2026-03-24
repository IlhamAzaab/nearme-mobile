import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
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
  { route: "AddDriver", label: "Add Driver", icon: "person-add-outline" },
];

const DriverVerificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverDetails, setDriverDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchPendingDrivers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/pending-drivers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setPendingDrivers(data.drivers || []);
    } catch (e) {
      Alert.alert("Error", "Failed to fetch pending drivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingDrivers();
  }, [fetchPendingDrivers]);

  const fetchDriverDetails = async (driverId) => {
    setDetailsLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/driver-details/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDriverDetails(data);
        setSelectedDriver(driverId);
      } else {
        Alert.alert("Error", data.message || "Failed to load details");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to fetch driver details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleVerifyDriver = async (action) => {
    if (action === "reject" && !rejectReason.trim()) {
      Alert.alert("Required", "Please provide a reason for rejection");
      return;
    }
    setVerifyLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/verify-driver/${selectedDriver}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            reason:
              action === "reject"
                ? rejectReason
                : "Manager approved after verification",
          }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", data.message);
        setSelectedDriver(null);
        setDriverDetails(null);
        setShowRejectModal(false);
        setRejectReason("");
        fetchPendingDrivers();
      } else {
        Alert.alert("Error", data.message || "Failed to verify driver");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to verify driver");
    } finally {
      setVerifyLoading(false);
    }
  };

  /* ─── renderInfoRow helper ─── */
  const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "N/A"}</Text>
    </View>
  );

  /* ─── Driver Detail View ─── */
  const renderDetails = () => {
    if (!driverDetails) return null;
    const d = driverDetails.driver;
    const vl = driverDetails.vehicleLicense;
    const docs = driverDetails.documents || [];
    const bank = driverDetails.bankAccount;
    const contract = driverDetails.contract;

    return (
      <ScrollView contentContainerStyle={styles.detailScroll}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            setSelectedDriver(null);
            setDriverDetails(null);
          }}
        >
          <Ionicons name="arrow-back" size={18} color="#4F46E5" />
          <Text style={styles.backText}>Back to list</Text>
        </TouchableOpacity>

        {/* Header + Actions */}
        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>{d.full_name}</Text>
            <Text style={styles.detailEmail}>{d.email}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#DC2626" }]}
              onPress={() => setShowRejectModal(true)}
              disabled={verifyLoading}
            >
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#06C168" }]}
              onPress={() => handleVerifyDriver("approve")}
              disabled={verifyLoading}
            >
              <Text style={styles.actionBtnText}>
                {verifyLoading ? "Processing..." : "Approve"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.grid}>
            <InfoRow label="NIC Number" value={d.nic_number} />
            <InfoRow
              label="Date of Birth"
              value={
                d.date_of_birth
                  ? new Date(d.date_of_birth).toLocaleDateString()
                  : null
              }
            />
            <InfoRow label="Phone" value={d.phone} />
            <InfoRow label="City" value={d.city} />
            <InfoRow label="Address" value={d.address} />
            <InfoRow label="Working Time" value={d.working_time} />
          </View>
        </View>

        {/* Vehicle & License */}
        {vl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle & License Details</Text>
            <View style={styles.grid}>
              <InfoRow label="Vehicle Number" value={vl.vehicle_number} />
              <InfoRow label="Vehicle Type" value={vl.vehicle_type} />
              <InfoRow label="Vehicle Model" value={vl.vehicle_model} />
              <InfoRow
                label="License Number"
                value={vl.driving_license_number}
              />
              <InfoRow
                label="Insurance Expiry"
                value={
                  vl.insurance_expiry
                    ? new Date(vl.insurance_expiry).toLocaleDateString()
                    : null
                }
              />
              <InfoRow
                label="License Expiry"
                value={
                  vl.license_expiry_date
                    ? new Date(vl.license_expiry_date).toLocaleDateString()
                    : null
                }
              />
            </View>
          </View>
        )}

        {/* Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents ({docs.length})</Text>
          {docs.length > 0 ? (
            <View style={styles.docsGrid}>
              {docs.map((doc) => (
                <View key={doc.id} style={styles.docCard}>
                  <Text style={styles.docType}>
                    {(doc.document_type || "").replace(/_/g, " ").toUpperCase()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(doc.document_url)}
                  >
                    <Text style={styles.docLink}>View Document →</Text>
                  </TouchableOpacity>
                  {doc.verified && (
                    <Text style={styles.docVerified}>✓ Verified</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No documents uploaded</Text>
          )}
        </View>

        {/* Bank Account */}
        {bank && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bank Account</Text>
            <View style={styles.grid}>
              <InfoRow
                label="Account Holder"
                value={bank.account_holder_name}
              />
              <InfoRow label="Bank Name" value={bank.bank_name} />
              <InfoRow label="Branch" value={bank.branch} />
              <InfoRow label="Account Number" value={bank.account_number} />
            </View>
          </View>
        )}

        {/* Contract */}
        {contract && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contract</Text>
            <View style={styles.grid}>
              <InfoRow label="Version" value={contract.contract_version} />
              <InfoRow
                label="Accepted"
                value={
                  contract.accepted_at
                    ? new Date(contract.accepted_at).toLocaleString()
                    : null
                }
              />
              <InfoRow label="IP Address" value={contract.ip_address} />
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  /* ─── Main List View ─── */
  const renderList = () => (
    <ScrollView contentContainerStyle={styles.listScroll}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Driver Verification</Text>
        <Text style={styles.pageSubtitle}>
          Review and approve pending driver applications
        </Text>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listCardTitle}>
          Pending Applications ({pendingDrivers.length})
        </Text>
        {pendingDrivers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="person-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No pending drivers</Text>
          </View>
        ) : (
          pendingDrivers.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              style={[
                styles.driverCard,
                selectedDriver === driver.id && styles.driverCardSelected,
              ]}
              onPress={() => fetchDriverDetails(driver.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.driverName}>{driver.full_name || "N/A"}</Text>
              <Text style={styles.driverEmail}>{driver.email}</Text>
              <Text style={styles.driverMeta}>
                {driver.driver_type || "N/A"} · {driver.city || "N/A"}
              </Text>
              <Text style={styles.driverDate}>
                Applied: {new Date(driver.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#13ECB9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Driver Verification"
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
      {detailsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#13ECB9" />
          <Text style={{ color: "#6B7280", marginTop: 8 }}>
            Loading details...
          </Text>
        </View>
      ) : selectedDriver && driverDetails ? (
        renderDetails()
      ) : (
        renderList()
      )}

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Driver Application</Text>
            <Text style={styles.modalDesc}>
              Please provide a reason for rejecting this application:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g., Expired documents, incomplete information..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#E5E7EB" }]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
              >
                <Text style={[styles.modalBtnText, { color: "#374151" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: "#DC2626",
                    opacity: verifyLoading || !rejectReason.trim() ? 0.5 : 1,
                  },
                ]}
                onPress={() => handleVerifyDriver("reject")}
                disabled={verifyLoading || !rejectReason.trim()}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {verifyLoading ? "Rejecting..." : "Confirm Reject"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* List view */
  listScroll: { padding: 16 },
  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },
  pageSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 4 },

  listCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  listCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },

  driverCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 10,
  },
  driverCardSelected: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  driverName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  driverEmail: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  driverMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  driverDate: { fontSize: 10, color: "#D1D5DB", marginTop: 4 },

  /* Detail view */
  detailScroll: { padding: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backText: {
    fontSize: 13,
    color: "#4F46E5",
    marginLeft: 6,
    fontWeight: "600",
  },

  detailHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 16,
  },
  detailName: { fontSize: 20, fontWeight: "800", color: "#111827" },
  detailEmail: { fontSize: 13, color: "#6B7280", marginTop: 2 },

  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },

  grid: {},
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoLabel: { fontSize: 12, color: "#6B7280", flex: 1 },
  infoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "right",
  },

  docsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  docCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
  },
  docType: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  docLink: { fontSize: 11, color: "#4F46E5", fontWeight: "500" },
  docVerified: { fontSize: 10, color: "#06C168", marginTop: 4 },

  emptyWrap: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },

  /* Reject Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  modalDesc: { fontSize: 13, color: "#6B7280", marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#111827",
    minHeight: 100,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: { fontWeight: "700", fontSize: 13 },
});

export default DriverVerificationScreen;
