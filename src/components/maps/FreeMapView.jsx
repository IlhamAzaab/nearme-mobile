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
    .cm-pin{padding:0;border:0;background:transparent;
      width:30px;height:30px;display:flex;align-items:center;
      justify-content:center;font-size:20px;font-weight:700;line-height:1}
    .cm-driver{color:#111111}
    .cm-driver.live{width:30px;height:30px;font-size:22px}
    .cm-restaurant{color:#111111}
    .cm-customer{color:#111111}
    .cm-pickup{color:#F59E0B}
    .cm-svg{width:24px;height:24px;display:block}
    .leaflet-marker-icon{transition:transform .45s ease-out}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map, markers={}, polylines={}, userLocMarker=null, dashTicker=null, dashPhase=0;
  var tileLayer=null, tileProviderIndex=0, tileErrorCount=0;
  var tileProviders=[
    {url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',opts:{maxZoom:19,subdomains:'abc'}}
  ];

  function attachTileProvider(){
    if(!map) return;
    if(tileLayer){map.removeLayer(tileLayer);tileLayer=null;}
    var p=tileProviders[tileProviderIndex]||tileProviders[0];
    tileLayer=L.tileLayer(p.url,p.opts||{});
    tileLayer.on('tileerror',function(){
      tileErrorCount++;
      if(tileErrorCount>=4&&tileProviderIndex<tileProviders.length-1){
        tileProviderIndex++;
        tileErrorCount=0;
        attachTileProvider();
      }
    });
    tileLayer.addTo(map);
  }

  function restartDashAnimation(){
    if(dashTicker){clearInterval(dashTicker);dashTicker=null;}
    var hasDashed=false;
    Object.keys(polylines).forEach(function(k){
      var p=polylines[k];
      if(p&&p.options&&p.options.dashArray){hasDashed=true;}
    });
    if(!hasDashed) return;
    dashTicker=setInterval(function(){
      dashPhase=(dashPhase+1)%40;
      Object.keys(polylines).forEach(function(k){
        var p=polylines[k];
        if(p&&p.options&&p.options.dashArray){
          p.setStyle({dashOffset:String(-dashPhase)});
        }
      });
    },90);
  }

  function initMap(lat,lng,zoom){
    if(map) map.remove();
    map=L.map('map',{
      zoomControl:false,
      attributionControl:false,
      preferCanvas:true,
      zoomAnimation:true,
      fadeAnimation:true,
      markerZoomAnimation:true,
      inertia:true,
      inertiaDeceleration:2500,
      inertiaMaxSpeed:1500,
      worldCopyJump:true
    }).setView([lat,lng],zoom);
    tileErrorCount=0;
    attachTileProvider();
    map.on('click',function(e){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapPress',coordinate:{latitude:e.latlng.lat,longitude:e.latlng.lng}}));
    });
    map.on('movestart',function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapInteractStart'}));
    });
    map.on('moveend',function(){
      var c=map.getCenter(),b=map.getBounds();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'regionChange',region:{latitude:c.lat,longitude:c.lng,latitudeDelta:b.getNorth()-b.getSouth(),longitudeDelta:b.getEast()-b.getWest()}}));
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapInteractEnd'}));
    });
    map.on('zoomstart',function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapInteractStart'}));
    });
    map.on('zoomend',function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapInteractEnd'}));
    });
  }

  function emoji4type(t){
    switch(t){case 'driver':return '➤';case 'restaurant':return '⌂';case 'customer':return '⌖';case 'pickup':return '⌂';default:return '•'}
  }

  function iconSvg(type){
    if(type==='driver'){
      return '<svg width="34" height="34" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="20,4 32,32 20,26 8,32" fill="#2563EB" stroke="#1D4ED8" stroke-width="2"/><circle cx="20" cy="20" r="4" fill="#FFFFFF" stroke="#2563EB" stroke-width="2"/></svg>';
    }
    if(type==='destination'){
      return '<svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#DC143C" d="M12 2C8.14 2 5 5.14 5 9c0 4.9 5.55 11.26 6.04 11.79.5.55 1.39.55 1.89 0C13.45 20.26 19 13.9 19 9c0-3.86-3.14-7-7-7zm0 9.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z"/></svg>';
    }
    if(type==='customer'){
      return '<svg class="cm-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#111111" d="M12 2C8.14 2 5 5.14 5 9c0 4.9 5.55 11.26 6.04 11.79.5.55 1.39.55 1.89 0C13.45 20.26 19 13.9 19 9c0-3.86-3.14-7-7-7zm0 9.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z"/></svg>';
    }
    if(type==='restaurant' || type==='pickup'){
      return '<svg class="cm-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#111111" d="M12 4a2 2 0 0 1 2 2h-4a2 2 0 0 1 2-2zM6.5 14a5.5 5.5 0 0 1 11 0h2v2H4.5v-2h2zm-2 4h15v2h-15v-2z"/></svg>';
    }
    return '';
  }

  function mkIcon(type,emoji,heading){
    var cls='cm-pin cm-'+(type||'customer');
    if(type==='driver') cls+=' live';
    var transform='';
    if(type==='driver'&&Number.isFinite(Number(heading))){
      transform='transform:rotate('+Number(heading)+'deg);';
    }
    var svg = iconSvg(type);
    var iconHtml = svg || (emoji||emoji4type(type));
    var iconSize = type==='destination' ? [44,44] : [34,34];
    var iconAnchor = type==='destination' ? [22,42] : [17,17];
    return L.divIcon({className:'cm',html:'<div class="'+cls+'" style="'+transform+'">'+iconHtml+'</div>',iconSize:iconSize,iconAnchor:iconAnchor});
  }

  function addMarker(id,lat,lng,type,title,emoji,heading){
    if(markers[id]) map.removeLayer(markers[id]);
    markers[id]=L.marker([lat,lng],{icon:mkIcon(type,emoji,heading)}).addTo(map);
    if(title) markers[id].bindPopup(title);
  }

  function smoothMoveMarker(id,lat,lng,type,title,emoji,heading){
    if(markers[id]) markers[id].setLatLng([lat,lng]);
    else addMarker(id,lat,lng,type,title,emoji,heading);

    if(markers[id]&&type==='driver'){
      markers[id].setIcon(mkIcon(type,emoji,heading));
    }
  }

  function removeMarker(id){if(markers[id]){map.removeLayer(markers[id]);delete markers[id]}}

  function listMarkerIds(){
    return Object.keys(markers);
  }

  function addPolyline(id,coords,color,width,dash){
    if(polylines[id]) map.removeLayer(polylines[id]);
    var ll=coords.map(function(c){return[c.latitude,c.longitude]});
    var o={color:color||'#3B82F6',weight:width||4,opacity:.8};
    if(dash){o.dashArray=dash;o.lineCap='butt';}
    polylines[id]=L.polyline(ll,o).addTo(map);
    restartDashAnimation();
  }

  function removePolyline(id){if(polylines[id]){map.removeLayer(polylines[id]);delete polylines[id];restartDashAnimation();}}

  function listPolylineIds(){
    return Object.keys(polylines);
  }

  function updatePolyline(id,coords,color,width,dash){
    var ll=coords.map(function(c){return[c.latitude,c.longitude]});
    if(polylines[id]) polylines[id].setLatLngs(ll);
    else addPolyline(id,coords,color,width,dash);
  }

  function fitBounds(coords,pad){
    if(!map||!coords.length) return;
    map.fitBounds(L.latLngBounds(coords.map(function(c){return[c.latitude,c.longitude]})),{padding:[pad||50,pad||50]});
  }

  function fitBoundsAsym(coords,top,right,bottom,left){
    if(!map||!coords.length) return;
    map.fitBounds(L.latLngBounds(coords.map(function(c){return[c.latitude,c.longitude]})),{paddingTopLeft:[left||40,top||40],paddingBottomRight:[right||40,bottom||40]});
  }

  function setCenter(lat,lng,zoom){
    if(!map) return;
    if(zoom) map.setView([lat,lng],zoom);
    else map.setView([lat,lng]);
  }

  function panTo(lat,lng,zoom){
    if(map){map.panTo([lat,lng],{animate:true,duration:1.1,easeLinearity:.25});if(zoom) map.setZoom(zoom)}
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
      onInteractionStart,
      onInteractionEnd,
      ...rest
    },
    ref,
  ) => {
    const webRef = useRef(null);
    const [ready, setReady] = useState(false);
    const pendingFitRef = useRef(null);
    const prevMarkerIdsRef = useRef([]);
    const prevPolylineIdsRef = useRef([]);

    const defaultRegion = {
      latitude: 7.8731,
      longitude: 80.7718,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    const curRegion = region || initialRegion || defaultRegion;

    const injectFit = (coords, options) => {
      if (!webRef.current || !coords?.length) return;
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
    };

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
        if (!coords?.length) return;
        if (!ready) {
          pendingFitRef.current = { coords, options };
          return;
        }
        injectFit(coords, options);
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

        if (pendingFitRef.current?.coords?.length) {
          const { coords, options } = pendingFitRef.current;
          setTimeout(() => {
            injectFit(coords, options);
            pendingFitRef.current = null;
          }, 180);
        }
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
      const nextMarkerIds = markersProp.map((m, i) => String(m.id ?? i));

      prevMarkerIdsRef.current.forEach((id) => {
        if (!nextMarkerIds.includes(id)) {
          webRef.current?.injectJavaScript(`removeMarker('${id}');true;`);
        }
      });

      markersProp.forEach((m, i) => {
        const id = m.id ?? i;
        const fn = m.smooth ? "smoothMoveMarker" : "addMarker";
        webRef.current.injectJavaScript(
          `${fn}('${id}',${m.coordinate.latitude},${m.coordinate.longitude},'${m.type || "customer"}','${(m.title || "").replace(/'/g, "\\'")}','${m.emoji || ""}',${Number.isFinite(Number(m.heading)) ? Number(m.heading) : 0});true;`,
        );
      });

      prevMarkerIdsRef.current = nextMarkerIds;
    }, [ready, markersProp]);

    // ── Sync polylines ──
    useEffect(() => {
      if (!webRef.current || !ready) return;
      const nextPolylineIds = polylinesProp.map((p, i) => String(p.id || i));

      prevPolylineIdsRef.current.forEach((id) => {
        if (!nextPolylineIds.includes(id)) {
          webRef.current?.injectJavaScript(`removePolyline('${id}');true;`);
        }
      });

      polylinesProp.forEach((p, i) => {
        webRef.current.injectJavaScript(
          `addPolyline('${p.id || i}',${JSON.stringify(p.coordinates)},'${p.strokeColor || "#3B82F6"}',${p.strokeWidth || 4},'${p.dashArray || ""}');true;`,
        );
      });

      prevPolylineIdsRef.current = nextPolylineIds;
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
        } else if (data.type === "mapInteractStart") {
          onInteractionStart?.();
        } else if (data.type === "mapInteractEnd") {
          onInteractionEnd?.();
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
          nestedScrollEnabled
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
