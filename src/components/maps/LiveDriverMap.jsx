/**
 * LiveDriverMap — Live tracking map for on_the_way status
 *
 * Shows:
 *   - Driver marker (🛵) moving in real-time
 *   - Customer destination marker (🏠)
 *   - Route polyline from driver to customer
 *
 * Receives driver location via Supabase realtime on driver_locations table
 * AND from parent's polling (whichever fires first).
 * Marker moves smoothly using ease-in-out animation.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import supabase from "../../services/supabaseClient";

// ─── Generate Leaflet HTML with customer location ─────────────────────────────
const generateLeafletHTML = (customerLat, customerLng) => `
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

    /* Icon-only driver marker */
    .driver-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
    }
    .driver-marker-icon svg {
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
    }

    /* Icon-only home marker */
    .home-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
    }
    .home-marker-icon svg {
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Customer location (fixed)
    const customerLat = ${customerLat || 0};
    const customerLng = ${customerLng || 0};

    // Initialise map with cleaner style
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: false,
      keyboard: false,
    }).setView([customerLat, customerLng], 15);

    // Use CartoDB Positron for cleaner map style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Driver icon only (no pin background)
    const driverIcon = L.divIcon({
      html: \`
        <div class="driver-marker">
          <div class="driver-marker-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 17C19 18.1046 18.1046 19 17 19C15.8954 19 15 18.1046 15 17C15 15.8954 15.8954 15 17 15C18.1046 15 19 15.8954 19 17Z" stroke="#06C168" stroke-width="2"/>
              <path d="M9 17C9 18.1046 8.10457 19 7 19C5.89543 19 5 18.1046 5 17C5 15.8954 5.89543 15 7 15C8.10457 15 9 15.8954 9 17Z" stroke="#06C168" stroke-width="2"/>
              <path d="M15 17H9M7 17H5C3.89543 17 3 16.1046 3 15V11C3 9.89543 3.89543 9 5 9H12L15 13H17C18.1046 13 19 13.8954 19 15V17H17" stroke="#06C168" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 9V5C12 4.44772 12.4477 4 13 4H16" stroke="#06C168" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
      \`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      className: '',
    });

    // Home icon only (no pin background)
    const customerIcon = L.divIcon({
      html: \`
        <div class="home-marker">
          <div class="home-marker-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 10.5L12 3L21 10.5V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V10.5Z" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 22V12H15V22" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      \`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: '',
    });

    let driverMarker = null;
    let customerMarker = null;
    let routeLine = null;
    let routeGlow = null;

    // Add customer marker if we have valid coordinates
    if (customerLat && customerLng) {
      customerMarker = L.marker([customerLat, customerLng], { icon: customerIcon }).addTo(map);
    }

    // Smooth marker movement using ease-in-out
    function moveSmooth(marker, newLat, newLng, dur) {
      const start = marker.getLatLng();
      const sLat = start.lat, sLng = start.lng;
      const t0 = performance.now();
      function tick(now) {
        const p = Math.min((now - t0) / dur, 1);
        // ease-in-out quad
        const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        const lat = sLat + (newLat - sLat) * e;
        const lng = sLng + (newLng - sLng) * e;
        marker.setLatLng([lat, lng]);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // Generate smooth curved path between two points (Bezier curve arc)
    function getCurvedPath(startLat, startLng, endLat, endLng, numPoints = 50) {
      const points = [];

      // Calculate midpoint
      const midLat = (startLat + endLat) / 2;
      const midLng = (startLng + endLng) / 2;

      // Calculate distance for curve height
      const latDiff = Math.abs(endLat - startLat);
      const lngDiff = Math.abs(endLng - startLng);
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

      // Control point offset (creates the arc) - curve upward
      const curveHeight = distance * 0.35;

      // Perpendicular direction for curve (always curve upward/north)
      const angle = Math.atan2(endLng - startLng, endLat - startLat);
      const perpAngle = angle - Math.PI / 2;

      // Control point (offset perpendicular to the line, creating top arc)
      const ctrlLat = midLat + Math.cos(perpAngle) * curveHeight;
      const ctrlLng = midLng + Math.sin(perpAngle) * curveHeight;

      // Generate Quadratic Bezier curve points
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const oneMinusT = 1 - t;

        // Quadratic Bezier formula: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
        const lat = oneMinusT * oneMinusT * startLat +
                    2 * oneMinusT * t * ctrlLat +
                    t * t * endLat;
        const lng = oneMinusT * oneMinusT * startLng +
                    2 * oneMinusT * t * ctrlLng +
                    t * t * endLng;

        points.push([lat, lng]);
      }

      return points;
    }

    // Update route line from driver to customer with smooth curve
    function updateRoute(driverLat, driverLng) {
      if (!customerLat || !customerLng) return;

      const curvedPoints = getCurvedPath(driverLat, driverLng, customerLat, customerLng);

      if (routeLine) {
        routeLine.setLatLngs(curvedPoints);
        routeGlow.setLatLngs(curvedPoints);
      } else {
        // Glow effect layer (behind main line)
        routeGlow = L.polyline(curvedPoints, {
          color: '#06C168',
          weight: 10,
          opacity: 0.2,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Main route line with gradient-like appearance
        routeLine = L.polyline(curvedPoints, {
          color: '#06C168',
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    }

    // Fit map bounds to show both markers
    function fitBounds(driverLat, driverLng) {
      if (!customerLat || !customerLng) {
        map.setView([driverLat, driverLng], 16);
        return;
      }

      const bounds = L.latLngBounds([
        [driverLat, driverLng],
        [customerLat, customerLng]
      ]);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
    }

    let firstUpdate = true;

    // Listen for messages from React Native
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_DRIVER') {
          var lat = data.lat, lng = data.lng;
          if (!driverMarker) {
            driverMarker = L.marker([lat, lng], { icon: driverIcon }).addTo(map);
            updateRoute(lat, lng);
            fitBounds(lat, lng);
          } else {
            moveSmooth(driverMarker, lat, lng, 1000);
            updateRoute(lat, lng);
            // Only fit bounds on first few updates to avoid jarring movements
            if (firstUpdate) {
              fitBounds(lat, lng);
              firstUpdate = false;
            }
          }
        }
      } catch(e) {}
    });

    // Tell RN the map is ready
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  </script>
</body>
</html>
`;

// ─── Component ───────────────────────────────────────────────────────────────
const LiveDriverMap = forwardRef(
  ({ orderId, driverLocation, deliveryLocation, style }, ref) => {
    const webViewRef = useRef(null);
    const [mapReady, setMapReady] = useState(false);
    const lastSentRef = useRef(null); // prevent duplicate sends within 200ms

    // Generate HTML with customer location
    const leafletHTML = generateLeafletHTML(
      deliveryLocation?.lat,
      deliveryLocation?.lng
    );

    // ── Send location to the Leaflet WebView ──
    const sendLocation = useCallback(
      (lat, lng) => {
        if (!mapReady || !webViewRef.current) return;
        const now = Date.now();
        const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        if (lastSentRef.current?.key === key && now - lastSentRef.current.ts < 200) return;
        lastSentRef.current = { key, ts: now };

        webViewRef.current.injectJavaScript(`
          window.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({ type: 'UPDATE_DRIVER', lat: ${lat}, lng: ${lng} })
          }));
          true;
        `);
      },
      [mapReady],
    );

    // ── Forward parent-provided driverLocation (from polling) ──
    useEffect(() => {
      if (driverLocation?.lat && driverLocation?.lng) {
        sendLocation(driverLocation.lat, driverLocation.lng);
      }
    }, [driverLocation, sendLocation]);

    // ── Supabase realtime subscription on driver_locations ──
    useEffect(() => {
      if (!mapReady || !orderId) return;

      // 1) Fetch current driver position once
      const fetchInitial = async () => {
        try {
          const { data } = await supabase
            .from("driver_locations")
            .select("lat, lng")
            .eq("order_id", orderId)
            .maybeSingle();
          if (data?.lat && data?.lng) {
            sendLocation(data.lat, data.lng);
          }
        } catch (e) {
          console.log("LiveDriverMap initial fetch error:", e);
        }
      };
      fetchInitial();

      // 2) Realtime channel
      const channel = supabase
        .channel(`live-driver-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const row = payload.new;
            if (row?.lat && row?.lng) {
              sendLocation(Number(row.lat), Number(row.lng));
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [mapReady, orderId, sendLocation]);

    // ── Imperative API (so parent can push location too) ──
    useImperativeHandle(ref, () => ({
      updateDriverLocation: (lat, lng) => sendLocation(lat, lng),
    }));

    // ── WebView message handler ──
    const handleMessage = useCallback((event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "MAP_READY") setMapReady(true);
      } catch {}
    }, []);

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={{ html: leafletHTML }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#06C168" />
            </View>
          )}
          originWhitelist={["*"]}
        />
      </View>
    );
  },
);

LiveDriverMap.displayName = "LiveDriverMap";
export default LiveDriverMap;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "#f0f0f0" },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
});
