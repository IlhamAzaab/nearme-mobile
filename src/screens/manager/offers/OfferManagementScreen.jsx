import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { getAccessToken } from "../../../lib/authStorage";
import { API_BASE_URL } from "../../../constants/api";
import OptimizedImage from "../../../components/common/OptimizedImage";

export default function OfferManagementScreen({ navigation }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE_URL}/admin/offers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setOffers(data.data || []);
      } else {
        throw new Error(data.message || "Failed to load offers");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not load offers");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOffers();
    }, [fetchOffers])
  );

  const handleDelete = async (id) => {
    Alert.alert("Delete Offer", "Are you sure you want to delete this offer?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getAccessToken();
            const res = await fetch(`${API_BASE_URL}/admin/offers/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setOffers(offers.filter((o) => o.id !== id));
            } else {
              const err = await res.json();
              throw new Error(err.message || "Delete failed");
            }
          } catch (error) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  const renderOfferItem = ({ item }) => {
    const isExpired = new Date(item.end_time) < new Date();
    const isActive = item.is_active && !isExpired;

    return (
      <View style={styles.offerCard}>
        <OptimizedImage
          uri={item.image_url}
          style={styles.bannerImage}
        />
        <View style={styles.cardContent}>
          <Text style={styles.restaurantName}>
            {item.restaurants?.restaurant_name}
          </Text>
          <Text style={styles.foodName}>{item.foods?.name}</Text>
          {item.description ? (
            <Text style={styles.description}>{item.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Ends: {new Date(item.end_time).toLocaleString()}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActive ? "#D1FAE5" : "#FEE2E2" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isActive ? "#059669" : "#DC2626" },
                ]}
              >
                {isActive ? "ACTIVE" : "INACTIVE/EXPIRED"}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offers Management</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("CreateOffer")}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={24} color="#06C168" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#06C168" />
        </View>
      ) : offers.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="pricetags-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No offers found</Text>
          <Text style={styles.emptySubText}>
            Click the + icon to create one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id}
          renderItem={renderOfferItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
  addBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "bold",
    color: "#64748B",
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: "#94A3B8",
  },
  listContent: {
    padding: 16,
  },
  offerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bannerImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#F1F5F9",
  },
  cardContent: {
    padding: 16,
  },
  restaurantName: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  foodName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: "#475569",
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  metaText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  deleteBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
