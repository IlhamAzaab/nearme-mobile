import React, { useState, useEffect, useRef } from 'react';
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
  Switch,
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

// Tab Button Component
function TabButton({ title, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

// Time Picker Component
function TimePicker({ label, value, onChange, disabled }) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const [selectedHour, setSelectedHour] = useState(value ? value.split(':')[0] : '');
  const [selectedMinute, setSelectedMinute] = useState(value ? value.split(':')[1] : '');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (selectedHour && selectedMinute) {
      onChange(`${selectedHour}:${selectedMinute}`);
    }
  }, [selectedHour, selectedMinute]);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setSelectedHour(h);
      setSelectedMinute(m);
    }
  }, [value]);

  if (disabled) {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.inputText}>{value || 'Not set'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.timePickerButton}
        onPress={() => setShowPicker(!showPicker)}
      >
        <Text style={styles.timePickerText}>
          {value || 'Select time'}
        </Text>
        <Text style={styles.timePickerIcon}>🕐</Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={styles.timePickerDropdown}>
          <View style={styles.timePickerRow}>
            <ScrollView style={styles.timePickerColumn} nestedScrollEnabled>
              {hours.map((hour) => (
                <TouchableOpacity
                  key={hour}
                  style={[
                    styles.timePickerItem,
                    selectedHour === hour && styles.timePickerItemSelected,
                  ]}
                  onPress={() => setSelectedHour(hour)}
                >
                  <Text
                    style={[
                      styles.timePickerItemText,
                      selectedHour === hour && styles.timePickerItemTextSelected,
                    ]}
                  >
                    {hour}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.timePickerSeparator}>:</Text>
            <ScrollView style={styles.timePickerColumn} nestedScrollEnabled>
              {minutes.map((minute) => (
                <TouchableOpacity
                  key={minute}
                  style={[
                    styles.timePickerItem,
                    selectedMinute === minute && styles.timePickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedMinute(minute);
                    setShowPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.timePickerItemText,
                      selectedMinute === minute && styles.timePickerItemTextSelected,
                    ]}
                  >
                    {minute}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

export default function Settings() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('restaurant');
  const mapRef = useRef(null);

  // Profile State
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
  });

  // Password State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Restaurant State
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingRestaurant, setEditingRestaurant] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [restaurantFormData, setRestaurantFormData] = useState({
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

  const [mapPosition, setMapPosition] = useState(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Notification Preferences
  const [notifications, setNotifications] = useState({
    orderNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
  });

  // Fetch restaurant data
  useEffect(() => {
    if (activeTab === 'restaurant') {
      fetchRestaurant();
    }
  }, [activeTab]);

  const fetchRestaurant = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/admin/restaurant`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data?.message || 'Failed to load restaurant');
        setLoading(false);
        return;
      }

      setRestaurant(data.restaurant);
      setRestaurantFormData({
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
      });

      if (data.restaurant.latitude && data.restaurant.longitude) {
        const lat = Number(data.restaurant.latitude);
        const lng = Number(data.restaurant.longitude);
        setMapPosition({ latitude: lat, longitude: lng });
        setMapRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching restaurant:', err);
      Alert.alert('Error', 'Network error while loading restaurant');
      setLoading(false);
    }
  };

  const handleRestaurantInputChange = (key, value) => {
    setRestaurantFormData((prev) => ({ ...prev, [key]: value }));
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
        setRestaurantFormData((prev) => ({
          ...prev,
          [fieldName]: data.url,
        }));

        setUploading(null);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      Alert.alert('Error', err.message || 'Failed to upload image');
      setUploading(null);
    }
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions.');
        setLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      setMapPosition({ latitude, longitude });
      setRestaurantFormData((prev) => ({
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
      Alert.alert('Error', 'Unable to get your location.');
    } finally {
      setLocating(false);
    }
  };

  const handleMapPress = (event) => {
    if (!editingRestaurant) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMapPosition({ latitude, longitude });
    setRestaurantFormData((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
  };

  const handleRestaurantSave = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('token');

      const res = await fetch(`${API_URL}/admin/restaurant`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(restaurantFormData),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data?.message || 'Failed to update restaurant');
        return;
      }

      setRestaurant(data.restaurant);
      setEditingRestaurant(false);
      Alert.alert('Success', 'Restaurant details updated successfully');
    } catch (err) {
      console.error('Error updating restaurant:', err);
      Alert.alert('Error', 'Network error while updating restaurant');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingRestaurant(false);
    if (restaurant) {
      setRestaurantFormData({
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
      if (restaurant.latitude && restaurant.longitude) {
        setMapPosition({
          latitude: Number(restaurant.latitude),
          longitude: Number(restaurant.longitude),
        });
      }
    }
  };

  const handleProfileUpdate = async () => {
    // TODO: Implement profile update API
    Alert.alert('Coming Soon', 'Profile update functionality will be available soon.');
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match!');
      return;
    }
    // TODO: Implement password change API
    Alert.alert('Coming Soon', 'Password change functionality will be available soon.');
  };

  const handleSaveNotifications = async () => {
    // TODO: Implement notification preferences API
    Alert.alert('Success', 'Notification preferences saved');
  };

  const renderRestaurantTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading restaurant details...</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Header with Edit Button */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Restaurant Information</Text>
            <Text style={styles.sectionSubtitle}>
              Manage your restaurant details and location
            </Text>
          </View>
          {!editingRestaurant ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditingRestaurant(true)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (uploading || saving) && styles.saveButtonDisabled]}
                onPress={handleRestaurantSave}
                disabled={uploading !== null || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {uploading ? 'Uploading...' : 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Logo Section */}
        <View style={styles.imageSection}>
          <Text style={styles.inputLabel}>Restaurant Logo</Text>
          <View style={styles.logoContainer}>
            <View style={styles.logoPreview}>
              {restaurantFormData.logo_url ? (
                <Image
                  source={{ uri: restaurantFormData.logo_url }}
                  style={styles.logoImage}
                />
              ) : (
                <Text style={styles.noImageText}>No logo</Text>
              )}
            </View>
            {editingRestaurant && (
              <TouchableOpacity
                style={[styles.uploadButton, uploading === 'logo' && styles.uploadButtonDisabled]}
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
        <View style={styles.imageSection}>
          <Text style={styles.inputLabel}>Cover Image</Text>
          <View style={styles.coverPreview}>
            {restaurantFormData.cover_image_url ? (
              <Image
                source={{ uri: restaurantFormData.cover_image_url }}
                style={styles.coverImage}
              />
            ) : (
              <Text style={styles.noImageText}>No cover image</Text>
            )}
          </View>
          {editingRestaurant && (
            <TouchableOpacity
              style={[styles.uploadButton, uploading === 'cover' && styles.uploadButtonDisabled]}
              onPress={() => handleImageUpload('cover')}
              disabled={uploading !== null}
            >
              {uploading === 'cover' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.uploadButtonText}>Change Cover</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Restaurant Name</Text>
          <TextInput
            style={[styles.input, !editingRestaurant && styles.inputDisabled]}
            value={restaurantFormData.restaurant_name}
            onChangeText={(value) => handleRestaurantInputChange('restaurant_name', value)}
            editable={editingRestaurant}
            placeholder="Enter restaurant name"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea, !editingRestaurant && styles.inputDisabled]}
            value={restaurantFormData.address}
            onChangeText={(value) => handleRestaurantInputChange('address', value)}
            editable={editingRestaurant}
            placeholder="Enter full address"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={[styles.input, !editingRestaurant && styles.inputDisabled]}
              value={restaurantFormData.city}
              onChangeText={(value) => handleRestaurantInputChange('city', value)}
              editable={editingRestaurant}
              placeholder="City"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Postal Code</Text>
            <TextInput
              style={[styles.input, !editingRestaurant && styles.inputDisabled]}
              value={restaurantFormData.postal_code}
              onChangeText={(value) => handleRestaurantInputChange('postal_code', value)}
              editable={editingRestaurant}
              placeholder="Postal code"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TimePicker
              label="Opening Time"
              value={restaurantFormData.opening_time}
              onChange={(value) => handleRestaurantInputChange('opening_time', value)}
              disabled={!editingRestaurant}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimePicker
              label="Closing Time"
              value={restaurantFormData.close_time}
              onChange={(value) => handleRestaurantInputChange('close_time', value)}
              disabled={!editingRestaurant}
            />
          </View>
        </View>

        {/* Map Section */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionTitle}>Restaurant Location</Text>
          {editingRestaurant && (
            <Text style={styles.mapHint}>Tap on map to change location</Text>
          )}

          {mapPosition && (
            <Text style={styles.coordsText}>
              Coordinates: {mapPosition.latitude.toFixed(6)}, {mapPosition.longitude.toFixed(6)}
            </Text>
          )}

          {editingRestaurant && (
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
                  <Text style={styles.locationButtonText}>Use My Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={[styles.mapContainer, editingRestaurant && styles.mapContainerEditing]}>
            <FreeMapView
              ref={mapRef}
              style={styles.map}
              region={mapRegion}
              onPress={handleMapPress}
              scrollEnabled={editingRestaurant}
              zoomEnabled={editingRestaurant}
              markers={mapPosition ? [{
                id: 'restaurant',
                coordinate: mapPosition,
                type: 'restaurant',
                emoji: '🏪',
                title: 'Restaurant Location',
              }] : []}
            />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  };

  const renderProfileTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={profileData.full_name}
          onChangeText={(value) => setProfileData({ ...profileData, full_name: value })}
          placeholder="Enter your full name"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={profileData.email}
          onChangeText={(value) => setProfileData({ ...profileData, email: value })}
          placeholder="Enter your email"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={profileData.phone}
          onChangeText={(value) => setProfileData({ ...profileData, phone: value })}
          placeholder="Enter your phone number"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
        />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleProfileUpdate}>
        <Text style={styles.primaryButtonText}>Update Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPasswordTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Current Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={passwordData.currentPassword}
            onChangeText={(value) =>
              setPasswordData({ ...passwordData, currentPassword: value })
            }
            placeholder="Enter current password"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPasswords.current}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() =>
              setShowPasswords({ ...showPasswords, current: !showPasswords.current })
            }
          >
            <Text>{showPasswords.current ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={passwordData.newPassword}
            onChangeText={(value) =>
              setPasswordData({ ...passwordData, newPassword: value })
            }
            placeholder="Enter new password"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPasswords.new}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() =>
              setShowPasswords({ ...showPasswords, new: !showPasswords.new })
            }
          >
            <Text>{showPasswords.new ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Confirm New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={passwordData.confirmPassword}
            onChangeText={(value) =>
              setPasswordData({ ...passwordData, confirmPassword: value })
            }
            placeholder="Confirm new password"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPasswords.confirm}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() =>
              setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
            }
          >
            <Text>{showPasswords.confirm ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {passwordData.newPassword &&
        passwordData.confirmPassword &&
        passwordData.newPassword !== passwordData.confirmPassword && (
          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>Passwords do not match</Text>
          </View>
        )}

      <TouchableOpacity style={styles.primaryButton} onPress={handlePasswordChange}>
        <Text style={styles.primaryButtonText}>Change Password</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderNotificationsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.notificationItem}>
        <View style={styles.notificationInfo}>
          <Text style={styles.notificationTitle}>Order Notifications</Text>
          <Text style={styles.notificationDesc}>Receive alerts for new orders</Text>
        </View>
        <Switch
          value={notifications.orderNotifications}
          onValueChange={(value) =>
            setNotifications({ ...notifications, orderNotifications: value })
          }
          trackColor={{ false: '#d1d5db', true: '#86efac' }}
          thumbColor={notifications.orderNotifications ? '#22c55e' : '#9ca3af'}
        />
      </View>

      <View style={styles.notificationItem}>
        <View style={styles.notificationInfo}>
          <Text style={styles.notificationTitle}>Email Notifications</Text>
          <Text style={styles.notificationDesc}>Receive order updates via email</Text>
        </View>
        <Switch
          value={notifications.emailNotifications}
          onValueChange={(value) =>
            setNotifications({ ...notifications, emailNotifications: value })
          }
          trackColor={{ false: '#d1d5db', true: '#86efac' }}
          thumbColor={notifications.emailNotifications ? '#22c55e' : '#9ca3af'}
        />
      </View>

      <View style={styles.notificationItem}>
        <View style={styles.notificationInfo}>
          <Text style={styles.notificationTitle}>SMS Notifications</Text>
          <Text style={styles.notificationDesc}>Receive order updates via SMS</Text>
        </View>
        <Switch
          value={notifications.smsNotifications}
          onValueChange={(value) =>
            setNotifications({ ...notifications, smsNotifications: value })
          }
          trackColor={{ false: '#d1d5db', true: '#86efac' }}
          thumbColor={notifications.smsNotifications ? '#22c55e' : '#9ca3af'}
        />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSaveNotifications}>
        <Text style={styles.primaryButtonText}>Save Preferences</Text>
      </TouchableOpacity>

      {/* Dev Tools Section */}
      <View style={styles.devSection}>
        <Text style={styles.devSectionTitle}>Developer Tools</Text>
        <TouchableOpacity
          style={styles.devButton}
          onPress={() => navigation.navigate('TestNotification')}
        >
          <Text style={styles.devButtonIcon}>🔔</Text>
          <View style={styles.devButtonInfo}>
            <Text style={styles.devButtonText}>Test Push Notifications</Text>
            <Text style={styles.devButtonDesc}>Debug and test notification system</Text>
          </View>
          <Text style={styles.devButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Manage your account and restaurant settings
          </Text>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}
          >
            <TabButton
              title="Restaurant"
              active={activeTab === 'restaurant'}
              onPress={() => setActiveTab('restaurant')}
            />
            <TabButton
              title="Profile"
              active={activeTab === 'profile'}
              onPress={() => setActiveTab('profile')}
            />
            <TabButton
              title="Password"
              active={activeTab === 'password'}
              onPress={() => setActiveTab('password')}
            />
            <TabButton
              title="Notifications"
              active={activeTab === 'notifications'}
              onPress={() => setActiveTab('notifications')}
            />
          </ScrollView>
        </View>

        {/* Content Card */}
        <View style={styles.contentCard}>
          {activeTab === 'restaurant' && renderRestaurantTab()}
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'password' && renderPasswordTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  tabBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  tabButtonActive: {
    backgroundColor: '#dcfce7',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    color: '#16a34a',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
  },
  tabContent: {
    flex: 1,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#86efac',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  imageSection: {
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  coverPreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  noImageText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  uploadButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  uploadButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
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
  inputText: {
    fontSize: 16,
    color: '#6b7280',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  timePickerText: {
    fontSize: 16,
    color: '#111827',
  },
  timePickerIcon: {
    fontSize: 16,
  },
  timePickerDropdown: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    maxHeight: 200,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePickerColumn: {
    flex: 1,
    maxHeight: 200,
  },
  timePickerSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  timePickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  timePickerItemSelected: {
    backgroundColor: '#dcfce7',
  },
  timePickerItemText: {
    fontSize: 16,
    color: '#374151',
  },
  timePickerItemTextSelected: {
    color: '#16a34a',
    fontWeight: '600',
  },
  mapSection: {
    marginTop: 16,
  },
  mapHint: {
    fontSize: 12,
    color: '#4f46e5',
    marginTop: 4,
    marginBottom: 8,
  },
  coordsText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  locationButtonDisabled: {
    backgroundColor: '#93c5fd',
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
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  mapContainerEditing: {
    borderWidth: 2,
    borderColor: '#4f46e5',
  },
  map: {
    flex: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  notificationDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  devSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  devSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  devButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  devButtonInfo: {
    flex: 1,
  },
  devButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  devButtonDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  devButtonArrow: {
    fontSize: 18,
    color: '#9ca3af',
  },
});
