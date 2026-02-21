import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import FreeMapView from '../../components/maps/FreeMapView';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../../config/env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RestaurantDetail() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // 'logo' | 'cover' | null
  const [locating, setLocating] = useState(false);
  const [formData, setFormData] = useState({
    restaurant_name: '',
    address: '',
    city: '',
    postal_code: '',
    opening_time: '',
    close_time: '',
    logo_url: '',
    cover_image_url: '',
    latitude: null,
    longitude: null,
  });
  const [mapRegion, setMapRegion] = useState({
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    fetchRestaurant();
  }, []);

  const fetchRestaurant = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/restaurant`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || 'Failed to load restaurant');
        setLoading(false);
        return;
      }

      setRestaurant(data.restaurant);
      const restaurantData = {
        restaurant_name: data.restaurant.restaurant_name || '',
        address: data.restaurant.address || '',
        city: data.restaurant.city || '',
        postal_code: data.restaurant.postal_code || '',
        opening_time: data.restaurant.opening_time || '',
        close_time: data.restaurant.close_time || '',
        logo_url: data.restaurant.logo_url || '',
        cover_image_url: data.restaurant.cover_image_url || '',
        latitude: data.restaurant.latitude || null,
        longitude: data.restaurant.longitude || null,
      };
      setFormData(restaurantData);

      // Set map region
      if (data.restaurant.latitude && data.restaurant.longitude) {
        const newRegion = {
          latitude: Number(data.restaurant.latitude),
          longitude: Number(data.restaurant.longitude),
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(newRegion);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching restaurant:', err);
      setError('Network error while loading restaurant');
      setLoading(false);
    }
  };

  const handleInputChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleImageUpload = async (imageType) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: imageType === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(imageType);
        setError(null);

        try {
          const token = await AsyncStorage.getItem('token');
          const base64String = `data:image/jpeg;base64,${result.assets[0].base64}`;

          const response = await fetch(`${API_URL}/admin/upload-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imageData: base64String }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to upload image');
          }

          const fieldName = imageType === 'logo' ? 'logo_url' : 'cover_image_url';
          setFormData({
            ...formData,
            [fieldName]: data.url,
          });
        } catch (err) {
          console.error('Error uploading image:', err);
          Alert.alert('Error', err.message || 'Failed to upload image');
        } finally {
          setUploading(null);
        }
      }
    } catch (err) {
      console.error('Error selecting image:', err);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleSave = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/admin/restaurant`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data?.message || 'Failed to update restaurant');
        return;
      }

      setRestaurant(data.restaurant);
      setEditing(false);
      Alert.alert('Success', 'Restaurant details updated successfully');
    } catch (err) {
      console.error('Error updating restaurant:', err);
      Alert.alert('Error', 'Network error while updating restaurant');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFormData({
      restaurant_name: restaurant.restaurant_name || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      postal_code: restaurant.postal_code || '',
      opening_time: restaurant.opening_time || '',
      close_time: restaurant.close_time || '',
      logo_url: restaurant.logo_url || '',
      cover_image_url: restaurant.cover_image_url || '',
      latitude: restaurant.latitude || null,
      longitude: restaurant.longitude || null,
    });
    // Reset map region
    if (restaurant.latitude && restaurant.longitude) {
      const newRegion = {
        latitude: Number(restaurant.latitude),
        longitude: Number(restaurant.longitude),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    }
  };

  const handleMapPress = (event) => {
    if (!editing) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    setFormData((prev) => ({
      ...prev,
      latitude: latitude,
      longitude: longitude,
    }));
    setMapRegion((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions to use this feature.');
        setLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch (err) {
      console.error('Location error:', err);
      Alert.alert('Error', 'Unable to get your location. Please select manually on the map.');
    } finally {
      setLocating(false);
    }
  };

  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonBox, { width: 200, height: 24 }]} />
        <View style={[styles.skeletonBox, { width: 150, height: 16, marginTop: 8 }]} />
      </View>
      <View style={[styles.skeletonBox, { width: '100%', height: 160, marginTop: 16 }]} />
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBox, { width: 80, height: 80, borderRadius: 40 }]} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <View style={[styles.skeletonBox, { width: 120, height: 16 }]} />
          <View style={[styles.skeletonBox, { width: 180, height: 12, marginTop: 8 }]} />
        </View>
      </View>
      {[...Array(4)].map((_, i) => (
        <View key={i} style={{ marginTop: 16 }}>
          <View style={[styles.skeletonBox, { width: 100, height: 12 }]} />
          <View style={[styles.skeletonBox, { width: '100%', height: 44, marginTop: 8 }]} />
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Restaurant Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {renderLoadingSkeleton()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error && !restaurant) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Restaurant Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchRestaurant}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Restaurant Details</Text>
          <Text style={styles.headerSubtitle}>Manage your restaurant info</Text>
        </View>
        {!editing ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditing(true)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Edit Mode Actions */}
          {editing && (
            <View style={styles.editActionsBar}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (uploading !== null || saving) && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={uploading !== null || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {uploading !== null ? 'Uploading...' : 'Save Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {restaurant && (
            <View style={styles.formCard}>
              {/* Logo Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Restaurant Logo</Text>
                <View style={styles.logoSection}>
                  <View style={styles.logoContainer}>
                    {formData.logo_url ? (
                      <Image
                        source={{ uri: formData.logo_url }}
                        style={styles.logoImage}
                      />
                    ) : (
                      <View style={styles.logoPlaceholder}>
                        <Text style={styles.logoPlaceholderText}>No logo</Text>
                      </View>
                    )}
                  </View>
                  {editing && (
                    <TouchableOpacity
                      style={[
                        styles.uploadButton,
                        uploading === 'logo' && styles.uploadButtonDisabled,
                      ]}
                      onPress={() => handleImageUpload('logo')}
                      disabled={uploading !== null}
                    >
                      {uploading === 'logo' ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.uploadButtonText}>Change Logo</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Cover Image Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Cover Image</Text>
                <View style={styles.coverContainer}>
                  {formData.cover_image_url ? (
                    <Image
                      source={{ uri: formData.cover_image_url }}
                      style={styles.coverImage}
                    />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Text style={styles.coverPlaceholderText}>
                        No cover image uploaded
                      </Text>
                    </View>
                  )}
                </View>
                {editing && (
                  <TouchableOpacity
                    style={[
                      styles.uploadButton,
                      styles.uploadButtonFull,
                      uploading === 'cover' && styles.uploadButtonDisabled,
                    ]}
                    onPress={() => handleImageUpload('cover')}
                    disabled={uploading !== null}
                  >
                    {uploading === 'cover' ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.uploadButtonText}>Change Cover Image</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Form Fields */}
              <View style={styles.section}>
                <Text style={styles.inputLabel}>Restaurant Name</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={formData.restaurant_name}
                  onChangeText={(value) => handleInputChange('restaurant_name', value)}
                  editable={editing}
                  placeholder="Enter restaurant name"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={formData.city}
                  onChangeText={(value) => handleInputChange('city', value)}
                  editable={editing}
                  placeholder="Enter city"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={formData.address}
                  onChangeText={(value) => handleInputChange('address', value)}
                  editable={editing}
                  placeholder="Enter full address"
                  placeholderTextColor="#9ca3af"
                  multiline
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.inputLabel}>Postal Code</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={formData.postal_code}
                  onChangeText={(value) => handleInputChange('postal_code', value)}
                  editable={editing}
                  placeholder="Enter postal code"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timeItem}>
                  <Text style={styles.inputLabel}>Opening Time</Text>
                  <TextInput
                    style={[styles.input, !editing && styles.inputDisabled]}
                    value={formData.opening_time}
                    onChangeText={(value) => handleInputChange('opening_time', value)}
                    editable={editing}
                    placeholder="e.g., 09:00"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View style={styles.timeItem}>
                  <Text style={styles.inputLabel}>Closing Time</Text>
                  <TextInput
                    style={[styles.input, !editing && styles.inputDisabled]}
                    value={formData.close_time}
                    onChangeText={(value) => handleInputChange('close_time', value)}
                    editable={editing}
                    placeholder="e.g., 22:00"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Restaurant Location Map */}
          {restaurant && (
            <View style={styles.mapCard}>
              <View style={styles.mapHeader}>
                <Text style={styles.mapTitle}>Restaurant Location</Text>
                {editing && (
                  <Text style={styles.mapHint}>Tap on map to change location</Text>
                )}
              </View>

              <View style={styles.addressInfo}>
                <Text style={styles.addressLabel}>Address:</Text>
                <Text style={styles.addressText}>
                  {formData.address || 'N/A'}
                  {formData.city && `, ${formData.city}`}
                </Text>
              </View>

              {formData.latitude && formData.longitude && (
                <Text style={styles.coordsText}>
                  Coordinates: {Number(formData.latitude).toFixed(6)},{' '}
                  {Number(formData.longitude).toFixed(6)}
                </Text>
              )}

              {/* Use My Location Button */}
              {editing && (
                <TouchableOpacity
                  style={[styles.locationButton, locating && styles.locationButtonDisabled]}
                  onPress={handleUseMyLocation}
                  disabled={locating}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Text style={styles.locationButtonIcon}>📍</Text>
                      <Text style={styles.locationButtonText}>Use My Current Location</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Map */}
              <View
                style={[
                  styles.mapContainer,
                  editing && styles.mapContainerEditing,
                ]}
              >
                <FreeMapView
                  ref={mapRef}
                  style={styles.map}
                  region={mapRegion}
                  onPress={handleMapPress}
                  scrollEnabled={editing}
                  zoomEnabled={editing}
                  markers={formData.latitude && formData.longitude ? [{
                    id: 'restaurant',
                    coordinate: {
                      latitude: Number(formData.latitude),
                      longitude: Number(formData.longitude),
                    },
                    type: 'restaurant',
                    emoji: '🏪',
                    title: 'Restaurant Location',
                  }] : []}
                />
              </View>

              {/* Coordinate Display */}
              {formData.latitude && formData.longitude && (
                <View style={styles.coordsGrid}>
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Latitude</Text>
                    <View style={styles.coordValue}>
                      <Text style={styles.coordValueText}>
                        {Number(formData.latitude).toFixed(6)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Longitude</Text>
                    <View style={styles.coordValue}>
                      <Text style={styles.coordValueText}>
                        {Number(formData.longitude).toFixed(6)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Bottom Spacing */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#16a34a',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#16a34a',
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  editActionsBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  coverContainer: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  uploadButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  uploadButtonFull: {
    width: '100%',
  },
  uploadButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeItem: {
    flex: 1,
  },
  mapCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mapHeader: {
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  mapHint: {
    fontSize: 12,
    color: '#6366f1',
    marginTop: 4,
  },
  addressInfo: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginRight: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  coordsText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  locationButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  locationButtonIcon: {
    fontSize: 16,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  mapContainerEditing: {
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  map: {
    flex: 1,
  },
  coordsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  coordItem: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  coordValue: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  coordValueText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'monospace',
  },
  // Skeleton Styles
  skeletonContainer: {
    padding: 4,
  },
  skeletonHeader: {
    marginBottom: 8,
  },
  skeletonBox: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  // Error Styles
  errorContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
