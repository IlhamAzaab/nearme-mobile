import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';

// FREE OpenStreetMap tiles - no API key required
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function LocationPicker({ 
  onLocationSelect,
  initialLocation,
  showCurrentLocationButton = true,
  style,
}) {
  const mapRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || null);
  const [locating, setLocating] = useState(false);
  const [region, setRegion] = useState({
    latitude: initialLocation?.latitude || 7.8731,
    longitude: initialLocation?.longitude || 80.7718,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setRegion({
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [initialLocation]);

  const handleMapPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const location = { latitude, longitude };
    setSelectedLocation(location);
    onLocationSelect?.(location);
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      const newLocation = { latitude, longitude };
      
      setSelectedLocation(newLocation);
      onLocationSelect?.(newLocation);
      
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch (err) {
      console.error('Error getting location:', err);
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Select Location</Text>
      <Text style={styles.hint}>Tap on map to select location</Text>
      
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType="none"
          region={region}
          onPress={handleMapPress}
        >
          <UrlTile
            urlTemplate={OSM_TILE_URL}
            maximumZ={19}
            flipY={false}
            tileSize={256}
            zIndex={-1}
          />
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              title="Selected Location"
            />
          )}
        </MapView>
      </View>

      {showCurrentLocationButton && (
        <TouchableOpacity
          style={[styles.locationButton, locating && styles.locationButtonDisabled]}
          onPress={handleUseCurrentLocation}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>Use My Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {selectedLocation && (
        <Text style={styles.coordsText}>
          {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  map: {
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  coordsText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
});
