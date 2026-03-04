import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

const ADMIN_DRAWER_ITEMS = [
  {
    route: "AdminPayments",
    label: "Admin Payments",
    icon: "wallet-outline",
    tabTarget: "Admins",
  },
  { route: "AddAdmin", label: "Add Admin", icon: "person-add-outline" },
  {
    route: "AdminManagement",
    label: "Admin Management",
    icon: "people-outline",
  },
  {
    route: "RestaurantManagement",
    label: "Restaurant Management",
    icon: "restaurant-outline",
  },
  {
    route: "PendingRestaurants",
    label: "Pending Restaurants",
    icon: "time-outline",
  },
];

const PendingRestaurantsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchRestaurants = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/pending-restaurants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRestaurants(data.restaurants || []);
    } catch (e) {
      console.error("Fetch pending restaurants error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const handleSelectRestaurant = async (restaurantId) => {
    setSelectedRestaurant(restaurantId);
    setDetailsLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/restaurant-details/${restaurantId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) setDetails(data);
    } catch (e) {
      console.error("Fetch restaurant details error", e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRestaurant) return;
    setApproving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/verify-restaurant/${selectedRestaurant}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "approve" }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Restaurant approved successfully!");
        setRestaurants((prev) =>
          prev.filter((r) => r.id !== selectedRestaurant),
        );
        setSelectedRestaurant(null);
        setDetails(null);
      } else {
        Alert.alert("Error", data?.message || "Failed to approve restaurant");
      }
    } catch (e) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRestaurant || !rejectionReason.trim()) {
      Alert.alert("Required", "Please provide a reason for rejection");
      return;
    }
    setRejecting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/verify-restaurant/${selectedRestaurant}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "reject", reason: rejectionReason }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Restaurant rejected");
        setRestaurants((prev) =>
          prev.filter((r) => r.id !== selectedRestaurant),
        );
        setSelectedRestaurant(null);
        setDetails(null);
        setShowRejectModal(false);
        setRejectionReason("");
      } else {
        Alert.alert("Error", data?.message || "Failed to reject restaurant");
      }
    } catch (e) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setRejecting(false);
    }
  };

  const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : "N/A");

  /* ─── Info Row helper ─── */
  const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "N/A"}</Text>
    </View>
  );

  /* ─── Detail View ─── */
  const renderDetails = () => {
    if (!details) return null;
    const admin = details.admin;
    const rest = details.restaurant;
    const bank = details.bankAccount;

    return (
      <ScrollView contentContainerStyle={styles.detailScroll}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            setSelectedRestaurant(null);
            setDetails(null);
          }}
        >
          <Ionicons name="arrow-back" size={18} color="#4F46E5" />
          <Text style={styles.backText}>Back to list</Text>
        </TouchableOpacity>

        {/* Admin Info */}
        {admin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin/Owner Information</Text>
            <InfoRow label="Full Name" value={admin.full_name} />
            <InfoRow label="Email" value={admin.email} />
            <InfoRow label="Phone" value={admin.phone} />
            <InfoRow label="Home Address" value={admin.home_address} />
            <InfoRow label="NIC Number" value={admin.nic_number} />
            <InfoRow
              label="Date of Birth"
              value={formatDate(admin.date_of_birth)}
            />
          </View>
        )}

        {/* KYC Documents */}
        {(admin?.profile_photo_url || admin?.nic_front || admin?.nic_back) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KYC Documents</Text>
            <View style={styles.imageGrid}>
              {admin.profile_photo_url && (
                <TouchableOpacity
                  style={styles.imageCard}
                  onPress={() =>
                    setSelectedImage({
                      src: admin.profile_photo_url,
                      alt: "Profile Photo",
                    })
                  }
                >
                  <Text style={styles.imageLabel}>Profile Photo</Text>
                  <Image
                    source={{ uri: admin.profile_photo_url }}
                    style={styles.docImage}
                  />
                </TouchableOpacity>
              )}
              {admin.nic_front && (
                <TouchableOpacity
                  style={styles.imageCard}
                  onPress={() =>
                    setSelectedImage({ src: admin.nic_front, alt: "NIC Front" })
                  }
                >
                  <Text style={styles.imageLabel}>NIC Front</Text>
                  <Image
                    source={{ uri: admin.nic_front }}
                    style={styles.docImage}
                  />
                </TouchableOpacity>
              )}
              {admin.nic_back && (
                <TouchableOpacity
                  style={styles.imageCard}
                  onPress={() =>
                    setSelectedImage({ src: admin.nic_back, alt: "NIC Back" })
                  }
                >
                  <Text style={styles.imageLabel}>NIC Back</Text>
                  <Image
                    source={{ uri: admin.nic_back }}
                    style={styles.docImage}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Restaurant Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant Information</Text>
          <InfoRow label="Name" value={rest.restaurant_name} />
          <InfoRow
            label="Business Reg. No."
            value={rest.business_registration_number}
          />
          <InfoRow label="Address" value={rest.address} />
          <InfoRow label="City" value={rest.city} />
          <InfoRow label="Postal Code" value={rest.postal_code} />
          <InfoRow label="Opening Time" value={rest.opening_time} />
          <InfoRow label="Closing Time" value={rest.close_time} />
        </View>

        {/* Location */}
        {rest.latitude && rest.longitude && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant Location</Text>
            <Text style={styles.locationText}>
              {rest.address || "N/A"}
              {rest.city ? `, ${rest.city}` : ""}
            </Text>
            <Text style={styles.coordText}>
              Coordinates: {Number(rest.latitude).toFixed(6)},{" "}
              {Number(rest.longitude).toFixed(6)}
            </Text>
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps?q=${rest.latitude},${rest.longitude}`,
                )
              }
            >
              <Ionicons name="map-outline" size={16} color="#4F46E5" />
              <Text style={styles.mapBtnText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Restaurant Images */}
        {(rest.logo_url || rest.cover_image_url) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant Images</Text>
            <View style={styles.imageGrid}>
              {rest.logo_url && (
                <TouchableOpacity
                  style={styles.imageCard}
                  onPress={() =>
                    setSelectedImage({ src: rest.logo_url, alt: "Logo" })
                  }
                >
                  <Text style={styles.imageLabel}>Logo</Text>
                  <Image
                    source={{ uri: rest.logo_url }}
                    style={styles.docImage}
                  />
                </TouchableOpacity>
              )}
              {rest.cover_image_url && (
                <TouchableOpacity
                  style={styles.imageCard}
                  onPress={() =>
                    setSelectedImage({
                      src: rest.cover_image_url,
                      alt: "Cover Image",
                    })
                  }
                >
                  <Text style={styles.imageLabel}>Cover Image</Text>
                  <Image
                    source={{ uri: rest.cover_image_url }}
                    style={styles.docImage}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bank Account */}
        {bank && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bank Account Details</Text>
            <InfoRow label="Account Holder" value={bank.account_holder_name} />
            <InfoRow label="Bank Name" value={bank.bank_name} />
            <InfoRow label="Branch" value={bank.branch} />
            <InfoRow label="Account Number" value={bank.account_number} />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#059669" }]}
            onPress={handleApprove}
            disabled={approving}
          >
            <Text style={styles.actionBtnText}>
              {approving ? "Approving..." : "✓ Approve"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#DC2626" }]}
            onPress={() => setShowRejectModal(true)}
            disabled={rejecting}
          >
            <Text style={styles.actionBtnText}>
              {rejecting ? "Rejecting..." : "✗ Reject"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  /* ─── List View ─── */
  const renderList = () => (
    <ScrollView contentContainerStyle={styles.listScroll}>
      <Text style={styles.pageTitle}>Pending Restaurant Approvals</Text>
      <Text style={styles.listSubtitle}>Pending ({restaurants.length})</Text>

      {restaurants.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No pending restaurants</Text>
        </View>
      ) : (
        restaurants.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[
              styles.listCard,
              selectedRestaurant === r.id && styles.listCardSelected,
            ]}
            onPress={() => handleSelectRestaurant(r.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.listName}>{r.restaurant_name}</Text>
            <Text style={styles.listCity}>{r.city}</Text>
            <Text style={styles.listDate}>{formatDate(r.created_at)}</Text>
          </TouchableOpacity>
        ))
      )}
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
        title="Pending Restaurants"
        showBack
        onMenuPress={() => setDrawerOpen(true)}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Restaurant & Admin"
        items={ADMIN_DRAWER_ITEMS}
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
      ) : selectedRestaurant && details ? (
        renderDetails()
      ) : (
        renderList()
      )}

      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.imgModalOverlay}>
          <View style={styles.imgModalContent}>
            <View style={styles.imgModalHeader}>
              <Text style={styles.imgModalTitle}>{selectedImage?.alt}</Text>
              <TouchableOpacity onPress={() => setSelectedImage(null)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage.src }}
                style={styles.imgModalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Restaurant</Text>
            <Text style={styles.modalDesc}>
              Please provide a reason for rejection:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Reason for rejection..."
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
                  setRejectionReason("");
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
                    opacity: rejecting || !rejectionReason.trim() ? 0.5 : 1,
                  },
                ]}
                onPress={handleReject}
                disabled={rejecting || !rejectionReason.trim()}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {rejecting ? "Rejecting..." : "Reject"}
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

  /* List */
  listScroll: { padding: 16 },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  listSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  listCardSelected: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  listName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  listCity: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  listDate: { fontSize: 10, color: "#D1D5DB", marginTop: 4 },

  /* Detail */
  detailScroll: { padding: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backText: {
    fontSize: 13,
    color: "#4F46E5",
    marginLeft: 6,
    fontWeight: "600",
  },

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

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
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

  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageCard: { width: "48%" },
  imageLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
    textAlign: "center",
  },
  docImage: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  locationText: { fontSize: 12, color: "#374151", marginBottom: 4 },
  coordText: { fontSize: 10, color: "#9CA3AF", marginBottom: 10 },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  mapBtnText: { fontSize: 12, fontWeight: "600", color: "#4F46E5" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },

  /* Image Modal */
  imgModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  imgModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 400,
  },
  imgModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  imgModalTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  imgModalImage: { width: "100%", height: 300, borderRadius: 8 },

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

export default PendingRestaurantsScreen;
