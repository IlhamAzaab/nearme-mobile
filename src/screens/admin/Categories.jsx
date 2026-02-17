import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Animation for modal
  const slideAnim = useState(new Animated.Value(300))[0];

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (showAddModal || editingCategory) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [showAddModal, editingCategory]);

  const fetchCategories = () => {
    // TODO: Fetch categories from API
    setTimeout(() => {
      setCategories([]);
      setLoading(false);
    }, 500);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    fetchCategories();
    setRefreshing(false);
  };

  const handleDelete = (categoryId) => {
    Alert.alert(
      "Delete Category",
      "Are you sure you want to delete this category?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // TODO: Delete category via API
            setCategories(categories.filter((c) => c.id !== categoryId));
          },
        },
      ]
    );
  };

  const handleSave = (category) => {
    if (editingCategory) {
      setCategories(
        categories.map((c) => (c.id === category.id ? category : c))
      );
    } else {
      setCategories([...categories, { ...category, id: Date.now() }]);
    }
    setShowAddModal(false);
    setEditingCategory(null);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingCategory(null);
  };

  // Loading Skeleton
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonItem}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonContent}>
            <View style={[styles.skeleton, { width: "40%", height: 16, marginBottom: 8 }]} />
            <View style={[styles.skeleton, { width: "60%", height: 12 }]} />
          </View>
          <View style={[styles.skeleton, { width: 60, height: 32 }]} />
        </View>
      ))}
    </View>
  );

  // Empty State
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🏷️</Text>
      <Text style={styles.emptyTitle}>No categories found</Text>
      <Text style={styles.emptySubtitle}>
        Click "Add Category" to create your first category.
      </Text>
    </View>
  );

  // Category Card
  const renderCategoryCard = (category) => (
    <View key={category.id} style={styles.categoryCard}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryDescription}>
          {category.description || "No description"}
        </Text>
        <Text style={styles.productCount}>
          {category.product_count || 0} products
        </Text>
      </View>
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setEditingCategory(category)}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(category.id)}
        >
          <Text style={styles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#22c55e"]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Categories</Text>
            <Text style={styles.headerSubtitle}>
              Organize your products into categories.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentCard}>
          {loading ? (
            renderSkeleton()
          ) : categories.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.categoriesGrid}>
              {categories.map(renderCategoryCard)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Category Modal */}
      <Modal
        visible={showAddModal || !!editingCategory}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Animated.View
            style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <CategoryModal
                category={editingCategory}
                onClose={closeModal}
                onSave={handleSave}
              />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function CategoryModal({ category, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    description: category?.description || "",
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert("Error", "Category name is required");
      return;
    }
    onSave({ ...category, ...formData });
  };

  return (
    <View style={styles.modalInner}>
      {/* Modal Handle */}
      <View style={styles.modalHandle}>
        <View style={styles.modalHandleBar} />
      </View>

      {/* Modal Header */}
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>
          {category ? "Edit Category" : "Add New Category"}
        </Text>
        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
          <Text style={styles.modalCloseIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Category Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="e.g., Burgers, Drinks, Desserts"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Optional description..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>
              {category ? "Update" : "Add"} Category
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    gap: 6,
  },
  addButtonIcon: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // Content Card
  contentCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },

  // Skeleton
  skeletonContainer: {
    padding: 16,
  },
  skeletonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  skeletonImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  skeletonContent: {
    flex: 1,
  },
  skeleton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4b5563",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "center",
  },

  // Categories Grid
  categoriesGrid: {
    padding: 16,
    gap: 12,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  categoryDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  productCount: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 8,
  },
  categoryActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  editIcon: {
    fontSize: 18,
  },
  deleteIcon: {
    fontSize: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalInner: {
    paddingBottom: 32,
  },
  modalHandle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 20,
    color: "#6b7280",
  },

  // Form
  form: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  submitButton: {
    flex: 1,
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
