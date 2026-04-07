import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import OSMMapView from "../../components/maps/OSMMapView";

export default function AddressPickerScreen({ navigation }) {
  const mapRef = useRef(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [currentCoordinate, setCurrentCoordinate] = useState(null);
  const [addressLabel, setAddressLabel] = useState("Loading address...");
  const [addressCity, setAddressCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

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
          let location = await Location.getCurrentPositionAsync({});
          startLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          reverseGeocode(startLocation.latitude, startLocation.longitude);
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
  }, []);

  const reverseGeocode = async (latitude, longitude) => {
    try {
      setAddressLabel("Loading address...");
      let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const place = geocode[0];
        const formattedAddress = `${place.name ? place.name + ", " : ""}${place.street || ""}, ${place.city || ""}`;
        setAddressLabel(formattedAddress.trim().replace(/^,|,$/g, ""));
        setAddressCity(place.city || place.subregion || place.region || "");
      } else {
        setAddressLabel("Unknown location");
        setAddressCity("");
      }
    } catch (error) {
      console.error("Reverse Geocode error:", error);
      setAddressLabel("Could not get address details");
      setAddressCity("");
    }
  };

  const handleRegionChangeComplete = (region) => {
    if (!region) return;
    setCurrentCoordinate({ latitude: region.latitude, longitude: region.longitude });
    reverseGeocode(region.latitude, region.longitude);
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
      let location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(coords);

      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      } else if (mapRef.current?.panTo) {
        mapRef.current.panTo(coords.latitude, coords.longitude, 16);
      }
    } catch (error) {
      console.error("Error centering user:", error);
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
        <TouchableOpacity style={styles.myLocationButton} onPress={centerOnUser}>
          <Ionicons name="locate" size={24} color="#06C168" />
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
    padding: 12,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
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
