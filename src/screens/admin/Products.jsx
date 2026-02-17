import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../../config/env';

export default function Products() {
  const navigation = useNavigation();
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchFoods();
  }, []);

  const fetchFoods = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/admin/foods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || 'Failed to load products');
      } else {
        setFoods(data.foods || []);
      }
    } catch (err) {
      setError('Network error while loading products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (foodId) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const res = await fetch(`${API_URL}/admin/foods/${foodId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (res.ok) {
                setFoods(foods.filter((f) => f.id !== foodId));
              } else {
                const data = await res.json();
                Alert.alert('Error', data?.message || 'Failed to delete product');
              }
            } catch (err) {
              Alert.alert('Error', 'Error deleting product');
              console.error(err);
            }
          },
        },
      ]
    );
  };

  const openEdit = (food) => {
    setEditingFood(food);
    setShowAddModal(true);
  };

  const toggleAvailability = async (food) => {
    const newValue = !food.is_available;
    // Optimistic update
    setFoods((prev) =>
      prev.map((f) =>
        f.id === food.id ? { ...f, is_available: newValue } : f
      )
    );
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/foods/${food.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_available: newValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setFoods((prev) =>
          prev.map((f) =>
            f.id === food.id ? { ...f, is_available: !newValue } : f
          )
        );
        const data = await res.json();
        Alert.alert('Error', data?.message || 'Failed to update availability');
      }
    } catch {
      setFoods((prev) =>
        prev.map((f) =>
          f.id === food.id ? { ...f, is_available: !newValue } : f
        )
      );
      Alert.alert('Error', 'Network error updating availability');
    }
  };

  const filteredFoods = foods.filter((food) =>
    food.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderStars = (rating = 0) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Text
          key={i}
          style={[
            styles.star,
            { color: i < Math.round(rating) ? '#facc15' : '#d1d5db' },
          ]}
        >
          ★
        </Text>
      );
    }
    return (
      <View style={styles.starsContainer}>
        <View style={styles.starsRow}>{stars}</View>
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[...Array(4)].map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonContent}>
            <View style={[styles.skeletonLine, { width: '75%' }]} />
            <View style={[styles.skeletonLine, { width: '50%' }]} />
            <View style={[styles.skeletonLine, { width: '35%' }]} />
          </View>
          <View style={styles.skeletonActions}>
            <View style={[styles.skeletonLine, { width: 50 }]} />
            <View style={styles.skeletonSwitch} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
      </View>
      <Text style={styles.emptyTitle}>No products found</Text>
      <Text style={styles.emptySubtitle}>
        {foods.length === 0
          ? 'Tap "Add Product" to create your first menu item.'
          : 'No products match your search.'}
      </Text>
    </View>
  );

  const renderProductCard = (food) => (
    <TouchableOpacity
      key={food.id}
      style={styles.productCard}
      onPress={() => openEdit(food)}
      activeOpacity={0.7}
    >
      <View style={styles.productCardContent}>
        {/* Product Image */}
        <View style={styles.productImageContainer}>
          {food.image_url ? (
            <Image source={{ uri: food.image_url }} style={styles.productImage} />
          ) : (
            <View style={styles.noImagePlaceholder}>
              <Text style={styles.noImageText}>No img</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <View style={styles.productNameContainer}>
              <Text style={styles.productName} numberOfLines={1}>
                {food.name}
              </Text>
              <Text style={styles.productDescription} numberOfLines={2}>
                {food.description || '-'}
              </Text>
            </View>
            
            {/* Availability Toggle */}
            <View style={styles.availabilityToggle}>
              <Switch
                value={food.is_available}
                onValueChange={() => toggleAvailability(food)}
                trackColor={{ false: '#d1d5db', true: '#22c55e' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#d1d5db"
              />
              <Text
                style={[
                  styles.availabilityText,
                  { color: food.is_available ? '#15803d' : '#dc2626' },
                ]}
              >
                {food.is_available ? 'On' : 'Off'}
              </Text>
            </View>
          </View>

          {/* Price & Rating */}
          <View style={styles.priceRatingRow}>
            <Text style={styles.productPrice}>Rs. {food.regular_price}</Text>
            {food.offer_price ? (
              <View style={styles.offerBadge}>
                <Text style={styles.offerText}>Offer: Rs. {food.offer_price}</Text>
              </View>
            ) : null}
            {renderStars(food.stars)}
          </View>

          {/* Available Times */}
          <View style={styles.timeBadgesContainer}>
            {food.available_time?.map((time) => (
              <View key={time} style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{time}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEdit(food)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(food.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

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
          <Text style={styles.headerTitle}>Products</Text>
          <Text style={styles.headerSubtitle}>
            Manage your restaurant menu items and products.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingFood(null);
            setShowAddModal(true);
          }}
        >
          <Text style={styles.addButtonIcon}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search products by name..."
              placeholderTextColor="#9ca3af"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearSearch}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Products List */}
        <View style={styles.productsContainer}>
          {loading ? (
            renderLoadingSkeleton()
          ) : filteredFoods.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.productsList}>
              {filteredFoods.map(renderProductCard)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Product Modal */}
      <AddProductModal
        visible={showAddModal}
        food={editingFood}
        onClose={() => {
          setShowAddModal(false);
          setEditingFood(null);
        }}
        onSave={() => {
          fetchFoods();
          setShowAddModal(false);
          setEditingFood(null);
        }}
      />
    </SafeAreaView>
  );
}

// Add/Edit Product Modal Component
function AddProductModal({ visible, food, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    available_time: [],
    regular_size: '',
    regular_portion: '',
    regular_price: '',
    offer_price: '',
    extra_size: '',
    extra_portion: '',
    extra_price: '',
    is_available: true,
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const availableTimes = ['breakfast', 'lunch', 'dinner'];

  useEffect(() => {
    if (visible) {
      setFormData({
        name: food?.name || '',
        description: food?.description || '',
        image_url: food?.image_url || '',
        available_time: food?.available_time || [],
        regular_size: food?.regular_size || '',
        regular_portion: food?.regular_portion || '',
        regular_price: food?.regular_price?.toString() || '',
        offer_price: food?.offer_price?.toString() || '',
        extra_size: food?.extra_size || '',
        extra_portion: food?.extra_portion || '',
        extra_price: food?.extra_price?.toString() || '',
        is_available: food?.is_available ?? true,
      });
      setError(null);
    }
  }, [visible, food]);

  const handleInputChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleTimeToggle = (time) => {
    setFormData((prev) => ({
      ...prev,
      available_time: prev.available_time.includes(time)
        ? prev.available_time.filter((t) => t !== time)
        : [...prev.available_time, time],
    }));
  };

  const handleImagePick = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        setError(null);

        try {
          const token = await AsyncStorage.getItem('token');
          const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;

          const res = await fetch(`${API_URL}/admin/upload-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imageData }),
          });

          const data = await res.json();

          if (!res.ok) {
            setError(data?.message || 'Failed to upload image');
            Alert.alert('Error', data?.message || 'Failed to upload image');
          } else {
            setFormData({ ...formData, image_url: data.url });
          }
        } catch (err) {
          setError('Error uploading image');
          Alert.alert('Error', 'Error uploading image');
          console.error(err);
        } finally {
          setUploading(false);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Error selecting image');
      console.error(err);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    // Validation
    if (!formData.name.trim()) {
      setError('Product name is required');
      Alert.alert('Validation Error', 'Product name is required');
      setLoading(false);
      return;
    }

    if (!formData.regular_price) {
      setError('Regular price is required');
      Alert.alert('Validation Error', 'Regular price is required');
      setLoading(false);
      return;
    }

    if (formData.available_time.length === 0) {
      setError('Select at least one available time');
      Alert.alert('Validation Error', 'Select at least one available time');
      setLoading(false);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const url = food
        ? `${API_URL}/admin/foods/${food.id}`
        : `${API_URL}/admin/foods`;

      const method = food ? 'PATCH' : 'POST';

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        image_url: formData.image_url || null,
        available_time: formData.available_time,
        is_available: !!formData.is_available,
        regular_size: formData.regular_size.trim() || null,
        regular_portion: formData.regular_portion.trim() || null,
        regular_price: parseFloat(formData.regular_price),
        offer_price: formData.offer_price
          ? parseFloat(formData.offer_price)
          : null,
        extra_size: formData.extra_size.trim() || null,
        extra_portion: formData.extra_portion.trim() || null,
        extra_price: formData.extra_price
          ? parseFloat(formData.extra_price)
          : null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || 'Failed to save product');
        Alert.alert('Error', data?.message || 'Failed to save product');
      } else {
        onSave();
      }
    } catch (err) {
      setError('Network error while saving product');
      Alert.alert('Error', 'Network error while saving product');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={modalStyles.container}>
        {/* Modal Header */}
        <View style={modalStyles.header}>
          <TouchableOpacity
            style={modalStyles.closeButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={modalStyles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={modalStyles.headerTitle}>
            {food ? 'Edit Product' : 'Add New Product'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={modalStyles.scrollView}
            contentContainerStyle={modalStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Product Image */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Product Image</Text>
              <View style={modalStyles.imageSection}>
                {formData.image_url ? (
                  <Image
                    source={{ uri: formData.image_url }}
                    style={modalStyles.previewImage}
                  />
                ) : (
                  <View style={modalStyles.imagePlaceholder}>
                    <Text style={modalStyles.imagePlaceholderIcon}>📷</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    modalStyles.uploadButton,
                    uploading && modalStyles.uploadButtonDisabled,
                  ]}
                  onPress={handleImagePick}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={modalStyles.uploadButtonText}>
                      {formData.image_url ? 'Change Image' : 'Upload Image'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={modalStyles.helperText}>
                Optional. Recommended size: 400x400px
              </Text>
            </View>

            {/* Product Name */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Product Name *</Text>
              <TextInput
                style={modalStyles.input}
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholder="e.g., Chicken Burger, Biryani"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Description */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Description</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.textArea]}
                value={formData.description}
                onChangeText={(value) => handleInputChange('description', value)}
                placeholder="Describe your product (e.g., ingredients, specialties)..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Available Time */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Available Time *</Text>
              <View style={modalStyles.timeOptionsRow}>
                {availableTimes.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      modalStyles.timeOption,
                      formData.available_time.includes(time) &&
                        modalStyles.timeOptionSelected,
                    ]}
                    onPress={() => handleTimeToggle(time)}
                  >
                    <View
                      style={[
                        modalStyles.checkbox,
                        formData.available_time.includes(time) &&
                          modalStyles.checkboxSelected,
                      ]}
                    >
                      {formData.available_time.includes(time) && (
                        <Text style={modalStyles.checkboxCheck}>✓</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        modalStyles.timeOptionText,
                        formData.available_time.includes(time) &&
                          modalStyles.timeOptionTextSelected,
                      ]}
                    >
                      {time.charAt(0).toUpperCase() + time.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {formData.available_time.length === 0 && (
                <Text style={modalStyles.errorText}>
                  Select at least one available time
                </Text>
              )}
            </View>

            {/* Availability Toggle */}
            <View style={modalStyles.toggleSection}>
              <View>
                <Text style={modalStyles.toggleLabel}>Product availability</Text>
                <Text style={modalStyles.toggleHelper}>
                  Toggle off to hide from menu
                </Text>
              </View>
              <Switch
                value={!!formData.is_available}
                onValueChange={(value) =>
                  setFormData({ ...formData, is_available: value })
                }
                trackColor={{ false: '#d1d5db', true: '#6366f1' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#d1d5db"
              />
            </View>

            {/* Regular Size Section */}
            <View style={modalStyles.sectionDivider}>
              <Text style={modalStyles.sectionTitle}>Regular Size (Required)</Text>
            </View>

            <View style={modalStyles.gridRow}>
              <View style={modalStyles.gridItem}>
                <Text style={modalStyles.inputLabel}>Size Name</Text>
                <TextInput
                  style={modalStyles.input}
                  value={formData.regular_size}
                  onChangeText={(value) => handleInputChange('regular_size', value)}
                  placeholder="e.g., Regular"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={modalStyles.gridItem}>
                <Text style={modalStyles.inputLabel}>Portion</Text>
                <TextInput
                  style={modalStyles.input}
                  value={formData.regular_portion}
                  onChangeText={(value) =>
                    handleInputChange('regular_portion', value)
                  }
                  placeholder="e.g., 500g"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.inputLabel}>Price (Rs.) *</Text>
              <TextInput
                style={modalStyles.input}
                value={formData.regular_price}
                onChangeText={(value) => handleInputChange('regular_price', value)}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.inputLabel}>Offer Price (Rs.)</Text>
              <TextInput
                style={modalStyles.input}
                value={formData.offer_price}
                onChangeText={(value) => handleInputChange('offer_price', value)}
                placeholder="Leave empty if no offer"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
              <Text style={modalStyles.helperText}>
                Optional. Leave empty if there's no special offer price.
              </Text>
            </View>

            {/* Extra Size Section */}
            <View style={modalStyles.sectionDivider}>
              <Text style={modalStyles.sectionTitle}>Extra Size (Optional)</Text>
            </View>

            <View style={modalStyles.gridRow}>
              <View style={modalStyles.gridItem}>
                <Text style={modalStyles.inputLabel}>Size Name</Text>
                <TextInput
                  style={modalStyles.input}
                  value={formData.extra_size}
                  onChangeText={(value) => handleInputChange('extra_size', value)}
                  placeholder="e.g., Large"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={modalStyles.gridItem}>
                <Text style={modalStyles.inputLabel}>Portion</Text>
                <TextInput
                  style={modalStyles.input}
                  value={formData.extra_portion}
                  onChangeText={(value) => handleInputChange('extra_portion', value)}
                  placeholder="e.g., 750g"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.inputLabel}>Price (Rs.)</Text>
              <TextInput
                style={modalStyles.input}
                value={formData.extra_price}
                onChangeText={(value) => handleInputChange('extra_price', value)}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>

            {/* Spacer for bottom buttons */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Action Buttons */}
        <View style={modalStyles.footer}>
          <TouchableOpacity
            style={modalStyles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={modalStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              modalStyles.saveButton,
              (loading || uploading) && modalStyles.saveButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || uploading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={modalStyles.saveButtonText}>
                {food ? 'Update Product' : 'Add Product'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// Main Screen Styles
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonIcon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#dcfce7',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  clearSearch: {
    fontSize: 16,
    color: '#9ca3af',
    padding: 4,
  },
  productsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#dcfce7',
    overflow: 'hidden',
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  skeletonImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 12,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  skeletonActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  skeletonSwitch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  productsList: {
    padding: 12,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#dcfce7',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  productCardContent: {
    flexDirection: 'row',
  },
  productImageContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  productDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  availabilityToggle: {
    alignItems: 'center',
  },
  availabilityText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  priceRatingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  offerBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  offerText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#15803d',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 14,
  },
  ratingText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  timeBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  timeBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#1d4ed8',
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 16,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6366f1',
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
  },
});

// Modal Styles
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  imageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  previewImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  imagePlaceholderIcon: {
    fontSize: 32,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
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
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  timeOptionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timeOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1',
  },
  checkboxCheck: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  timeOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  timeOptionTextSelected: {
    color: '#4f46e5',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 8,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  toggleHelper: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
