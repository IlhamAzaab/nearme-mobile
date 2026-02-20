/**
 * OSMMapView - Pure OpenStreetMap using WebView + Leaflet
 * NO Google Maps API key required!
 */

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

const LEAFLET_HTML = `
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
    .custom-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .driver-marker { background: #3B82F6; border-radius: 50%; padding: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .restaurant-marker { background: #10B981; border-radius: 50%; padding: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .customer-marker { background: #EF4444; border-radius: 50%; padding: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .pickup-marker { background: #F59E0B; border-radius: 50%; padding: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map;
    let markers = {};
    let polylines = {};
    let userLocationMarker = null;

    function initMap(lat, lng, zoom) {
      map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([lat, lng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      map.on('click', function(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapPress',
          coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
        }));
      });

      map.on('moveend', function() {
        const center = map.getCenter();
        const bounds = map.getBounds();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'regionChange',
          region: {
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: bounds.getNorth() - bounds.getSouth(),
            longitudeDelta: bounds.getEast() - bounds.getWest()
          }
        }));
      });
    }

    function createIcon(type, emoji) {
      return L.divIcon({
        className: 'custom-marker',
        html: '<div class="' + type + '-marker">' + emoji + '</div>',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
    }

    function addMarker(id, lat, lng, type, title, emoji) {
      if (markers[id]) {
        map.removeLayer(markers[id]);
      }
      const icon = createIcon(type, emoji || getDefaultEmoji(type));
      markers[id] = L.marker([lat, lng], { icon: icon })
        .addTo(map);
      if (title) {
        markers[id].bindPopup(title);
      }
    }

    function getDefaultEmoji(type) {
      switch(type) {
        case 'driver': return '🚗';
        case 'restaurant': return '🍽️';
        case 'customer': return '📍';
        case 'pickup': return '📦';
        default: return '📍';
      }
    }

    function updateMarker(id, lat, lng) {
      if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
      }
    }

    function removeMarker(id) {
      if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    }

    function addPolyline(id, coordinates, color, width) {
      if (polylines[id]) {
        map.removeLayer(polylines[id]);
      }
      const latlngs = coordinates.map(c => [c.latitude, c.longitude]);
      polylines[id] = L.polyline(latlngs, {
        color: color || '#3B82F6',
        weight: width || 4,
        opacity: 0.8
      }).addTo(map);
    }

    function removePolyline(id) {
      if (polylines[id]) {
        map.removeLayer(polylines[id]);
        delete polylines[id];
      }
    }

    function fitBounds(coordinates, padding) {
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates.map(c => [c.latitude, c.longitude]));
        map.fitBounds(bounds, { padding: [padding || 50, padding || 50] });
      }
    }

    function setCenter(lat, lng, zoom) {
      if (zoom) {
        map.setView([lat, lng], zoom);
      } else {
        map.setView([lat, lng]);
      }
    }

    function showUserLocation(lat, lng) {
      if (userLocationMarker) {
        userLocationMarker.setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: '<div style="background:#3B82F6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.3);"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        userLocationMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
      }
    }
  </script>
</body>
</html>
`;

const OSMMapView = forwardRef(({
  initialRegion,
  region,
  style,
  markers: markersProp = [],
  polylines: polylinesProp = [],
  showsUserLocation = false,
  userLocation,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  scrollEnabled = true,
  zoomEnabled = true,
  children,
}, ref) => {
  const webViewRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const defaultRegion = {
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const currentRegion = region || initialRegion || defaultRegion;

  useImperativeHandle(ref, () => ({
    animateToRegion: (newRegion, duration) => {
      if (webViewRef.current && isReady) {
        webViewRef.current.injectJavaScript(`
          setCenter(${newRegion.latitude}, ${newRegion.longitude}, ${getZoomFromDelta(newRegion.latitudeDelta)});
          true;
        `);
      }
    },
    fitToCoordinates: (coordinates, options) => {
      if (webViewRef.current && isReady && coordinates.length > 0) {
        const padding = options?.edgePadding?.top || 50;
        webViewRef.current.injectJavaScript(`
          fitBounds(${JSON.stringify(coordinates)}, ${padding});
          true;
        `);
      }
    },
    setCamera: (camera) => {
      if (webViewRef.current && isReady) {
        webViewRef.current.injectJavaScript(`
          setCenter(${camera.center.latitude}, ${camera.center.longitude}, ${camera.zoom || 15});
          true;
        `);
      }
    },
  }));

  const getZoomFromDelta = (delta) => {
    return Math.round(Math.log2(360 / delta));
  };

  useEffect(() => {
    if (webViewRef.current && isReady) {
      webViewRef.current.injectJavaScript(`
        initMap(${currentRegion.latitude}, ${currentRegion.longitude}, ${getZoomFromDelta(currentRegion.latitudeDelta)});
        true;
      `);
    }
  }, [isReady]);

  // Update markers
  useEffect(() => {
    if (webViewRef.current && isReady && markersProp.length > 0) {
      markersProp.forEach((marker, index) => {
        webViewRef.current.injectJavaScript(`
          addMarker('${marker.id || index}', ${marker.coordinate.latitude}, ${marker.coordinate.longitude}, '${marker.type || 'customer'}', '${marker.title || ''}', '${marker.emoji || ''}');
          true;
        `);
      });
    }
  }, [isReady, markersProp]);

  // Update polylines
  useEffect(() => {
    if (webViewRef.current && isReady && polylinesProp.length > 0) {
      polylinesProp.forEach((polyline, index) => {
        webViewRef.current.injectJavaScript(`
          addPolyline('${polyline.id || index}', ${JSON.stringify(polyline.coordinates)}, '${polyline.strokeColor || '#3B82F6'}', ${polyline.strokeWidth || 4});
          true;
        `);
      });
    }
  }, [isReady, polylinesProp]);

  // Show user location
  useEffect(() => {
    if (webViewRef.current && isReady && showsUserLocation && userLocation) {
      webViewRef.current.injectJavaScript(`
        showUserLocation(${userLocation.latitude}, ${userLocation.longitude});
        true;
      `);
    }
  }, [isReady, showsUserLocation, userLocation]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapPress' && onPress) {
        onPress({ nativeEvent: { coordinate: data.coordinate } });
      } else if (data.type === 'regionChange') {
        onRegionChange?.(data.region);
        onRegionChangeComplete?.(data.region);
      }
    } catch (e) {
      console.log('Map message error:', e);
    }
  };

  const handleLoad = () => {
    setIsReady(true);
    setTimeout(() => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          initMap(${currentRegion.latitude}, ${currentRegion.longitude}, ${getZoomFromDelta(currentRegion.latitudeDelta)});
          true;
        `);
      }
    }, 100);
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: LEAFLET_HTML }}
        style={styles.webview}
        onLoad={handleLoad}
        onMessage={handleMessage}
        scrollEnabled={scrollEnabled}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        )}
        originWhitelist={['*']}
      />
    </View>
  );
});

OSMMapView.displayName = "OSMMapView";

// ============================================================================
// HELPER FUNCTIONS FOR PARENT COMPONENTS
// ============================================================================

// Add marker helper - call this from parent to add markers
export const createMarker = (id, coordinate, type = 'customer', title = '', emoji = '') => ({
  id,
  coordinate,
  type,
  title,
  emoji,
});

// Add polyline helper
export const createPolyline = (id, coordinates, strokeColor = '#3B82F6', strokeWidth = 4) => ({
  id,
  coordinates,
  strokeColor,
  strokeWidth,
});

export default OSMMapView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
});
