import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getAccessToken } from "../../../lib/authStorage";
import { API_BASE_URL } from "../../../constants/api";
import OptimizedImage from "../../../components/common/OptimizedImage";

const CustomPicker = ({ label, items, selectedId, onSelect, placeholder }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedItem = items.find((i) => i.id === selectedId);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={[styles.pickerButtonText, !selectedItem && { color: "#94A3B8" }]}
        >
          {selectedItem ? selectedItem.name || selectedItem.restaurant_name : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#64748B" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    item.id === selectedId && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(item.id);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      item.id === selectedId && styles.modalItemTextSelected,
                    ]}
                  >
                    {item.name || item.restaurant_name}
                  </Text>
                  {item.id === selectedId && (
                    <Ionicons name="checkmark" size={20} color="#06C168" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function CreateOfferScreen({ navigation }) {
  const [restaurants, setRestaurants] = useState([]);
  const [foods, setFoods] = useState([]);
  
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  
  // Date time
  const [endTime, setEndTime] = useState(new Date(Date.now() + 86400000)); // Default +1 day
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchFoods(selectedRestaurant);
      setSelectedFood(null);
    } else {
      setFoods([]);
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/public/restaurants?status=active`);
      const data = await res.json();
      if (res.ok) {
        setRestaurants(data.restaurants || []);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to fetch restaurants");
    } finally {
      setFetchingData(false);
    }
  };

  const fetchFoods = async (restaurantId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/public/restaurants/${restaurantId}/foods`);
      const data = await res.json();
      if (res.ok) {
        setFoods(data.foods || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [21, 9], // Ultra-wide banner aspect ratio similar to Airtel
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(endTime);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setEndTime(newDate);
      if (Platform.OS === 'android') {
        setShowTimePicker(true);
      }
    }
  };

  const handleTimeChange = (event, selectedDate) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const newDate = new Date(endTime);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setEndTime(newDate);
    }
  };

  const submitOffer = async () => {
    if (!selectedRestaurant || !selectedFood || !image) {
      Alert.alert("Validation", "Restaurant, Food, and Image are required.");
      return;
    }

    if (endTime <= new Date()) {
      Alert.alert("Validation", "End time must be in the future.");
      return;
    }

    setLoading(true);

    try {
      const token = await getAccessToken();

      // 1. Upload Image
      const imagePayload = `data:image/jpeg;base64,${image.base64}`;
      const uploadRes = await fetch(`${API_BASE_URL}/admin/upload-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageData: imagePayload }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.message || "Image upload failed");
      }

      const imageUrl = uploadData.url;

      // 2. Create Offer
      const offerRes = await fetch(`${API_BASE_URL}/admin/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: selectedRestaurant,
          food_id: selectedFood,
          description,
          image_url: imageUrl,
          end_time: endTime.toISOString(),
        }),
      });

      const offerData = await offerRes.json();
      if (!offerRes.ok) {
        throw new Error(offerData.message || "Failed to create offer");
      }

      Alert.alert("Success", "Offer created successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#06C168" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Offer</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        
        <CustomPicker
          label="Restaurant"
          placeholder="Select Restaurant"
          items={restaurants}
          selectedId={selectedRestaurant}
          onSelect={setSelectedRestaurant}
        />

        <CustomPicker
          label="Food Item"
          placeholder={selectedRestaurant ? "Select Food" : "Select Restaurant First"}
          items={foods}
          selectedId={selectedFood}
          onSelect={setSelectedFood}
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Offer Banner Image</Text>
          <TouchableOpacity style={styles.imageUploadBtn} onPress={pickImage}>
            {image ? (
              <OptimizedImage uri={image.uri} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={32} color="#94A3B8" />
                <Text style={styles.imagePlaceholderText}>Upload Banner (21:9 Aspect Ratio)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>End Time (Expiry)</Text>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color="#06C168" />
              <Text style={styles.dateTimeText}>{endTime.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time-outline" size={20} color="#06C168" />
              <Text style={styles.dateTimeText}>
                {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={endTime}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}
        
        {showTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="e.g. 35GB + UNLIMITED CALLS"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
          onPress={submitOffer}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Publish Offer</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  backBtn: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 15,
    color: "#0F172A",
  },
  textArea: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    minHeight: 100,
  },
  imageUploadBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    overflow: "hidden",
    borderStyle: "dashed",
  },
  imagePlaceholder: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: "#94A3B8",
  },
  previewImage: {
    width: "100%",
    aspectRatio: 21 / 9,
    resizeMode: "cover",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateTimeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  dateTimeText: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "500",
  },
  submitBtn: {
    backgroundColor: "#06C168",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    minHeight: "40%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  modalItemSelected: {
    backgroundColor: "#F0FDF4",
  },
  modalItemText: {
    fontSize: 16,
    color: "#334155",
  },
  modalItemTextSelected: {
    color: "#06C168",
    fontWeight: "bold",
  },
});
