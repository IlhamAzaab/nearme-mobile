/**
 * LiveDriverMap — Live tracking map for on_the_way status
 *
 * Shows:
 *   - Driver marker moving in real-time (route-aligned heading)
 *   - Customer destination marker (pin tip anchored to coordinate)
 *   - Shortest black route polyline (OSRM driving profile)
 *
 * Receives driver location from parent polling updates.
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
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

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
    .leaflet-control-zoom { display: none !important; }

    .driver-marker-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
    }

    .driver-marker-rotator {
      width: 34px;
      height: 34px;
      transform-origin: 50% 50%;
      transition: transform 300ms ease-out;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .driver-marker-rotator svg {
      width: 34px;
      height: 34px;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
    }

    .customer-pin-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 38px;
    }

    .customer-pin-wrap svg {
      width: 24px;
      height: 38px;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Customer location (fixed)
    const customerLat = ${customerLat || 0};
    const customerLng = ${customerLng || 0};

    // Initialise map
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

    // Previously used map tile provider
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: 'abc',
    }).addTo(map);

    function getDriverIcon(rotationDeg) {
      return L.divIcon({
        html: \`
          <div class="driver-marker-wrap">
            <div class="driver-marker-rotator" style="transform: rotate(\${rotationDeg}deg);">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="driver location">
                <g transform="translate(6 4)">
                  <rect x="20" y="0" width="12" height="6" rx="2.5" fill="#1A1A1A"/>
                  <path d="M18 6H34L37 12H15L18 6Z" fill="#C5122A"/>

                  <path d="M14 12H38L41 20L35 54H17L11 20L14 12Z" fill="#E1253A"/>
                  <path d="M22 12H30V54H22V12Z" fill="#B90F24"/>
                  <path d="M19 54H33L35 60H17L19 54Z" fill="#C5122A"/>

                  <path d="M9 21L14 17H17L14 34H10L7 28L9 21Z" fill="#E1253A"/>
                  <path d="M43 21L38 17H35L38 34H42L45 28L43 21Z" fill="#E1253A"/>

                  <ellipse cx="26" cy="29" rx="9.2" ry="11.2" fill="#20A35E"/>
                  <rect x="22" y="35" width="8" height="12" rx="3" fill="#20A35E"/>
                  <circle cx="26" cy="22" r="4.6" fill="#121212"/>

                  <rect x="23" y="56" width="6" height="5" rx="1.2" fill="#3A3A3A"/>
                </g>
              </svg>
            </div>
          </div>
        \`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        className: '',
      });
    }

    // Customer icon: red map pin, bottom tip anchored to coordinate
    const customerIcon = L.divIcon({
      html: \`
        <div class="customer-pin-wrap">
          <svg viewBox="0 0 128 200" xmlns="http://www.w3.org/2000/svg" aria-label="customer location">
            <path d="M64 6C31 6 6 31 6 64c0 34 22 65 50 121a9 9 0 0 0 16 0c28-56 50-87 50-121 0-33-25-58-58-58z" fill="#d9043d"/>
            <ellipse cx="64" cy="69" rx="24" ry="24" fill="#ffffff"/>
          </svg>
        </div>
      \`,
      iconSize: [24, 38],
      iconAnchor: [12, 38],
      className: '',
    });

    let driverMarker = null;
    let customerMarker = null;
    let routeLine = null;
    let lastDriverPoint = null;
    let hasDoneInitialFit = false;
    let lastRouteRequestedAt = 0;
    let lastRouteStart = null;

    const ROUTE_REFRESH_MS = 2500;
    const ROUTE_REFRESH_DISTANCE_M = 8;

    function toRad(deg) {
      return (deg * Math.PI) / 180;
    }

    function distanceMeters(aLat, aLng, bLat, bLng) {
      const R = 6371000;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const aa =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(aLat)) *
          Math.cos(toRad(bLat)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    }

    function bearingDeg(fromLat, fromLng, toLat, toLng) {
      const p1 = toRad(fromLat);
      const p2 = toRad(toLat);
      const dl = toRad(toLng - fromLng);
      const y = Math.sin(dl) * Math.cos(p2);
      const x =
        Math.cos(p1) * Math.sin(p2) -
        Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
      const brng = (Math.atan2(y, x) * 180) / Math.PI;
      return (brng + 360) % 360;
    }

    function headingForTopFacingIcon(bearing) {
      // This icon is drawn facing up (north) by default.
      // Bearing 0 means north, so no offset is required.
      return bearing;
    }

    async function fetchDrivingRoute(driverLat, driverLng) {
      if (!customerLat || !customerLng) return null;

      const url =
        'https://router.project-osrm.org/route/v1/driving/' +
        driverLng + ',' + driverLat + ';' + customerLng + ',' + customerLat +
        '?overview=full&geometries=geojson&steps=false';

      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.code !== 'Ok' || !data?.routes?.[0]?.geometry?.coordinates) {
          return null;
        }

        const coords = data.routes[0].geometry.coordinates.map(function(c) {
          return [c[1], c[0]];
        });

        return coords.length > 1 ? coords : null;
      } catch {
        return null;
      }
    }

    function shouldRefreshRoute(driverLat, driverLng) {
      const now = Date.now();
      if (!lastRouteStart) return true;

      const moved = distanceMeters(
        lastRouteStart.lat,
        lastRouteStart.lng,
        driverLat,
        driverLng,
      );

      return moved >= ROUTE_REFRESH_DISTANCE_M || now - lastRouteRequestedAt >= ROUTE_REFRESH_MS;
    }

    function ensureRouteLine(pathCoords) {
      if (!pathCoords || pathCoords.length < 2) return;

      if (routeLine) {
        routeLine.setLatLngs(pathCoords);
      } else {
        routeLine = L.polyline(pathCoords, {
          color: '#111111',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    }

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

    async function updateDriver(lat, lng, incomingHeading) {
      let routeBearing = null;

      if (shouldRefreshRoute(lat, lng)) {
        const routeCoords = await fetchDrivingRoute(lat, lng);
        if (routeCoords && routeCoords.length > 1) {
          ensureRouteLine(routeCoords);

          const first = routeCoords[0];
          const second = routeCoords[1];
          routeBearing = bearingDeg(first[0], first[1], second[0], second[1]);
        }

        lastRouteStart = { lat: lat, lng: lng };
        lastRouteRequestedAt = Date.now();
      }

      if (!routeBearing) {
        if (lastDriverPoint) {
          routeBearing = bearingDeg(lastDriverPoint.lat, lastDriverPoint.lng, lat, lng);
        } else if (customerLat && customerLng) {
          routeBearing = bearingDeg(lat, lng, customerLat, customerLng);
        }
      }

      const heading = Number.isFinite(Number(routeBearing))
        ? Number(routeBearing)
        : Number.isFinite(Number(incomingHeading))
          ? Number(incomingHeading)
          : 0;

      const iconRotation = headingForTopFacingIcon(heading);

      if (!driverMarker) {
        driverMarker = L.marker([lat, lng], { icon: getDriverIcon(iconRotation) }).addTo(map);
      } else {
        moveSmooth(driverMarker, lat, lng, 900);
        driverMarker.setIcon(getDriverIcon(iconRotation));
      }

      if (!hasDoneInitialFit) {
        fitBounds(lat, lng);
        hasDoneInitialFit = true;
      }

      lastDriverPoint = { lat: lat, lng: lng };
    }

    // Listen for messages from React Native
    window.addEventListener('message', async function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_DRIVER') {
          var lat = data.lat, lng = data.lng;
          var heading = Number.isFinite(Number(data.heading)) ? Number(data.heading) : null;
          if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
            await updateDriver(Number(lat), Number(lng), heading);
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
      deliveryLocation?.lng,
    );

    // ── Send location to the Leaflet WebView ──
    const sendLocation = useCallback(
      (lat, lng, heading) => {
        if (!mapReady || !webViewRef.current) return;
        const now = Date.now();
        const headingValue = Number.isFinite(Number(heading))
          ? Number(heading)
          : null;
        const key = `${lat.toFixed(6)},${lng.toFixed(6)},${headingValue ?? "na"}`;
        if (
          lastSentRef.current?.key === key &&
          now - lastSentRef.current.ts < 200
        )
          return;
        lastSentRef.current = { key, ts: now };

        webViewRef.current.injectJavaScript(`
          window.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({ type: 'UPDATE_DRIVER', lat: ${lat}, lng: ${lng}, heading: ${headingValue == null ? "null" : headingValue} })
          }));
          true;
        `);
      },
      [mapReady],
    );

    // ── Forward parent-provided driverLocation (from polling) ──
    useEffect(() => {
      if (driverLocation?.lat && driverLocation?.lng) {
        sendLocation(
          Number(driverLocation.lat),
          Number(driverLocation.lng),
          Number(driverLocation.heading),
        );
      }
    }, [driverLocation, sendLocation]);

    // ── Imperative API (so parent can push location too) ──
    useImperativeHandle(ref, () => ({
      updateDriverLocation: (lat, lng, heading) =>
        sendLocation(lat, lng, heading),
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
