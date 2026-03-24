import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OSMMapView from "../../components/maps/OSMMapView";

const DEFAULT_REGION = {
  latitude: 7.8731,
  longitude: 80.7718,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function AddressPickerScreen({ navigation }) {
  const mapRef = useRef(null);
  const [pin, setPin] = useState(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [region, setRegion] = useState(DEFAULT_REGION);

  // Try to get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const userRegion = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(userRegion);
        }
      } catch (e) {
        console.log("Location error:", e);
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  // Reverse geocode the pin to get a readable label
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
      if (results?.[0]) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
        return parts.join(", ");
      }
    } catch {}
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }, []);

  const handleMapPress = useCallback(
    async (e) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPin({ latitude, longitude });
      const label = await reverseGeocode(latitude, longitude);
      setAddressLabel(label);
    },
    [reverseGeocode],
  );

  const handleSave = useCallback(async () => {
    if (!pin) {
      Alert.alert("Select a location", "Tap on the map to pin your address.");
      return;
    }
    setSaving(true);
    try {
      const data = {
        latitude: pin.latitude,
        longitude: pin.longitude,
        label: addressLabel || "Saved address",
      };
      await AsyncStorage.setItem("@saved_address", JSON.stringify(data));
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Failed to save address.");
    } finally {
      setSaving(false);
    }
  }, [pin, addressLabel, navigation]);

  return (
    <SafeAreaView style={st.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDFBF2" />

      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>
        <Text style={st.headerTitle}>Pick Address</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Map ── */}
      <View style={st.mapContainer}>
        {loadingLocation ? (
          <View style={st.loadingWrap}>
            <ActivityIndicator size="large" color="#06C168" />
            <Text style={st.loadingTxt}>Getting your location...</Text>
          </View>
        ) : (
          <OSMMapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={region}
            onPress={handleMapPress}
            scrollEnabled
            zoomEnabled
            markers={
              pin
                ? [
                    {
                      id: "pin",
                      coordinate: pin,
                      type: "customer",
                      title: "Selected Location",
                      emoji: "📍",
                    },
                  ]
                : []
            }
          />
        )}

        {/* Instruction overlay */}
        {!pin && !loadingLocation && (
          <View style={st.instructionBubble}>
            <Ionicons name="finger-print-outline" size={16} color="#06C168" />
            <Text style={st.instructionTxt}>Tap to pin your delivery address</Text>
          </View>
        )}
      </View>

      {/* ── Bottom card ── */}
      <View style={st.bottomCard}>
        {pin ? (
          <>
            <View style={st.addressRow}>
              <View style={st.addressIconWrap}>
                <Ionicons name="location" size={18} color="#06C168" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.addressLabel}>Selected Address</Text>
                <Text style={st.addressText} numberOfLines={2}>
                  {addressLabel || "Loading..."}
                </Text>
              </View>
            </View>
            <Pressable
              style={[st.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={st.saveBtnTxt}>Save Address</Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <View style={st.emptyRow}>
            <Ionicons name="map-outline" size={22} color="#9CA3AF" />
            <Text style={st.emptyTxt}>Tap on the map to select your address</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════ STYLES ═══════════════════════ */

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EDFBF2" },

  /* header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#EDFBF2",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  /* map */
  mapContainer: {
    flex: 1,
    overflow: "hidden",
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingTxt: { fontSize: 13, color: "#6B7280", fontWeight: "500" },

  instructionBubble: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  instructionTxt: { fontSize: 13, fontWeight: "600", color: "#374151" },

  /* bottom card */
  bottomCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  addressIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E6F9EE",
    justifyContent: "center",
    alignItems: "center",
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    lineHeight: 20,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#06C168",
    borderRadius: 14,
    paddingVertical: 15,
  },
  saveBtnTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  emptyTxt: { fontSize: 14, color: "#9CA3AF", fontWeight: "500" },
});
