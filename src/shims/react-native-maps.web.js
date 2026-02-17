/**
 * Web shim for react-native-maps
 *
 * react-native-maps uses native iOS/Android code and cannot run on web.
 * This provides lightweight web replacements using Leaflet (via iframe)
 * so the app can bundle and run on web without crashing.
 *
 * Components: MapView (default), Marker, Polyline, UrlTile
 */

import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

// ============================================================================
// Leaflet-based MapView for Web
// ============================================================================

const WebMapView = forwardRef(
  (
    {
      style,
      initialRegion,
      region,
      children,
      mapType,
      scrollEnabled = true,
      zoomEnabled = true,
      onPress,
      onRegionChangeComplete,
      ...props
    },
    ref
  ) => {
    const iframeRef = useRef(null);
    const mapRegion = region || initialRegion || {
      latitude: 7.8731,
      longitude: 80.7718,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    // Collect markers and polylines from children
    const markers = [];
    const polylines = [];
    const processChildren = (kids) => {
      React.Children.forEach(kids, (child) => {
        if (!child || !child.type) return;
        const name = child.type.displayName || child.type.name || "";
        if (name === "WebMarker" && child.props.coordinate) {
          markers.push({
            lat: child.props.coordinate.latitude,
            lng: child.props.coordinate.longitude,
            title: child.props.title || "",
          });
        } else if (name === "WebPolyline" && child.props.coordinates) {
          polylines.push({
            coords: child.props.coordinates.map((c) => [c.latitude, c.longitude]),
            color: child.props.strokeColor || "#4285F4",
            weight: child.props.strokeWidth || 3,
          });
        }
      });
    };
    processChildren(children);

    // Build the Leaflet HTML
    const markersJS = markers
      .map(
        (m) =>
          `L.marker([${m.lat}, ${m.lng}]).addTo(map)${m.title ? `.bindPopup("${m.title}")` : ""};`
      )
      .join("\n");

    const polylinesJS = polylines
      .map(
        (p) =>
          `L.polyline(${JSON.stringify(p.coords)}, {color: "${p.color}", weight: ${p.weight}}).addTo(map);`
      )
      .join("\n");

    const leafletHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            scrollWheelZoom: ${zoomEnabled},
            dragging: ${scrollEnabled},
            zoomControl: ${zoomEnabled},
          }).setView([${mapRegion.latitude}, ${mapRegion.longitude}], ${
      mapRegion.latitudeDelta ? Math.round(Math.log2(360 / mapRegion.latitudeDelta)) : 13
    });
          L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 19
          }).addTo(map);
          ${markersJS}
          ${polylinesJS}
        </script>
      </body>
      </html>
    `;

    // Expose imperative methods that native MapView has
    useImperativeHandle(ref, () => ({
      fitToCoordinates: () => {},
      animateToRegion: () => {},
      animateCamera: () => {},
      getCamera: async () => ({
        center: { latitude: mapRegion.latitude, longitude: mapRegion.longitude },
      }),
    }));

    const srcDoc = `data:text/html;charset=utf-8,${encodeURIComponent(leafletHTML)}`;

    return (
      <View style={[webStyles.container, style]}>
        <iframe
          ref={iframeRef}
          src={srcDoc}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          title="Map"
        />
      </View>
    );
  }
);
WebMapView.displayName = "MapView";

// ============================================================================
// Stub child components — data is extracted by WebMapView from props
// ============================================================================

const WebMarker = ({ coordinate, title, children, ...props }) => null;
WebMarker.displayName = "WebMarker";

const WebPolyline = ({ coordinates, strokeColor, strokeWidth, ...props }) => null;
WebPolyline.displayName = "WebPolyline";

const WebUrlTile = () => null;
WebUrlTile.displayName = "WebUrlTile";

const WebCallout = ({ children }) => null;

// ============================================================================
// Exports matching react-native-maps API
// ============================================================================

export default WebMapView;
export const Marker = WebMarker;
export const Polyline = WebPolyline;
export const UrlTile = WebUrlTile;
export const Callout = WebCallout;
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = null;

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#e8e8e8",
  },
});
