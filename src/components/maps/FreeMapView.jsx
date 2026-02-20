/**
 * FreeMapView Component
 * 
 * 100% FREE - NO Google Maps SDK required!
 * Uses WebView + Leaflet + OpenStreetMap tiles
 * 
 * - OpenStreetMap tiles (FREE)
 * - OSRM routing (FREE)
 * - No API keys needed
 */

import React, { forwardRef, useRef, useEffect, useState, useImperativeHandle } from "react";
import { View, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { WebView } from "react-native-webview";

// Leaflet HTML template - loads OpenStreetMap tiles
const createLeafletHTML = () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-control-attribution { display: none !important; }
    
    .marker-container { 
      display: flex; 
      align-items: center; 
      justify-content: center; 
    }
    
    .marker-pin {
      width: 44px; 
      height: 44px; 
      border-radius: 22px;
      display: flex; 
      align-items: center; 
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-size: 20px;
    }
    
    .driver-pin { background: #10B981; }
    .restaurant-pin { background: #EF4444; }
    .customer-pin { background: #3B82F6; }
    .pickup-pin { background: #F59E0B; }
    .delivery-pin { background: #10B981; }
    .default-pin { background: #6B7280; }
    
    .user-location {
      width: 16px; 
      height: 16px; 
      background: #3B82F6;
      border-radius: 50%; 
      border: 3px solid white;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map = null;
    let markers = {};
    let polylines = {};
    let userMarker = null;
    let isMapReady = false;

    // Initialize map
    function initMap(lat, lng, zoom) {
      try {
        if (map) { 
          map.remove(); 
          map = null;
        }
        
        map = L.map('map', { 
          zoomControl: false, 
          attributionControl: false 
        }).setView([lat, lng], zoom || 15);
        
        // OpenStreetMap tiles - 100% FREE
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
          maxZoom: 19,
          crossOrigin: true
        }).addTo(map);
        
        // Handle map click
        map.on('click', function(e) {
          sendMessage('press', { 
            coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } 
          });
        });
        
        // Handle region change
        map.on('moveend', function() {
          const c = map.getCenter();
          const b = map.getBounds();
          sendMessage('regionChange', {
            region: { 
              latitude: c.lat, 
              longitude: c.lng, 
              latitudeDelta: b.getNorth() - b.getSouth(), 
              longitudeDelta: b.getEast() - b.getWest() 
            }
          });
        });
        
        isMapReady = true;
        sendMessage('ready', {});
      } catch (error) {
        sendMessage('error', { message: error.message });
      }
    }

    // Send message to React Native
    function sendMessage(type, data) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      } catch (e) {
        console.log('Message send error:', e);
      }
    }

    // Add marker
    function addMarker(id, lat, lng, type, emoji, title) {
      if (!map || !isMapReady) return;
      
      removeMarker(id);
      
      const pinClass = type ? type + '-pin' : 'default-pin';
      const icon = L.divIcon({
        className: 'marker-container',
        html: '<div class="marker-pin ' + pinClass + '">' + (emoji || '📍') + '</div>',
        iconSize: [44, 44],
        iconAnchor: [22, 44]
      });
      
      markers[id] = L.marker([lat, lng], { icon }).addTo(map);
      if (title) {
        markers[id].bindPopup(title);
      }
    }

    // Update marker position
    function updateMarker(id, lat, lng) {
      if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
      }
    }

    // Remove marker
    function removeMarker(id) {
      if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    }

    // Clear all markers
    function clearMarkers() {
      Object.keys(markers).forEach(id => removeMarker(id));
    }

    // Add polyline (route)
    function addPolyline(id, coords, color, width) {
      if (!map || !isMapReady || !coords || coords.length < 2) return;
      
      removePolyline(id);
      
      const latlngs = coords.map(c => [c.latitude, c.longitude]);
      polylines[id] = L.polyline(latlngs, { 
        color: color || '#3B82F6', 
        weight: width || 4, 
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // Remove polyline
    function removePolyline(id) {
      if (polylines[id]) {
        map.removeLayer(polylines[id]);
        delete polylines[id];
      }
    }

    // Clear all polylines
    function clearPolylines() {
      Object.keys(polylines).forEach(id => removePolyline(id));
    }

    // Set map center
    function setCenter(lat, lng, zoom) {
      if (!map || !isMapReady) return;
      
      if (zoom !== undefined && zoom !== null) {
        map.setView([lat, lng], zoom);
      } else {
        map.panTo([lat, lng]);
      }
    }

    // Animate to region
    function animateToRegion(lat, lng, latDelta, lngDelta) {
      if (!map || !isMapReady) return;
      
      const zoom = Math.round(Math.log2(360 / (latDelta || 0.05)));
      map.flyTo([lat, lng], Math.min(zoom, 18), { duration: 0.5 });
    }

    // Fit bounds to coordinates
    function fitBounds(coords, padding) {
      if (!map || !isMapReady || !coords || coords.length === 0) return;
      
      const bounds = L.latLngBounds(coords.map(c => [c.latitude, c.longitude]));
      map.fitBounds(bounds, { 
        padding: [padding || 50, padding || 50],
        maxZoom: 16
      });
    }

    // Show user location marker
    function showUserLocation(lat, lng) {
      if (!map || !isMapReady) return;
      
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          className: 'marker-container',
          html: '<div class="user-location"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        userMarker = L.marker([lat, lng], { icon }).addTo(map);
      }
    }

    // Get current zoom level
    function getZoom() {
      return map ? map.getZoom() : 15;
    }
  </script>
</body>
</html>
`;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FreeMapView = forwardRef(({
  initialRegion,
  region,
  style,
  children,
  scrollEnabled = true,
  zoomEnabled = true,
  showsUserLocation = false,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  onMapReady,
  markers: markersProp = [],
  polylines: polylinesProp = [],
  userLocation,
  ...props
}, ref) => {
  const webViewRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const prevMarkersRef = useRef([]);
  const prevPolylinesRef = useRef([]);

  // Default region (Sri Lanka)
  const defaultRegion = {
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const currentRegion = region || initialRegion || defaultRegion;

  // Calculate zoom from delta
  const getZoomFromDelta = (delta) => {
    const zoom = Math.round(Math.log2(360 / (delta || 0.05)));
    return Math.min(Math.max(zoom, 1), 18);
  };

  // Inject JavaScript into WebView
  const injectJS = (js) => {
    if (webViewRef.current && isReady) {
      webViewRef.current.injectJavaScript(`${js}; true;`);
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    animateToRegion: (newRegion, duration) => {
      injectJS(`animateToRegion(${newRegion.latitude}, ${newRegion.longitude}, ${newRegion.latitudeDelta}, ${newRegion.longitudeDelta})`);
    },
    fitToCoordinates: (coordinates, options) => {
      if (coordinates?.length > 0) {
        const padding = options?.edgePadding?.top || 50;
        injectJS(`fitBounds(${JSON.stringify(coordinates)}, ${padding})`);
      }
    },
    setCamera: (camera) => {
      const lat = camera.center?.latitude || currentRegion.latitude;
      const lng = camera.center?.longitude || currentRegion.longitude;
      const zoom = camera.zoom || 15;
      injectJS(`setCenter(${lat}, ${lng}, ${zoom})`);
    },
    getCamera: () => ({
      center: { latitude: currentRegion.latitude, longitude: currentRegion.longitude },
      zoom: getZoomFromDelta(currentRegion.latitudeDelta),
    }),
    animateCamera: (camera, options) => {
      const lat = camera.center?.latitude || currentRegion.latitude;
      const lng = camera.center?.longitude || currentRegion.longitude;
      const zoom = camera.zoom || 15;
      injectJS(`setCenter(${lat}, ${lng}, ${zoom})`);
    },
  }));

  // Initialize map when WebView loads
  const handleLoad = () => {
    setTimeout(() => {
      if (webViewRef.current) {
        const zoom = getZoomFromDelta(currentRegion.latitudeDelta);
        webViewRef.current.injectJavaScript(`
          initMap(${currentRegion.latitude}, ${currentRegion.longitude}, ${zoom});
          true;
        `);
      }
    }, 100);
  };

  // Handle messages from WebView
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'ready':
          setIsReady(true);
          setIsLoading(false);
          onMapReady?.();
          break;
        case 'press':
          onPress?.({ nativeEvent: { coordinate: data.coordinate } });
          break;
        case 'regionChange':
          onRegionChange?.(data.region);
          onRegionChangeComplete?.(data.region);
          break;
        case 'error':
          console.warn('Map error:', data.message);
          break;
      }
    } catch (e) {
      console.log('Map message parse error:', e);
    }
  };

  // Update markers when props change
  useEffect(() => {
    if (!isReady) return;

    // Clear old markers and add new ones
    injectJS('clearMarkers()');
    
    markersProp.forEach((marker) => {
      if (marker.coordinate) {
        const { latitude, longitude } = marker.coordinate;
        const type = marker.type || 'default';
        const emoji = marker.emoji || '📍';
        const title = marker.title || '';
        injectJS(`addMarker('${marker.id}', ${latitude}, ${longitude}, '${type}', '${emoji}', '${title}')`);
      }
    });

    prevMarkersRef.current = markersProp;
  }, [isReady, JSON.stringify(markersProp)]);

  // Update polylines when props change
  useEffect(() => {
    if (!isReady) return;

    // Clear old polylines and add new ones
    injectJS('clearPolylines()');
    
    polylinesProp.forEach((polyline, index) => {
      if (polyline.coordinates?.length > 1) {
        const id = polyline.id || `polyline_${index}`;
        const color = polyline.strokeColor || '#3B82F6';
        const width = polyline.strokeWidth || 4;
        injectJS(`addPolyline('${id}', ${JSON.stringify(polyline.coordinates)}, '${color}', ${width})`);
      }
    });

    prevPolylinesRef.current = polylinesProp;
  }, [isReady, JSON.stringify(polylinesProp)]);

  // Update user location
  useEffect(() => {
    if (!isReady || !showsUserLocation || !userLocation) return;
    
    injectJS(`showUserLocation(${userLocation.latitude}, ${userLocation.longitude})`);
  }, [isReady, showsUserLocation, userLocation?.latitude, userLocation?.longitude]);

  // Update region when prop changes
  useEffect(() => {
    if (!isReady || !region) return;
    
    injectJS(`animateToRegion(${region.latitude}, ${region.longitude}, ${region.latitudeDelta}, ${region.longitudeDelta})`);
  }, [isReady, region?.latitude, region?.longitude]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: createLeafletHTML() }}
        style={styles.webview}
        onLoad={handleLoad}
        onMessage={handleMessage}
        scrollEnabled={scrollEnabled}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        originWhitelist={['*']}
        cacheEnabled={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
      />
      
      {isLoading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      )}
    </View>
  );
});

FreeMapView.displayName = "FreeMapView";

// ============================================================================
// MARKER COMPONENTS (for compatibility - render nothing, use markers prop)
// ============================================================================

export const DriverMarker = ({ coordinate, title }) => null;
DriverMarker.displayName = 'DriverMarker';

export const RestaurantMarker = ({ coordinate, title, label }) => null;
RestaurantMarker.displayName = 'RestaurantMarker';

export const CustomerMarker = ({ coordinate, title, label }) => null;
CustomerMarker.displayName = 'CustomerMarker';

export const DeliveryLocationMarker = ({ coordinate, title }) => null;
DeliveryLocationMarker.displayName = 'DeliveryLocationMarker';

export const PickupMarker = ({ coordinate, title }) => null;
PickupMarker.displayName = 'PickupMarker';

export const RoutePolyline = ({ coordinates, strokeColor, strokeWidth }) => null;
RoutePolyline.displayName = 'RoutePolyline';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#E8E8E8',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
});

export default FreeMapView;
