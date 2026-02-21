import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import { fuzzySearchFoods } from "../../utils/fuzzySearch";

export default function RestaurantFoodsScreen({ route, navigation }) {
  const { restaurantId } = route.params;
  const [restaurant, setRestaurant] = useState(null);
  const [allFoods, setAllFoods] = useState([]); // All foods from API
  const [foods, setFoods] = useState([]); // Filtered/displayed foods
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRestaurantFoods();
  }, [restaurantId]);

  const fetchRestaurantFoods = async () => {
    try {
      setLoading(true);
      
      // Fetch restaurant details
      const resRes = await fetch(`${API_BASE_URL}/public/restaurants/${restaurantId}`);
      const resData = await resRes.json().catch(() => ({}));
      setRestaurant(resData.restaurant);

      // Fetch foods
      const foodsRes = await fetch(`${API_BASE_URL}/public/restaurants/${restaurantId}/foods`);
      const foodsData = await foodsRes.json().catch(() => ({}));
      const fetchedFoods = foodsData.foods || [];
      setAllFoods(fetchedFoods);
      setFoods(fetchedFoods); // Initially show all
    } catch (error) {
      console.log("Error fetching restaurant foods:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fuzzy search filter when search query changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery.trim()) {
        // Apply fuzzy search
        const filtered = fuzzySearchFoods(allFoods, searchQuery);
        setFoods(filtered);
      } else {
        // Show all foods when search is empty
        setFoods(allFoods);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery, allFoods]);

  const handleFoodPress = (food) => {
    navigation.navigate("FoodDetail", {
      restaurantId: restaurantId,
      foodId: food.id,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {restaurant?.restaurant_name || "Restaurant"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for food items..."
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Foods List */}
      <FlatList
        data={foods}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleFoodPress(item)}
            style={({ pressed }) => [styles.foodCard, pressed && { opacity: 0.9 }]}
          >
            <Image
              source={{
                uri: item.image_url || "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400",
              }}
              style={styles.foodImage}
            />
            <View style={styles.foodInfo}>
              <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.foodDesc} numberOfLines={2}>{item.description}</Text>
              <Text style={styles.foodPrice}>Rs. {item.price}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No food items available</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    opacity: 0.6,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
  },
  clearBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 20,
    color: "#111827",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  foodCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  foodImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  foodInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  foodName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  foodDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  foodPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: "#10b981",
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
  },
});
