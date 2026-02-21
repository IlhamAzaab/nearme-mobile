import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import FreeMapView from "./FreeMapView";

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
      
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }, 500);
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

  // Prepare markers
  const markers = [
    {
      id: 'driver',
      coordinate: {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      },
      type: 'driver',
      emoji: '🚗',
      title: 'Your Location',
    },
  ];

  if (targetLocation) {
    markers.push({
      id: 'target',
      coordinate: {
        latitude: targetLocation.latitude,
        longitude: targetLocation.longitude,
      },
      type: mode === 'pickup' ? 'restaurant' : 'customer',
      emoji: mode === 'pickup' ? '🏪' : '📍',
      title: targetName,
    });
  }

  // Prepare polylines
  const polylines = routeCoordinates.length > 1 ? [{
    id: 'route',
    coordinates: routeCoordinates,
    strokeColor: mode === 'pickup' ? '#EF4444' : '#10B981',
    strokeWidth: 4,
  }] : [];

  return (
    <View style={styles.container}>
      <FreeMapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        markers={markers}
        polylines={polylines}
      />

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

