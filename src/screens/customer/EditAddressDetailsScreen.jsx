import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";

function hasValidCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export default function EditAddressDetailsScreen({ navigation }) {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCustomerProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setAddress("");
        setCity("");
        setLatitude(null);
        setLongitude(null);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/cart/customer-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const customer = data?.customer || {};

      setAddress(String(customer?.address || "").trim());
      setCity(String(customer?.city || "").trim());

      const lat = Number(customer?.latitude);
      const lng = Number(customer?.longitude);
      if (hasValidCoordinates(lat, lng)) {
        setLatitude(lat);
        setLongitude(lng);
      } else {
        setLatitude(null);
        setLongitude(null);
      }
    } catch (error) {
      console.error("Failed to fetch customer profile:", error);
      setAddress("");
      setCity("");
      setLatitude(null);
      setLongitude(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCustomerProfile();
    }, [fetchCustomerProfile]),
  );

  const handleSave = useCallback(async () => {
    const nextAddress = String(address || "").trim();
    const nextCity = String(city || "").trim();

    if (!nextAddress) {
      Alert.alert("Address required", "Please enter your address.");
      return;
    }

    if (!nextCity) {
      Alert.alert("City required", "Please enter your city.");
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert("Session expired", "Please login again.");
        return;
      }

      const body = {
        address: nextAddress,
        city: nextCity,
        latitude: hasValidCoordinates(latitude, longitude)
          ? Number(latitude)
          : null,
        longitude: hasValidCoordinates(latitude, longitude)
          ? Number(longitude)
          : null,
      };

      const res = await fetch(`${API_BASE_URL}/customer/address`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update address details");
      }

      Alert.alert("Saved", "Address details updated successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Update failed", error?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [address, city, latitude, longitude, navigation]);

  const pinStatus = hasValidCoordinates(latitude, longitude)
    ? "Location pin is set"
    : "Not provided";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAF8" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>
        <Text style={styles.headerTitle}>Address Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#06C168" />
                <Text style={styles.loadingText}>
                  Loading customer details...
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter address"
                  multiline
                  style={[
                    styles.input,
                    { height: 92, textAlignVertical: "top" },
                  ]}
                />

                <Text style={styles.label}>City</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="Enter city"
                  style={styles.input}
                />

                <View style={styles.pinRow}>
                  <View>
                    <Text style={styles.pinTitle}>Delivery Location</Text>
                    <Text style={styles.pinSub}>{pinStatus}</Text>
                  </View>
                  <Pressable
                    onPress={() => navigation.navigate("AddressPicker")}
                    style={styles.pinBtn}
                  >
                    <Text style={styles.pinBtnText}>
                      {hasValidCoordinates(latitude, longitude)
                        ? "Change Pin"
                        : "Set Pin"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving || loading}
            style={[styles.saveBtn, (saving || loading) && { opacity: 0.7 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Address</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAF8" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 36 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    color: "#6B7280",
    fontWeight: "500",
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  pinRow: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pinTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  pinSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },
  pinBtn: {
    backgroundColor: "#E6F9EE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pinBtnText: {
    color: "#06C168",
    fontSize: 12,
    fontWeight: "700",
  },
  saveBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
