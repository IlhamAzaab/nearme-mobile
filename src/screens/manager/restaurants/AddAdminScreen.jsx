import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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

const AddAdminScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Email is required.");
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/add-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Error", data?.message || "Failed to create admin");
      } else {
        Alert.alert(
          "Success",
          `Admin created successfully. A temporary password has been sent to ${email}.`,
          [
            {
              text: "OK",
              onPress: () => {
                setEmail("");
              },
            },
          ],
        );
      }
    } catch (err) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Add Admin"
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@restaurant.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.submitText}>
                {loading ? "Creating..." : "Create Admin"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 4 },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

export default AddAdminScreen;
