import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";
import usePageEnterAnimation from "../../hooks/usePageEnterAnimation";
import { getAccessToken } from "../../lib/authStorage";

const FOOD_CATEGORIES = [
  "Koththu",
  "Fried Rice",
  "Biriyani",
  "BBQ",
  "parotta",
  "rice and curry",
  "curry",
  "short eats",
  "dolphin",
  "sea food",
  "others",
];

const fetchFoods = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/foods`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to load products");
  return data.foods || [];
};

const deleteFood = async (foodId) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/foods/${foodId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to delete product");
  return foodId;
};

const patchFoodAvailability = async ({ foodId, is_available }) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/foods/${foodId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_available }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Failed to update availability");
  }

  return data;
};

const uploadAdminImage = async (imageData) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/upload-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageData }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to upload image");
  return data.url;
};

const upsertFood = async ({ foodId, payload }) => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const url = foodId
    ? `${API_URL}/admin/foods/${foodId}`
    : `${API_URL}/admin/foods`;

  const method = foodId ? "PATCH" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to save product");
  return data;
};

export default function Products() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pageEnterStyle = usePageEnterAnimation();

  const availabilityLabel =
    availabilityFilter === "all"
      ? "All Products"
      : availabilityFilter === "available"
        ? "Available"
        : "Unavailable";

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: fetchFoods,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFood,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (err) => {
      Alert.alert("Error", err.message || "Failed to delete product");
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: patchFoodAvailability,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: async (err) => {
      Alert.alert("Error", err.message || "Failed to update availability");
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const foods = productsQuery.data || [];
  const loading = productsQuery.isLoading && !productsQuery.data;

  const handleDelete = async (foodId) => {
    Alert.alert(
      "Delete Product",
      "Are you sure you want to delete this product?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            deleteMutation.mutate(foodId);
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

    queryClient.setQueryData(["admin", "products"], (prev = []) =>
      prev.map((f) => (f.id === food.id ? { ...f, is_available: newValue } : f))
    );

    toggleAvailabilityMutation.mutate({
      foodId: food.id,
      is_available: newValue,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    } finally {
      setRefreshing(false);
    }
  };

  const filteredFoods = foods.filter((food) => {
    const safeSearch = search.toLowerCase();

    const matchesSearch =
      food.name.toLowerCase().includes(safeSearch) ||
      String(food.category || "")
        .toLowerCase()
        .includes(safeSearch);

    const matchesAvailability =
      availabilityFilter === "all" ||
      (availabilityFilter === "available" && food.is_available) ||
      (availabilityFilter === "unavailable" && !food.is_available);

    return matchesSearch && matchesAvailability;
  });

  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[...Array(4)].map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonContent}>
            <View style={[styles.skeletonLine, { width: "75%" }]} />
            <View style={[styles.skeletonLine, { width: "50%" }]} />
            <View style={[styles.skeletonLine, { width: "35%" }]} />
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
          : "No products match your search/filter."}
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
        <View style={styles.productImageContainer}>
          {food.image_url ? (
            <Image source={{ uri: food.image_url }} style={styles.productImage} />
          ) : (
            <View style={styles.noImagePlaceholder}>
              <Text style={styles.noImageText}>No img</Text>
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <View style={styles.productNameContainer}>
              <Text style={styles.productName} numberOfLines={1}>
                {food.name}
              </Text>
              <Text style={styles.productDescription} numberOfLines={2}>
                {food.description || "-"}
              </Text>
              <Text style={styles.productCategory} numberOfLines={1}>
                {food.category || "others"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.availabilityToggle}
              onPress={(e) => {
                e.stopPropagation?.();
                toggleAvailability(food);
              }}
            >
              <Text
                style={[
                  styles.availabilityLabel,
                  {
                    color: food.is_available ? "#059669" : "#9CA3AF",
                  },
                ]}
              >
                {food.is_available ? "Available" : "Unavailable"}
              </Text>

              <View
                style={[
                  styles.customSwitch,
                  {
                    backgroundColor: food.is_available ? "#06C168" : "#d1d5db",
                  },
                ]}
              >
                <View
                  style={[
                    styles.customSwitchThumb,
                    food.is_available && styles.customSwitchThumbOn,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.priceRows}>
            <View style={styles.sizePriceRow}>
              <Text style={styles.sizeLabel}>
                {food.regular_size || "Regular"}
              </Text>
              <Text style={styles.activePrice}>
                Rs. {food.offer_price || food.regular_price}
              </Text>
              {food.offer_price ? (
                <Text style={styles.strikePrice}>Rs. {food.regular_price}</Text>
              ) : null}
            </View>

            {food.extra_price ? (
              <View style={styles.sizePriceRow}>
                <Text style={styles.sizeLabel}>{food.extra_size || "Extra"}</Text>
                <Text style={styles.activePrice}>
                  Rs. {food.extra_offer_price || food.extra_price}
                </Text>
                {food.extra_offer_price ? (
                  <Text style={styles.strikePrice}>Rs. {food.extra_price}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={(e) => {
            e.stopPropagation?.();
            openEdit(food);
          }}
        >
          <Feather name="edit-2" size={15} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation?.();
            handleDelete(food.id);
          }}
        >
          <Feather name="trash-2" size={15} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.View style={[styles.pageAnimationWrap, pageEnterStyle]}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle}>Products</Text>
              <View style={styles.headerUnderline} />
            </View>

            <View style={styles.headerActions}>
              <View style={styles.filterDropdownWrap}>
                <TouchableOpacity
                  style={styles.filterPill}
                  onPress={() => setShowFilterMenu((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.filterPillText}>{availabilityLabel}</Text>
                  <Feather name="chevron-down" size={14} color="#64748b" />
                </TouchableOpacity>

                {showFilterMenu ? (
                  <View style={styles.filterMenu}>
                    {["all", "available", "unavailable"].map((value) => {
                      const label =
                        value === "all"
                          ? "All Products"
                          : value === "available"
                            ? "Available"
                            : "Unavailable";

                      const selected = availabilityFilter === value;

                      return (
                        <TouchableOpacity
                          key={value}
                          style={styles.filterMenuItem}
                          onPress={() => {
                            setAvailabilityFilter(value);
                            setShowFilterMenu(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.filterMenuText,
                              selected && styles.filterMenuTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate("AdminNotifications")}
              >
                <Feather name="bell" size={18} color="#4b5563" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setShowFilterMenu(false)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#06C168"]}
            />
          }
        >
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Feather
                name="search"
                size={16}
                color="#9ca3af"
                style={styles.searchIcon}
              />

              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search food items, categories..."
                placeholderTextColor="#9ca3af"
              />

              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Feather
                    name="x"
                    size={16}
                    color="#9ca3af"
                    style={styles.clearSearch}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.addProductCta}
            onPress={() => {
              setEditingFood(null);
              setShowAddModal(true);
            }}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.addProductCtaText}>Add Product</Text>
          </TouchableOpacity>

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
      </Animated.View>

      <AddProductModal
        visible={showAddModal}
        food={editingFood}
        onClose={() => {
          setShowAddModal(false);
          setEditingFood(null);
        }}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
          setShowAddModal(false);
          setEditingFood(null);
        }}
      />
    </SafeAreaView>
  );
}

function AddProductModal({ visible, food, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "others",
    description: "",
    image_url: "",
    available_time: [],
    regular_size: "",
    regular_portion: "",
    regular_price: "",
    offer_price: "",
    extra_size: "",
    extra_portion: "",
    extra_price: "",
    extra_offer_price: "",
    is_available: true,
  });

  const [, setError] = useState(null);

  const availableTimes = ["breakfast", "lunch", "dinner"];

  const uploadImageMutation = useMutation({
    mutationFn: uploadAdminImage,
    onSuccess: (imageUrl) => {
      setFormData((prev) => ({ ...prev, image_url: imageUrl }));
    },
    onError: (err) => {
      const message = err.message || "Failed to upload image";
      setError(message);
      Alert.alert("Error", message);
    },
  });

  const saveFoodMutation = useMutation({
    mutationFn: upsertFood,
    onSuccess: () => {
      onSave();
    },
    onError: (err) => {
      const message = err.message || "Failed to save product";
      setError(message);
      Alert.alert("Error", message);
    },
  });

  useEffect(() => {
    if (visible) {
      setFormData({
        name: food?.name || "",
        category: food?.category || "others",
        description: food?.description || "",
        image_url: food?.image_url || "",
        available_time: food?.available_time || [],
        regular_size: food?.regular_size || "",
        regular_portion: food?.regular_portion || "",
        regular_price: food?.regular_price?.toString() || "",
        offer_price: food?.offer_price?.toString() || "",
        extra_size: food?.extra_size || "",
        extra_portion: food?.extra_portion || "",
        extra_price: food?.extra_price?.toString() || "",
        extra_offer_price: food?.extra_offer_price?.toString() || "",
        is_available: food?.is_available ?? true,
      });

      setError(null);
    }
  }, [visible, food]);

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      setError(null);

      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        permissionResult.status !== "granted" &&
        permissionResult.granted !== true
      ) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets?.[0];

      if (!selectedAsset) {
        Alert.alert("Error", "No image selected. Please try again.");
        return;
      }

      if (selectedAsset.type && selectedAsset.type !== "image") {
        Alert.alert("Invalid File", "Please select an image file only.");
        return;
      }

      if (!selectedAsset.base64) {
        Alert.alert(
          "Error",
          "Could not read the selected image. Please choose another image."
        );
        return;
      }

      const uri = selectedAsset.uri || "";
      const lowerUri = uri.toLowerCase();

      let mimeType = selectedAsset.mimeType || "image/jpeg";

      if (!selectedAsset.mimeType) {
        if (lowerUri.endsWith(".png")) {
          mimeType = "image/png";
        } else if (lowerUri.endsWith(".webp")) {
          mimeType = "image/webp";
        } else {
          mimeType = "image/jpeg";
        }
      }

      const imageData = `data:${mimeType};base64,${selectedAsset.base64}`;

      await uploadImageMutation.mutateAsync(imageData);
    } catch (err) {
      console.error("Image picker error:", err);
      Alert.alert(
        "Error",
        err?.message || "Error selecting image. Please try again."
      );
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!formData.name.trim()) {
      setError("Product name is required");
      Alert.alert("Validation Error", "Product name is required");
      return;
    }

    if (!formData.regular_price) {
      setError("Regular price is required");
      Alert.alert("Validation Error", "Regular price is required");
      return;
    }

    if (!formData.category || !FOOD_CATEGORIES.includes(formData.category)) {
      setError("Please select a valid category");
      Alert.alert("Validation Error", "Please select a valid category");
      return;
    }

    if (formData.available_time.length === 0) {
      setError("Select at least one available time");
      Alert.alert("Validation Error", "Select at least one available time");
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
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
        extra_price: formData.extra_price ? parseFloat(formData.extra_price) : null,
        extra_offer_price: formData.extra_offer_price
          ? parseFloat(formData.extra_offer_price)
          : null,
      };

      await saveFoodMutation.mutateAsync({ foodId: food?.id, payload });
    } catch (err) {
      console.error("Save product error:", err);
    }
  };

  const loading = saveFoodMutation.isPending;
  const uploading = uploadImageMutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.header}>
          <View style={modalStyles.headerLeft}>
            <TouchableOpacity
              style={modalStyles.closeButton}
              onPress={onClose}
              disabled={loading || uploading}
            >
              <Feather name="arrow-left" size={18} color="#374151" />
            </TouchableOpacity>

            <Text style={modalStyles.headerTitle}>
              {food ? "Edit Product" : "Add New Product"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              modalStyles.headerSaveButton,
              (loading || uploading) && modalStyles.saveButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || uploading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={modalStyles.headerSaveButtonText}>
                {food ? "Save" : "Save Product"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={modalStyles.scrollView}
            contentContainerStyle={modalStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Product Image</Text>

              <View style={modalStyles.imageSection}>
                {formData.image_url ? (
                  <View style={modalStyles.previewWrap}>
                    <Image
                      source={{ uri: formData.image_url }}
                      style={modalStyles.previewImage}
                    />

                    <TouchableOpacity
                      style={modalStyles.removeImageButton}
                      onPress={() => handleInputChange("image_url", "")}
                    >
                      <Feather name="x" size={12} color="#06C168" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={modalStyles.uploadIconCircle}>
                      <Feather name="upload-cloud" size={22} color="#ffffff" />
                    </View>

                    <Text style={modalStyles.uploadTitle}>Upload Food Image</Text>

                    <Text style={modalStyles.uploadSubtitle}>
                      JPG, PNG. Max size of 2MB
                    </Text>
                  </>
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
                    <Text style={modalStyles.uploadButtonText}>Browse Files</Text>
                  )}
                </TouchableOpacity>
              </View>

              {uploading ? (
                <Text style={modalStyles.helperText}>Uploading...</Text>
              ) : null}
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Product Name *</Text>
              <TextInput
                style={modalStyles.input}
                value={formData.name}
                onChangeText={(value) => handleInputChange("name", value)}
                placeholder="e.g., Chicken Burger, Biryani"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Category *</Text>

              <View style={modalStyles.categoryOptionsRow}>
                {FOOD_CATEGORIES.map((category) => {
                  const selected = formData.category === category;

                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        modalStyles.categoryOption,
                        selected && modalStyles.categoryOptionSelected,
                      ]}
                      onPress={() => handleInputChange("category", category)}
                    >
                      <Text
                        style={[
                          modalStyles.categoryOptionText,
                          selected && modalStyles.categoryOptionTextSelected,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>Description</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.textArea]}
                value={formData.description}
                onChangeText={(value) => handleInputChange("description", value)}
                placeholder="Describe your product"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

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
                        <Feather name="check" size={13} color="#ffffff" />
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

            <View style={modalStyles.toggleSection}>
              <View>
                <Text style={modalStyles.toggleLabel}>Product availability</Text>
                <Text style={modalStyles.toggleHelper}>
                  Toggle off to hide from menu
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  modalStyles.customToggle,
                  {
                    backgroundColor: formData.is_available
                      ? "#06C168"
                      : "#d1d5db",
                  },
                ]}
                onPress={() =>
                  setFormData((prev) => ({
                    ...prev,
                    is_available: !prev.is_available,
                  }))
                }
              >
                <View
                  style={[
                    modalStyles.customToggleThumb,
                    formData.is_available && modalStyles.customToggleThumbOn,
                  ]}
                />
              </TouchableOpacity>
            </View>

            <View style={modalStyles.sectionDivider}>
              <Text style={modalStyles.sectionTitle}>Regular Size (Required)</Text>
            </View>

            <View style={modalStyles.gridRow}>
              <View style={modalStyles.gridItem}>
                <Text style={modalStyles.inputLabel}>Size Name</Text>
                <TextInput
                  style={modalStyles.input}
                  value={formData.regular_size}
                  onChangeText={(value) =>
                    handleInputChange("regular_size", value)
                  }
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
                    handleInputChange("regular_portion", value)
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
                onChangeText={(value) =>
                  handleInputChange("regular_price", value)
                }
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
                onChangeText={(value) => handleInputChange("offer_price", value)}
                placeholder="Leave empty if no offer"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />

              <Text style={modalStyles.helperText}>
                Optional. Leave empty if there&apos;s no special offer price.
              </Text>
            </View>

            <View style={modalStyles.sectionDivider}>
              <Text style={modalStyles.sectionTitle}>Extra Size (Optional)</Text>
            </View>

            <View style={modalStyles.gridRow}>
              <View style={modalStyles.gridItem}>
                <Text style={modalStyles.inputLabel}>Size Name</Text>
                <TextInput
                  style={modalStyles.input}
                  value={formData.extra_size}
                  onChangeText={(value) => handleInputChange("extra_size", value)}
                  placeholder="e.g., Large"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={modalStyles.gridItem}>
                <Text style={modalStyles.inputLabel}>Portion</Text>
                <TextInput
                  style={modalStyles.input}
                  value={formData.extra_portion}
                  onChangeText={(value) =>
                    handleInputChange("extra_portion", value)
                  }
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
                onChangeText={(value) => handleInputChange("extra_price", value)}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.inputLabel}>Offer Price (Rs.)</Text>
              <TextInput
                style={modalStyles.input}
                value={formData.extra_offer_price}
                onChangeText={(value) =>
                  handleInputChange("extra_offer_price", value)
                }
                placeholder="Leave empty if no offer"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={modalStyles.footer}>
          <TouchableOpacity
            style={modalStyles.cancelButton}
            onPress={onClose}
            disabled={loading || uploading}
          >
            <Text style={modalStyles.cancelButtonText}>Discard</Text>
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
              <Text style={modalStyles.saveButtonText}>Save Product</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  pageAnimationWrap: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    zIndex: 5,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleBlock: {
    paddingTop: 2,
    paddingHorizontal: 8,
    alignItems: "flex-end",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterDropdownWrap: {
    position: "relative",
  },
  filterPill: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
  },
  filterPillText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  filterMenu: {
    position: "absolute",
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 4,
    zIndex: 10,
  },
  filterMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterMenuText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  filterMenuTextActive: {
    color: "#047857",
    fontWeight: "700",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "500",
    color: "#111827",
  },
  headerUnderline: {
    width: 74,
    height: 3,
    borderRadius: 99,
    backgroundColor: "#06C168",
    marginTop: 2,
  },
  addProductCta: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    flexDirection: "row",
    gap: 8,
  },
  addProductCtaText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 8,
    paddingBottom: 32,
  },
  searchContainer: {
    borderRadius: 16,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 16,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#06C168",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1f2937",
  },
  clearSearch: {
    padding: 4,
  },
  productsContainer: {
    backgroundColor: "transparent",
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  skeletonImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 12,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  skeletonActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  skeletonSwitch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  productsList: {
    paddingTop: 2,
  },
  productCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 10,
    marginBottom: 10,
  },
  productCardContent: {
    flexDirection: "row",
  },
  productImageContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  noImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    fontSize: 10,
    color: "#9ca3af",
  },
  productInfo: {
    flex: 1,
    marginLeft: 9,
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  productNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  productDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 3,
  },
  productCategory: {
    fontSize: 11,
    color: "#047857",
    marginTop: 4,
    fontWeight: "700",
  },
  availabilityToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  availabilityLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  customSwitch: {
    width: 34,
    height: 17,
    borderRadius: 12,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  customSwitchThumb: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#fff",
  },
  customSwitchThumbOn: {
    transform: [{ translateX: 16 }],
  },
  priceRows: {
    marginTop: 7,
    gap: 6,
  },
  sizePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sizeLabel: {
    width: 52,
    fontSize: 10,
    textTransform: "uppercase",
    color: "#9CA3AF",
    fontWeight: "700",
  },
  activePrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#06C168",
  },
  strikePrice: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 10,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  headerSaveButton: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },
  headerSaveButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  imageSection: {
    borderWidth: 2,
    borderColor: "#BBF7D0",
    borderStyle: "dashed",
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  previewWrap: {
    position: "relative",
  },
  previewImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  uploadSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  uploadButton: {
    marginTop: 10,
    backgroundColor: "#06C168",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  helperText: {
    fontSize: 12,
    color: "#06C168",
    fontWeight: "600",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  categoryOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryOption: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  categoryOptionSelected: {
    borderColor: "#06C168",
    backgroundColor: "#ECFDF3",
  },
  categoryOptionText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  categoryOptionTextSelected: {
    color: "#047857",
  },
  timeOptionsRow: {
    marginTop: 2,
  },
  timeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  timeOptionSelected: {
    backgroundColor: "transparent",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    borderColor: "#06C168",
    backgroundColor: "#06C168",
  },
  timeOptionText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  timeOptionTextSelected: {
    color: "#374151",
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 8,
  },
  toggleSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  toggleHelper: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  customToggle: {
    width: 48,
    height: 26,
    borderRadius: 16,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  customToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  customToggleThumbOn: {
    transform: [{ translateX: 22 }],
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#6B7280",
  },
  gridRow: {
    flexDirection: "column",
    gap: 0,
    marginBottom: 0,
  },
  gridItem: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#06C168",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});