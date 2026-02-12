/**
 * FreeMapView Component
 * 
 * Reusable map component with FREE OpenStreetMap/Carto tiles
 * No Google Maps API key required!
 */

import React, { forwardRef } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { UrlTile, Marker, Polyline } from "react-native-maps";

// Carto Voyager tiles - FREE and production ready
const CARTO_TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

/**
 * FreeMapView - MapView with free OpenStreetMap tiles
 * 
 * @param {object} props - All MapView props plus children
 * @param {object} initialRegion - Initial map region
 * @param {object} region - Controlled map region
 * @param {boolean} scrollEnabled - Allow map scrolling
 * @param {boolean} zoomEnabled - Allow map zooming
 * @param {function} onPress - Map press handler
 * @param {React.ReactNode} children - Child components (Markers, Polylines, etc.)
 */
const FreeMapView = forwardRef(({
  initialRegion,
  region,
  style,
  children,
  scrollEnabled = true,
  zoomEnabled = true,
  rotateEnabled = false,
  pitchEnabled = false,
  showsUserLocation = false,
  showsMyLocationButton = false,
  showsCompass = false,
  onPress,
  onPanDrag,
  onRegionChange,
  onRegionChangeComplete,
  ...props
}, ref) => {
  const defaultRegion = {
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <MapView
      ref={ref}
      style={[styles.map, style]}
      mapType="none"
      initialRegion={initialRegion || defaultRegion}
      region={region}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      rotateEnabled={rotateEnabled}
      pitchEnabled={pitchEnabled}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsMyLocationButton}
      showsCompass={showsCompass}
      onPress={onPress}
      onPanDrag={onPanDrag}
      onRegionChange={onRegionChange}
      onRegionChangeComplete={onRegionChangeComplete}
      {...props}
    >
      {/* 🆓 FREE Carto Tiles - No API key required */}
      <UrlTile
        urlTemplate={CARTO_TILE_URL}
        maximumZ={19}
        flipY={false}
        tileSize={256}
        zIndex={-1}
      />
      {children}
    </MapView>
  );
});

FreeMapView.displayName = "FreeMapView";

// ============================================================================
// MARKER COMPONENTS
// ============================================================================

export const DriverMarker = ({ coordinate, title = "Driver" }) => (
  <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} title={title}>
    <View style={markerStyles.container}>
      <View style={[markerStyles.pin, markerStyles.driverPin]}>
        <View style={markerStyles.emoji}>🚗</View>
      </View>
    </View>
  </Marker>
);

export const RestaurantMarker = ({ coordinate, title = "Restaurant", label }) => (
  <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} title={title}>
    <View style={markerStyles.container}>
      <View style={[markerStyles.pin, markerStyles.restaurantPin]}>
        {label ? (
          <View style={markerStyles.labelText}>{label}</View>
        ) : (
          <View style={markerStyles.emoji}>🏪</View>
        )}
      </View>
      <View style={markerStyles.shadow} />
    </View>
  </Marker>
);

export const CustomerMarker = ({ coordinate, title = "Customer", label }) => (
  <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} title={title}>
    <View style={markerStyles.container}>
      <View style={[markerStyles.pin, markerStyles.customerPin]}>
        {label ? (
          <View style={markerStyles.labelText}>{label}</View>
        ) : (
          <View style={markerStyles.emoji}>📍</View>
        )}
      </View>
      <View style={markerStyles.shadow} />
    </View>
  </Marker>
);

export const DeliveryLocationMarker = ({ coordinate }) => (
  <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }}>
    <View style={markerStyles.deliveryContainer}>
      <View style={markerStyles.deliveryPin}>
        <View style={markerStyles.deliveryPinInner} />
      </View>
      <View style={markerStyles.deliveryShadow} />
    </View>
  </Marker>
);

// ============================================================================
// ROUTE POLYLINE
// ============================================================================

export const RoutePolyline = ({ 
  coordinates, 
  mode = "default",
  strokeColor,
  strokeWidth = 4,
  lineDashPattern,
}) => {
  if (!coordinates || coordinates.length < 2) return null;

  const colors = {
    pickup: "#EF4444",
    delivery: "#10B981",
    default: "#3B82F6",
    purple: "#8B5CF6",
  };

  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={strokeColor || colors[mode] || colors.default}
      strokeWidth={strokeWidth}
      lineDashPattern={lineDashPattern}
    />
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

const markerStyles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  driverPin: {
    backgroundColor: "#10B981",
  },
  restaurantPin: {
    backgroundColor: "#EF4444",
  },
  customerPin: {
    backgroundColor: "#3B82F6",
  },
  emoji: {
    fontSize: 20,
  },
  labelText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  shadow: {
    width: 20,
    height: 8,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 10,
    marginTop: -2,
  },
  
  // Delivery location marker (teardrop)
  deliveryContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  deliveryPin: {
    width: 30,
    height: 40,
    backgroundColor: "#10B981",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 15,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  deliveryPinInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    transform: [{ rotate: "-45deg" }],
  },
  deliveryShadow: {
    width: 14,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 7,
    marginTop: -3,
  },
});

export default FreeMapView;
