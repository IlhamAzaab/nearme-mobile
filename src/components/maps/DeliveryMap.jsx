import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

// Custom Marker Components
const DriverMarkerView = () => (
  <View style={styles.markerContainer}>
    <View style={[styles.markerPin, styles.driverPin]}>
      <Text style={styles.markerEmoji}>🚗</Text>
    </View>
    <View style={styles.markerShadow} />
  </View>
);

const RestaurantMarkerView = () => (
  <View style={styles.markerContainer}>
    <View style={[styles.markerPin, styles.restaurantPin]}>
      <Text style={styles.markerEmoji}>🏪</Text>
    </View>
    <View style={styles.markerShadow} />
  </View>
);

const CustomerMarkerView = () => (
  <View style={styles.markerContainer}>
    <View style={[styles.markerPin, styles.customerPin]}>
      <Text style={styles.markerEmoji}>📍</Text>
    </View>
    <View style={styles.markerShadow} />
  </View>
);

export default function DeliveryMap({
  driverLocation,
  targetLocation,
  mode = "pickup", // "pickup" or "delivery"
  routeCoordinates = [],
  isTracking = false,
  onRecenter,
  showRecenterButton = false,
  loading = false,
  targetName = "",
}) {
  const mapRef = useRef(null);

  // Fit map to show all markers
  useEffect(() => {
    if (mapRef.current && driverLocation && targetLocation) {
      const coordinates = [
        { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
        { latitude: targetLocation.latitude, longitude: targetLocation.longitude },
      ];
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  }, [driverLocation?.latitude, driverLocation?.longitude, targetLocation?.latitude, targetLocation?.longitude]);

  const handleRecenter = () => {
    if (mapRef.current && driverLocation && targetLocation) {
      const coordinates = [
        { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
        { latitude: targetLocation.latitude, longitude: targetLocation.longitude },
      ];
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
    onRecenter?.();
  };

  if (loading || !driverLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  const initialRegion = {
    latitude: driverLocation.latitude,
    longitude: driverLocation.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
      >
        {/* 🆓 FREE OpenStreetMap Tiles */}
        <UrlTile
          urlTemplate="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
          maximumZ={19}
          flipY={false}
          tileSize={256}
          zIndex={-1}
        />
        {/* Driver Marker */}
        <Marker
          coordinate={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          title="Your Location"
        >
          <DriverMarkerView />
        </Marker>

        {/* Target Marker (Restaurant or Customer) */}
        {targetLocation && (
          <Marker
            coordinate={{
              latitude: targetLocation.latitude,
              longitude: targetLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            title={targetName}
          >
            {mode === "pickup" ? <RestaurantMarkerView /> : <CustomerMarkerView />}
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={mode === "pickup" ? "#EF4444" : "#10B981"}
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}
      </MapView>

      {/* Mode Badge */}
      <View style={styles.modeBadge}>
        <Text style={styles.modeBadgeText}>
          {mode === "pickup" ? "🏪 PICKUP MODE" : "📦 DELIVERY MODE"}
        </Text>
      </View>

      {/* Tracking Status Badge */}
      <View style={styles.trackingBadge}>
        <View style={[styles.trackingDot, isTracking && styles.trackingDotActive]} />
        <Text style={styles.trackingText}>
          {isTracking ? "Live (3s)" : "Not Tracking"}
        </Text>
      </View>

      {/* Recenter Button */}
      {showRecenterButton && (
        <Pressable style={styles.recenterBtn} onPress={handleRecenter}>
          <Text style={styles.recenterIcon}>🎯</Text>
          <Text style={styles.recenterText}>Recenter</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  // Markers
  markerContainer: {
    alignItems: "center",
  },
  markerPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: 3,
    borderColor: "#fff",
  },
  driverPin: {
    backgroundColor: "#3B82F6",
  },
  restaurantPin: {
    backgroundColor: "#EF4444",
  },
  customerPin: {
    backgroundColor: "#10B981",
  },
  markerEmoji: {
    fontSize: 20,
  },
  markerShadow: {
    width: 20,
    height: 8,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 10,
    marginTop: -4,
  },

  // Mode Badge
  modeBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  modeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },

  // Tracking Badge
  trackingBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  trackingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#9CA3AF",
  },
  trackingDotActive: {
    backgroundColor: "#10B981",
  },
  trackingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },

  // Recenter Button
  recenterBtn: {
    position: "absolute",
    bottom: 20,
    right: 16,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  recenterIcon: {
    fontSize: 16,
  },
  recenterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3B82F6",
  },
});

