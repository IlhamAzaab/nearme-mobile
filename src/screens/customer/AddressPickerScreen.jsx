import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import colors from "../../constants/colors";
import OSMMapView from "../../components/maps/OSMMapView";

const GEOCODE_DEBOUNCE_MS = 700;
const GEOCODE_TIMEOUT_MS = 6500;
const MIN_GEOCODE_DISTANCE_METERS = 20;

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AddressPickerScreen({ navigation }) {
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
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    addressLabelRef.current = addressLabel;
  }, [addressLabel]);

  const reverseGeocode = useCallback(async (latitude, longitude, options = {}) => {
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
      const moved = getDistanceMeters(lastPoint.latitude, lastPoint.longitude, latitude, longitude);
      if (moved < MIN_GEOCODE_DISTANCE_METERS) {
        return;
      }
    }

    const requestId = ++geocodeRequestIdRef.current;
    if (showLoading) {
      setAddressLabel("Loading address...");
    }

    try {
      const geocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("reverse_geocode_timeout")), GEOCODE_TIMEOUT_MS);
      });

      const geocode = await Promise.race([geocodePromise, timeoutPromise]);

      if (requestId !== geocodeRequestIdRef.current) {
        return;
      }

      if (Array.isArray(geocode) && geocode.length > 0) {
        const place = geocode[0];
        const formattedAddress = `${place.name ? `${place.name}, ` : ""}${place.street || ""}, ${place.city || ""}`;
        const label = formattedAddress.trim().replace(/^,|,$/g, "") || "Selected Location";
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
      const isTimeout = /timeout|TimeoutException|reverse_geocode_timeout/i.test(message);
      if (isTimeout) {
        console.warn("Reverse geocode timed out, keeping previous address");
      } else {
        console.error("Reverse Geocode error:", error);
      }
      if (!addressLabelRef.current || addressLabelRef.current === "Loading address...") {
        setAddressLabel("Could not get address details");
        setAddressCity("");
      }
    }
  }, []);

  const scheduleReverseGeocode = useCallback((latitude, longitude, options = {}) => {
    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
    }
    geocodeTimerRef.current = setTimeout(() => {
      reverseGeocode(latitude, longitude, options);
    }, GEOCODE_DEBOUNCE_MS);
  }, [reverseGeocode]);

  const getBestCurrentLocation = useCallback(async () => {
    try {
      const live = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      });
      if (live?.coords?.latitude && live?.coords?.longitude) {
        return {
          latitude: live.coords.latitude,
          longitude: live.coords.longitude,
        };
      }
    } catch (error) {
      console.log("High accuracy location failed:", error);
    }

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 15000,
      requiredAccuracy: 100,
    });
    if (lastKnown?.coords?.latitude && lastKnown?.coords?.longitude) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }

    throw new Error("Unable to detect current location");
  }, []);

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

        const savedAddressStr = await AsyncStorage.getItem("@saved_address");
        let startLocation;

        if (savedAddressStr) {
          const savedAddress = JSON.parse(savedAddressStr);
          startLocation = {
            latitude: savedAddress.latitude,
            longitude: savedAddress.longitude,
          };
          setAddressLabel(savedAddress.label || "Selected Location");
          setAddressCity(savedAddress.city || "");
        } else {
          startLocation = await getBestCurrentLocation();
          reverseGeocode(startLocation.latitude, startLocation.longitude, { force: true, showLoading: true });
        }

        const region = {
          latitude: startLocation.latitude,
          longitude: startLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };

        setInitialRegion(region);
        setCurrentCoordinate(startLocation);
        setUserLocation(startLocation);

      } catch (error) {
        console.error("Location error:", error);
        setAddressLabel("Could not fetch location");
      } finally {
        setLoading(false);
      }
    })();
  }, [getBestCurrentLocation, reverseGeocode]);

  useEffect(() => () => {
    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
    }
  }, []);

  const handleRegionChangeComplete = (region) => {
    if (!region) return;
    setCurrentCoordinate({ latitude: region.latitude, longitude: region.longitude });
    scheduleReverseGeocode(region.latitude, region.longitude);
  };

  const saveLocation = async () => {
    if (!currentCoordinate) return;
    setSaving(true);
    try {
      const addressData = {
        latitude: currentCoordinate.latitude,
        longitude: currentCoordinate.longitude,
        label: addressLabel,
        city: addressCity,
      };
      await AsyncStorage.setItem("@saved_address", JSON.stringify(addressData));
      navigation.goBack();
    } catch (error) {
      console.error("Error saving address:", error);
    } finally {
      setSaving(false);
    }
  };

  const centerOnUser = async () => {
    try {
      setFetchingLocation(true);
      const coords = await getBestCurrentLocation();
      setUserLocation(coords);
      setCurrentCoordinate(coords);

      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      } else if (mapRef.current?.panTo) {
        mapRef.current.panTo(coords.latitude, coords.longitude, 16);
      }
      scheduleReverseGeocode(coords.latitude, coords.longitude, { force: true, showLoading: true });
    } catch (error) {
      console.error("Error centering user:", error);
      setAddressLabel("Could not fetch current location");
    } finally {
      setFetchingLocation(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#06C168" />
        <Text style={styles.loadingText}>Fetching location...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
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
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={true}
            userLocation={userLocation}
          />
        )}
        
        {/* Fixed Center Pin */}
        <View style={styles.centerPinContainer} pointerEvents="none">
          <Ionicons name="location" size={48} color="#E11D48" style={styles.pinIcon} />
        </View>

        {/* Floating precise location button */}
        <TouchableOpacity style={styles.myLocationButton} onPress={centerOnUser} disabled={fetchingLocation}>
          {fetchingLocation ? (
            <ActivityIndicator size="small" color="#06C168" />
          ) : (
            <>
              <Ionicons name="locate" size={18} color="#06C168" />
              <Text style={styles.myLocationButtonText}>Find My Area</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.addressInfoContainer}>
          <Ionicons name="location-outline" size={24} color={colors.text} />
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressLabel}>Delivery Location</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {addressLabel}
            </Text>
          </View>
        </View>

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
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: colors.textDetails,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.white,
    zIndex: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // Add top padding for Android SafeAreaView issue
    paddingTop: Platform.OS === 'android' ? 40 : 15,
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
    height: "50%",
    minHeight: 260,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centerPinContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -24,
    marginTop: -48,
    justifyContent: "center",
    alignItems: "center",
  },
  pinIcon: {
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  myLocationButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 128,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  myLocationButtonText: {
    color: "#06C168",
    fontWeight: "700",
    fontSize: 13,
  },
  bottomPanel: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  addressInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  addressTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: colors.textDetails,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: "#06C168",
    paddingVertical: 15,
    borderRadius: 12,
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
