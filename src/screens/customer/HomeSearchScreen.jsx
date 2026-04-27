import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OptimizedImage from "../../components/common/OptimizedImage";
import { API_BASE_URL } from "../../constants/api";
import { prefetchImageUrls } from "../../lib/imageCache";
import { fetchJsonWithCache, getCachedJson } from "../../lib/publicDataCache";
import {
  fuzzySearchFoods,
  fuzzySearchRestaurants,
} from "../../utils/fuzzySearch";

const RESTAURANTS_CACHE_KEY = "public:restaurants";
const FOODS_CACHE_KEY = "public:foods";

function getCachedRestaurantsList() {
  const cached = getCachedJson(RESTAURANTS_CACHE_KEY, 120000);
  return Array.isArray(cached?.restaurants) ? cached.restaurants : [];
}

function getCachedFoodsList() {
  const cached = getCachedJson(FOODS_CACHE_KEY, 120000);
  return Array.isArray(cached?.foods) ? cached.foods : [];
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Rs. 0.00";
  return `Rs. ${numeric.toFixed(2)}`;
}

function getRestaurantId(item) {
  return item?.id ?? item?.restaurant_id;
}

export default function HomeSearchScreen({ navigation, route }) {
  const initialQuery = String(route?.params?.initialQuery || "");
  const initialTab =
    route?.params?.initialTab === "food" ? "food" : "restaurant";

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [allRestaurants, setAllRestaurants] = useState(() =>
    getCachedRestaurantsList(),
  );
  const [allFoods, setAllFoods] = useState(() => getCachedFoodsList());
  const [loadingRestaurants, setLoadingRestaurants] = useState(
    () => getCachedRestaurantsList().length === 0,
  );
  const [loadingFoods, setLoadingFoods] = useState(
    () => getCachedFoodsList().length === 0,
  );

  useEffect(() => {
    let mounted = true;

    const loadRestaurants = async () => {
      try {
        const data = await fetchJsonWithCache(
          RESTAURANTS_CACHE_KEY,
          async () => {
            const res = await fetch(`${API_BASE_URL}/public/restaurants`);
            return res.json().catch(() => ({}));
          },
          { ttlMs: 120000 },
        );

        if (!mounted) return;
        const restaurants = Array.isArray(data?.restaurants)
          ? data.restaurants
          : [];
        setAllRestaurants(restaurants);
        prefetchImageUrls(
          restaurants.flatMap((item) => [
            item?.cover_image_url,
            item?.logo_url,
          ]),
        ).catch(() => {});
      } catch {
        if (!mounted) return;
        setAllRestaurants([]);
      } finally {
        if (mounted) setLoadingRestaurants(false);
      }
    };

    const loadFoods = async () => {
      try {
        const data = await fetchJsonWithCache(
          FOODS_CACHE_KEY,
          async () => {
            const res = await fetch(`${API_BASE_URL}/public/foods`);
            return res.json().catch(() => ({}));
          },
          { ttlMs: 120000 },
        );

        if (!mounted) return;
        const foods = Array.isArray(data?.foods) ? data.foods : [];
        setAllFoods(foods);
        prefetchImageUrls(foods.map((item) => item?.image_url)).catch(() => {});
      } catch {
        if (!mounted) return;
        setAllFoods([]);
      } finally {
        if (mounted) setLoadingFoods(false);
      }
    };

    loadRestaurants();
    loadFoods();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredRestaurants = useMemo(() => {
    const text = query.trim();
    if (!text) return allRestaurants;
    return fuzzySearchRestaurants(allRestaurants, text);
  }, [allRestaurants, query]);

  const filteredFoods = useMemo(() => {
    const text = query.trim();
    if (!text) return allFoods;
    return fuzzySearchFoods(allFoods, text);
  }, [allFoods, query]);

  const restaurantData = activeTab === "restaurant" ? filteredRestaurants : [];
  const foodData = activeTab === "food" ? filteredFoods : [];
  const isLoading =
    activeTab === "restaurant" ? loadingRestaurants : loadingFoods;

  const renderRestaurantItem = ({ item }) => {
    const restaurantId = getRestaurantId(item);
    if (!restaurantId) return null;

    return (
      <Pressable
        onPress={() => navigation.navigate("RestaurantFoods", { restaurantId })}
        style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
      >
        <OptimizedImage
          uri={item?.cover_image_url}
          style={styles.resultThumb}
          transition={90}
          fallback={<View style={[styles.resultThumb, styles.thumbFallback]} />}
        />
        <View style={styles.resultBody}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item?.restaurant_name || "Restaurant"}
          </Text>
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {item?.city || item?.cuisine || ""}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderFoodItem = ({ item }) => {
    const foodId = item?.id;
    const restaurantId = item?.restaurant_id;
    if (!foodId || !restaurantId) return null;

    const regularPrice = item?.regular_price ?? item?.price;
    const offerPrice = item?.offer_price;
    const hasOffer =
      offerPrice != null &&
      Number(offerPrice) > 0 &&
      Number(offerPrice) < Number(regularPrice || 0);

    return (
      <Pressable
        onPress={() =>
          navigation.navigate("FoodDetail", { foodId, restaurantId })
        }
        style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
      >
        <OptimizedImage
          uri={item?.image_url}
          style={styles.resultThumb}
          transition={90}
          fallback={<View style={[styles.resultThumb, styles.thumbFallback]} />}
        />
        <View style={styles.resultBody}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item?.name || "Food item"}
          </Text>
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {item?.restaurant_name || item?.restaurants?.restaurant_name || ""}
          </Text>
          {hasOffer ? (
            <View style={styles.resultPriceRow}>
              <Text style={styles.resultPrice}>{formatPrice(offerPrice)}</Text>
              <Text style={styles.resultOldPrice}>{formatPrice(regularPrice)}</Text>
            </View>
          ) : (
            <Text style={styles.resultPrice}>{formatPrice(regularPrice)}</Text>
          )}
        </View>
      </Pressable>
    );
  };

  const hasResults =
    activeTab === "restaurant"
      ? restaurantData.length > 0
      : foodData.length > 0;

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </Pressable>

          <View style={styles.searchWrap}>
            <Ionicons
              name="search"
              size={20}
              color="#94A3B8"
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search restaurants or food..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.trim().length > 0 ? (
              <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setActiveTab("restaurant")}
            style={[
              styles.toggleBtn,
              activeTab === "restaurant" && styles.toggleBtnActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                activeTab === "restaurant" && styles.toggleTextActive,
              ]}
            >
              Restaurants ({filteredRestaurants.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("food")}
            style={[
              styles.toggleBtn,
              activeTab === "food" && styles.toggleBtnActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                activeTab === "food" && styles.toggleTextActive,
              ]}
            >
              Food Items ({filteredFoods.length})
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerText}>Searching...</Text>
          </View>
        ) : hasResults ? (
          <FlatList
            data={activeTab === "restaurant" ? restaurantData : foodData}
            keyExtractor={(item, index) =>
              String(item?.id ?? item?.restaurant_id ?? `result-${index}`)
            }
            renderItem={
              activeTab === "restaurant" ? renderRestaurantItem : renderFoodItem
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <View style={styles.centerBox}>
            <Ionicons name="search-outline" size={34} color="#94A3B8" />
            <Text style={styles.centerTitle}>No results found</Text>
            <Text style={styles.centerText}>Try another keyword.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchWrap: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    paddingVertical: 8,
  },
  clearBtn: {
    marginLeft: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  toggleBtnActive: {
    borderColor: "#06C168",
    backgroundColor: "#F0FFF6",
  },
  toggleText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#06C168",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.86,
  },
  resultThumb: {
    width: 82,
    height: 82,
    backgroundColor: "#E2E8F0",
  },
  thumbFallback: {
    backgroundColor: "#E2E8F0",
  },
  resultBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  resultTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  resultSubtitle: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  resultPrice: {
    color: "#06C168",
    fontSize: 13,
    fontWeight: "800",
  },
  resultPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  resultOldPrice: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "line-through",
    textDecorationColor: "#DC2626",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  centerTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  centerText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
