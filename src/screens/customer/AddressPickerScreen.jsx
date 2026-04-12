import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import colors from "../../constants/colors";
import OSMMapView from "../../components/maps/OSMMapView";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";

const GEOCODE_DEBOUNCE_MS = 700;
const GEOCODE_TIMEOUT_MS = 6500;
const MIN_GEOCODE_DISTANCE_METERS = 20;
const LOCATION_TIMEOUT_MS = 9000;

function buildPinMarkerHtml() {
  return (
    "<div style='display:flex;align-items:center;justify-content:center;width:52px;height:52px;'>" +
    "<svg width='52' height='52' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' aria-label='delivery pin'>" +
    "<path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#D90445'/>" +
    "<circle cx='12' cy='9' r='3' fill='#FFFFFF'/>" +
    "</svg>" +
    "</div>"
  );
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

function toCoordinates(locationPayload) {
  const latitude = Number(locationPayload?.coords?.latitude);
  const longitude = Number(locationPayload?.coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

export default function AddressPickerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const geocodeTimerRef = useRef(null);
  const lastGeocodePointRef = useRef(null);
  const geocodeRequestIdRef = useRef(0);
  const geocodeCacheRef = useRef(new Map());
  const addressLabelRef = useRef("Loading address...");
  const [initialRegion, setInitialRegion] = useState(null);
  const [currentCoordinate, setCurrentCoordinate] = useState(null);
  const [addressLabel, setAddressLabel] = useState("Loading address...");
  const [addressCity, setAddressCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [showUserLocationMarker, setShowUserLocationMarker] = useState(false);

  useEffect(() => {
    addressLabelRef.current = addressLabel;
  }, [addressLabel]);

  const reverseGeocode = useCallback(
    async (latitude, longitude, options = {}) => {
      const { force = false, showLoading = false } = options;
      const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

      const cached = geocodeCacheRef.current.get(cacheKey);
      if (cached) {
        setAddressLabel(cached.label);
        setAddressCity(cached.city);
        return;
      }

      const lastPoint = lastGeocodePointRef.current;
      if (!force && lastPoint) {
        const moved = getDistanceMeters(
          lastPoint.latitude,
          lastPoint.longitude,
          latitude,
          longitude,
        );
        if (moved < MIN_GEOCODE_DISTANCE_METERS) {
          return;
        }
      }

      const requestId = ++geocodeRequestIdRef.current;
      if (showLoading) {
        setAddressLabel("Loading address...");
      }

      try {
        const geocodePromise = Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("reverse_geocode_timeout")),
            GEOCODE_TIMEOUT_MS,
          );
        });

        const geocode = await Promise.race([geocodePromise, timeoutPromise]);

        if (requestId !== geocodeRequestIdRef.current) {
          return;
        }

        if (Array.isArray(geocode) && geocode.length > 0) {
          const place = geocode[0];
          const formattedAddress = `${place.name ? `${place.name}, ` : ""}${place.street || ""}, ${place.city || ""}`;
          const label =
            formattedAddress.trim().replace(/^,|,$/g, "") ||
            "Selected Location";
          const city = place.city || place.subregion || place.region || "";

          setAddressLabel(label);
          setAddressCity(city);
          lastGeocodePointRef.current = { latitude, longitude };

          geocodeCacheRef.current.set(cacheKey, { label, city });
          if (geocodeCacheRef.current.size > 50) {
            const firstKey = geocodeCacheRef.current.keys().next().value;
            geocodeCacheRef.current.delete(firstKey);
          }
        } else {
          setAddressLabel("Unknown location");
          setAddressCity("");
        }
      } catch (error) {
        if (requestId !== geocodeRequestIdRef.current) {
          return;
        }

        const message = String(error?.message || error || "");
        const isTimeout =
          /timeout|TimeoutException|reverse_geocode_timeout/i.test(message);
        if (isTimeout) {
          console.warn("Reverse geocode timed out, keeping previous address");
        } else {
          console.error("Reverse Geocode error:", error);
        }
        if (
          !addressLabelRef.current ||
          addressLabelRef.current === "Loading address..."
        ) {
          setAddressLabel("Could not get address details");
          setAddressCity("");
        }
      }
    },
    [],
  );

  const scheduleReverseGeocode = useCallback(
    (latitude, longitude, options = {}) => {
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
      geocodeTimerRef.current = setTimeout(() => {
        reverseGeocode(latitude, longitude, options);
      }, GEOCODE_DEBOUNCE_MS);
    },
    [reverseGeocode],
  );

  const getReliableCurrentLocation = useCallback(
    async ({ preferFresh = false } = {}) => {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== "granted") {
        throw new Error("location_permission_denied");
      }

      const attempts = [
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeout: LOCATION_TIMEOUT_MS,
        },
        { accuracy: Location.Accuracy.High, timeout: 7500 },
        { accuracy: Location.Accuracy.Balanced, timeout: 6000 },
      ];

      for (const attempt of attempts) {
        try {
          const live = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: attempt.accuracy,
              mayShowUserSettingsDialog: true,
            }),
            attempt.timeout,
            "location_timeout",
          );

          const parsed = toCoordinates(live);
          if (!parsed) continue;

          const reportedAccuracy = Number(live?.coords?.accuracy || 9999);
          if (preferFresh && reportedAccuracy > 180) {
            continue;
          }

          return parsed;
        } catch (error) {
          console.log(
            "Location attempt failed:",
            attempt.accuracy,
            error?.message || error,
          );
        }
      }

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: preferFresh ? 30000 : 120000,
        requiredAccuracy: 250,
      });
      const parsedLastKnown = toCoordinates(lastKnown);
      if (parsedLastKnown) return parsedLastKnown;

      throw new Error("Unable to detect current location");
    },
    [],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setAddressLabel("Permission to access location was denied");
          setLoading(false);
          return;
        }

        let startLocation;

        try {
          startLocation = await getReliableCurrentLocation({
            preferFresh: true,
          });
        } catch (liveError) {
          console.warn(
            "Live location on entry failed, trying saved pin:",
            liveError,
          );
          const savedAddressStr = await AsyncStorage.getItem("@saved_address");
          if (savedAddressStr) {
            const savedAddress = JSON.parse(savedAddressStr);
            if (savedAddress?.latitude && savedAddress?.longitude) {
              startLocation = {
                latitude: savedAddress.latitude,
                longitude: savedAddress.longitude,
              };
              if (savedAddress.label) setAddressLabel(savedAddress.label);
              if (savedAddress.city) setAddressCity(savedAddress.city);
            }
          }

          if (!startLocation) {
            throw liveError;
          }
        }

        reverseGeocode(startLocation.latitude, startLocation.longitude, {
          force: true,
          showLoading: true,
        });

        const region = {
          latitude: startLocation.latitude,
          longitude: startLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };

        setInitialRegion(region);
        setCurrentCoordinate(startLocation);
        setUserLocation(startLocation);
        setShowUserLocationMarker(true);
      } catch (error) {
        console.error("Location error:", error);
        if (
          String(error?.message || "").includes("location_permission_denied")
        ) {
          setAddressLabel("Location permission denied");
        } else {
          setAddressLabel("Could not fetch location");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [getReliableCurrentLocation, reverseGeocode]);

  useEffect(
    () => () => {
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
    },
    [],
  );

  const handleRegionChangeComplete = (region) => {
    if (!region) return;
    // Intentionally do not update selected pin by map center.
    // Pin selection is based on explicit user tap for accuracy.
  };

  const handleMapPress = (event) => {
    const latitude = Number(event?.nativeEvent?.coordinate?.latitude);
    const longitude = Number(event?.nativeEvent?.coordinate?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    setCurrentCoordinate({ latitude, longitude });
    scheduleReverseGeocode(latitude, longitude, {
      force: true,
      showLoading: true,
    });
  };

  const saveLocation = async () => {
    if (!currentCoordinate) return;
    setSaving(true);
    try {
      const token = await getAccessToken();

      const addressData = {
        latitude: currentCoordinate.latitude,
        longitude: currentCoordinate.longitude,
        label: addressLabel,
        city: addressCity,
      };
      await AsyncStorage.setItem("@saved_address", JSON.stringify(addressData));

      // Persist only coordinates with existing profile address (not reverse-geocoded map address).
      if (token) {
        try {
          const profileRes = await fetch(
            `${API_BASE_URL}/cart/customer-profile`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const profileJson = await profileRes.json().catch(() => ({}));
          const existingAddress = String(
            profileJson?.customer?.address || "",
          ).trim();
          const existingCity = String(profileJson?.customer?.city || "").trim();

          if (existingAddress) {
            await fetch(`${API_BASE_URL}/customer/address`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                address: existingAddress,
                city: existingCity,
                latitude: currentCoordinate.latitude,
                longitude: currentCoordinate.longitude,
              }),
            });
          }
        } catch (persistError) {
          console.warn("Coordinate sync failed:", persistError);
        }
      }

      navigation.goBack();
    } catch (error) {
      console.error("Error saving address:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#06C168" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Delivery Address</Text>
        </View>

        <View style={styles.loadingContainer}>
          <SkeletonBlock width="92%" height="64%" borderRadius={24} />
          <View style={styles.loadingBottomSheet}>
            <SkeletonBlock
              width="44%"
              height={14}
              style={{ marginBottom: 10 }}
            />
            <SkeletonBlock
              width="86%"
              height={18}
              style={{ marginBottom: 10 }}
            />
            <SkeletonBlock width="100%" height={50} borderRadius={12} />
          </View>
          <Text style={styles.loadingText}>Fetching location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#06C168" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Delivery Address</Text>
      </View>

      <View style={styles.mapContainer}>
        {initialRegion && (
          <OSMMapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            onPress={handleMapPress}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={showUserLocationMarker}
            userLocation={userLocation}
            markers={
              currentCoordinate
                ? [
                    {
                      id: "delivery-pin",
                      coordinate: currentCoordinate,
                      type: "customer",
                      title: "Pinned delivery location",
                      emoji: "",
                      customHtml: buildPinMarkerHtml(),
                      iconOnly: true,
                      iconSize: [52, 52],
                      iconAnchor: [26, 52],
                    },
                  ]
                : []
            }
          />
        )}
      </View>

      {/* Bottom Panel */}
      <View
        style={[
          styles.bottomPanel,
          {
            paddingBottom: 12 + Math.max(0, insets.bottom),
          },
        ]}
      >
        <Text style={styles.pinInstructionText}>
          Pin your delivery location on the map, then confirm.
        </Text>

        <TouchableOpacity
          style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
          onPress={saveLocation}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingBottomSheet: {
    width: "92%",
    backgroundColor: "#FFFFFF",
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textDetails,
    fontSize: 15,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    zIndex: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
  mapContainer: {
    flex: 3.1,
    minHeight: 260,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomPanel: {
    flex: 1.1,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    justifyContent: "flex-end",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  pinInstructionText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: "600",
  },
  confirmButton: {
    backgroundColor: "#06C168",
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
});
