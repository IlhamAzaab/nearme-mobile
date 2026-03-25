/**
 * FreeMapView Component — Leaflet WebView (NO Google Maps / react-native-maps)
 *
 * Drop-in replacement: same props & ref API as the old react-native-maps version.
 * Uses OpenStreetMap tiles via Leaflet loaded inside a WebView.
 */

import React, {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
} from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

// ─── Leaflet HTML ──────────────────────────────────────────────────────────
const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%}
    .cm{display:flex;align-items:center;justify-content:center;font-size:16px}
    .cm-pin{border-radius:50%;padding:4px;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;font-size:15px}
    .cm-driver{background:#06C168}
    .cm-driver.live{background:#06C168;width:38px;height:38px;font-size:18px;
      box-shadow:0 0 0 6px rgba(6,193,104,.25),0 2px 8px rgba(0,0,0,.3)}
    .cm-restaurant{background:#EF4444}
    .cm-customer{background:#3B82F6}
    .cm-pickup{background:#F59E0B}
    .leaflet-marker-icon{transition:transform .8s ease-in-out}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map, markers={}, polylines={}, userLocMarker=null;

  function initMap(lat,lng,zoom){
    if(map) map.remove();
    map=L.map('map',{zoomControl:false,attributionControl:false}).setView([lat,lng],zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    map.on('click',function(e){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapPress',coordinate:{latitude:e.latlng.lat,longitude:e.latlng.lng}}));
    });
    map.on('moveend',function(){
      var c=map.getCenter(),b=map.getBounds();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'regionChange',region:{latitude:c.lat,longitude:c.lng,latitudeDelta:b.getNorth()-b.getSouth(),longitudeDelta:b.getEast()-b.getWest()}}));
    });
  }

  function emoji4type(t){
    switch(t){case 'driver':return '🚗';case 'restaurant':return '🍽️';case 'customer':return '📍';case 'pickup':return '📦';default:return '📍'}
  }

  function mkIcon(type,emoji){
    var cls='cm-pin cm-'+(type||'customer');
    if(type==='driver') cls+=' live';
    return L.divIcon({className:'cm',html:'<div class="'+cls+'">'+(emoji||emoji4type(type))+'</div>',iconSize:[32,32],iconAnchor:[16,16]});
  }

  function addMarker(id,lat,lng,type,title,emoji){
    if(markers[id]) map.removeLayer(markers[id]);
    markers[id]=L.marker([lat,lng],{icon:mkIcon(type,emoji)}).addTo(map);
    if(title) markers[id].bindPopup(title);
  }

  function smoothMoveMarker(id,lat,lng,type,title,emoji){
    if(markers[id]) markers[id].setLatLng([lat,lng]);
    else addMarker(id,lat,lng,type,title,emoji);
  }

  function removeMarker(id){if(markers[id]){map.removeLayer(markers[id]);delete markers[id]}}

  function addPolyline(id,coords,color,width,dash){
    if(polylines[id]) map.removeLayer(polylines[id]);
    var ll=coords.map(function(c){return[c.latitude,c.longitude]});
    var o={color:color||'#3B82F6',weight:width||4,opacity:.8};
    if(dash) o.dashArray=dash;
    polylines[id]=L.polyline(ll,o).addTo(map);
  }

  function removePolyline(id){if(polylines[id]){map.removeLayer(polylines[id]);delete polylines[id]}}

  function updatePolyline(id,coords,color,width,dash){
    var ll=coords.map(function(c){return[c.latitude,c.longitude]});
    if(polylines[id]) polylines[id].setLatLngs(ll);
    else addPolyline(id,coords,color,width,dash);
  }

  function fitBounds(coords,pad){
    if(!coords.length) return;
    map.fitBounds(L.latLngBounds(coords.map(function(c){return[c.latitude,c.longitude]})),{padding:[pad||50,pad||50]});
  }

  function fitBoundsAsym(coords,top,right,bottom,left){
    if(!coords.length) return;
    map.fitBounds(L.latLngBounds(coords.map(function(c){return[c.latitude,c.longitude]})),{paddingTopLeft:[left||40,top||40],paddingBottomRight:[right||40,bottom||40]});
  }

  function setCenter(lat,lng,zoom){
    if(zoom) map.setView([lat,lng],zoom);
    else map.setView([lat,lng]);
  }

  function panTo(lat,lng,zoom){
    if(map){map.panTo([lat,lng],{animate:true,duration:.8});if(zoom) map.setZoom(zoom)}
  }

  function showUserLocation(lat,lng){
    if(userLocMarker) userLocMarker.setLatLng([lat,lng]);
    else{
      userLocMarker=L.marker([lat,lng],{icon:L.divIcon({className:'cm',html:'<div style="background:#3B82F6;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,.3)"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);
    }
  }

  function toggleInteraction(scroll,zoom){
    if(scroll){map.dragging.enable();map.touchZoom.enable()}else{map.dragging.disable();map.touchZoom.disable()}
    if(zoom){map.scrollWheelZoom.enable();map.doubleClickZoom.enable()}else{map.scrollWheelZoom.disable();map.doubleClickZoom.disable()}
  }
</script>
</body>
</html>
`;

// ─── Zoom from delta ───────────────────────────────────────────────────────
function zoomFromDelta(delta) {
  if (!delta || delta <= 0) return 13;
  return Math.round(Math.log2(360 / delta));
}

// ─── Component ─────────────────────────────────────────────────────────────
const FreeMapView = forwardRef(
  (
    {
      initialRegion,
      region,
      style,
      children, // ignored (no native children in WebView)
      markers: markersProp = [],
      polylines: polylinesProp = [],
      scrollEnabled = true,
      zoomEnabled = true,
      showsUserLocation = false,
      userLocation,
      onPress,
      onMapPress, // alias used by some driver screens
      onPanDrag,
      onRegionChange,
      onRegionChangeComplete,
      ...rest
    },
    ref,
  ) => {
    const webRef = useRef(null);
    const [ready, setReady] = useState(false);

    const defaultRegion = {
      latitude: 7.8731,
      longitude: 80.7718,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    const curRegion = region || initialRegion || defaultRegion;

    // ── Imperative ref (same API as OSMMapView + old FreeMapView) ──
    useImperativeHandle(ref, () => ({
      animateToRegion: (r) => {
        if (webRef.current && ready) {
          webRef.current.injectJavaScript(
            `setCenter(${r.latitude},${r.longitude},${zoomFromDelta(r.latitudeDelta)});true;`,
          );
        }
      },
      fitToCoordinates: (coords, options) => {
        if (webRef.current && ready && coords?.length) {
          const ep = options?.edgePadding;
          if (ep && (ep.top !== ep.bottom || ep.left !== ep.right)) {
            webRef.current.injectJavaScript(
              `fitBoundsAsym(${JSON.stringify(coords)},${ep.top || 40},${ep.right || 40},${ep.bottom || 40},${ep.left || 40});true;`,
            );
          } else {
            webRef.current.injectJavaScript(
              `fitBounds(${JSON.stringify(coords)},${ep?.top || 50});true;`,
            );
          }
        }
      },
      setCamera: (cam) => {
        if (webRef.current && ready) {
          webRef.current.injectJavaScript(
            `setCenter(${cam.center.latitude},${cam.center.longitude},${cam.zoom || 15});true;`,
          );
        }
      },
      panTo: (lat, lng, zoom) => {
        if (webRef.current && ready) {
          webRef.current.injectJavaScript(
            `panTo(${lat},${lng},${zoom || 0});true;`,
          );
        }
      },
      removeMarker: (id) => {
        if (webRef.current && ready) {
          webRef.current.injectJavaScript(`removeMarker('${id}');true;`);
        }
      },
      removePolyline: (id) => {
        if (webRef.current && ready) {
          webRef.current.injectJavaScript(`removePolyline('${id}');true;`);
        }
      },
      updatePolyline: (id, coords, color, width, dash) => {
        if (webRef.current && ready && coords?.length) {
          webRef.current.injectJavaScript(
            `updatePolyline('${id}',${JSON.stringify(coords)},'${color || "#3B82F6"}',${width || 3},'${dash || ""}');true;`,
          );
        }
      },
    }));

    // ── Init map once WebView is ready ──
    const handleLoad = () => {
      setReady(true);
      setTimeout(() => {
        webRef.current?.injectJavaScript(
          `initMap(${curRegion.latitude},${curRegion.longitude},${zoomFromDelta(curRegion.latitudeDelta)});true;`,
        );
      }, 80);
    };

    // Re-init when ready changes
    useEffect(() => {
      if (webRef.current && ready) {
        webRef.current.injectJavaScript(
          `initMap(${curRegion.latitude},${curRegion.longitude},${zoomFromDelta(curRegion.latitudeDelta)});true;`,
        );
      }
    }, [ready]);

    // ── Sync interaction flags ──
    useEffect(() => {
      if (webRef.current && ready) {
        webRef.current.injectJavaScript(
          `toggleInteraction(${!!scrollEnabled},${!!zoomEnabled});true;`,
        );
      }
    }, [ready, scrollEnabled, zoomEnabled]);

    // ── Sync markers ──
    useEffect(() => {
      if (!webRef.current || !ready) return;
      markersProp.forEach((m, i) => {
        const id = m.id ?? i;
        const fn = m.smooth ? "smoothMoveMarker" : "addMarker";
        webRef.current.injectJavaScript(
          `${fn}('${id}',${m.coordinate.latitude},${m.coordinate.longitude},'${m.type || "customer"}','${(m.title || "").replace(/'/g, "\\'")}','${m.emoji || ""}');true;`,
        );
      });
    }, [ready, markersProp]);

    // ── Sync polylines ──
    useEffect(() => {
      if (!webRef.current || !ready) return;
      polylinesProp.forEach((p, i) => {
        webRef.current.injectJavaScript(
          `addPolyline('${p.id || i}',${JSON.stringify(p.coordinates)},'${p.strokeColor || "#3B82F6"}',${p.strokeWidth || 4},'${p.dashArray || ""}');true;`,
        );
      });
    }, [ready, polylinesProp]);

    // ── User location blue dot ──
    useEffect(() => {
      if (webRef.current && ready && showsUserLocation && userLocation) {
        webRef.current.injectJavaScript(
          `showUserLocation(${userLocation.latitude},${userLocation.longitude});true;`,
        );
      }
    }, [ready, showsUserLocation, userLocation]);

    // ── Messages from WebView ──
    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "mapPress") {
          const evt = { nativeEvent: { coordinate: data.coordinate } };
          onPress?.(evt);
          onMapPress?.(evt);
        } else if (data.type === "regionChange") {
          onRegionChange?.(data.region);
          onRegionChangeComplete?.(data.region);
        }
      } catch {}
    };

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webRef}
          source={{ html: LEAFLET_HTML }}
          style={styles.webview}
          onLoad={handleLoad}
          onMessage={handleMessage}
          scrollEnabled={scrollEnabled}
          javaScriptEnabled
          domStorageEnabled
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

FreeMapView.displayName = "FreeMapView";

// ============================================================================
// Legacy named exports (kept for backward-compat — they are no longer rendered
// as children; maps now use the declarative `markers` / `polylines` props).
// ============================================================================
export const DriverMarker = () => null;
export const RestaurantMarker = () => null;
export const CustomerMarker = () => null;
export const DeliveryLocationMarker = () => null;
export const RoutePolyline = () => null;

export default FreeMapView;

// ============================================================================
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
