import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OptimizedImage from "../../components/common/OptimizedImage";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import StaggeredFadeInUp from "../../components/common/StaggeredFadeInUp";
import { API_BASE_URL } from "../../constants/api";
import { useLocationContext } from "../../context/LocationContext";
import useDebounce from "../../hooks/useDebounce";
import { getAccessToken } from "../../lib/authStorage";
import { prefetchImageUrls } from "../../lib/imageCache";
import { fetchJsonWithCache } from "../../lib/publicDataCache";
import { formatDistance } from "../../services/restaurantDistanceService";
import { calculateDistance } from "../../utils/locationUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;
const GREEN = "#06C168";
const SEARCH_DEBOUNCE_MS = 300;

/** Convert "14:00" or "14:00:00" to "2:00 PM" */
const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

const formatPrice = (price) =>
  price ? `Rs. ${parseFloat(price).toFixed(2)}` : "N/A";

function normalizeFoodsPayload(payload) {
  if (Array.isArray(payload?.foods)) return payload.foods;
  if (Array.isArray(payload?.data?.foods)) return payload.data.foods;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.menu)) return payload.menu;
  return [];
}

function foodMatchesQuery(food, normalizedQuery) {
  if (!normalizedQuery) return true;

  const haystack = [
    food?.name,
    food?.description,
    food?.category,
    food?.restaurants?.restaurant_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export default function RestaurantFoodsScreen({ route, navigation }) {
  const { restaurantId } = route.params;
  const restaurantCacheKey = `public:restaurant:${restaurantId}`;
  const foodsCacheKey = `public:restaurant:${restaurantId}:foods`;

  // Restaurant & foods
  const [restaurant, setRestaurant] = useState(null);
  const [foods, setFoods] = useState([]);
  const [allFoodsCache, setAllFoodsCache] = useState([]);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [foodsError, setFoodsError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const searchAbortRef = useRef(null);
  const searchRequestIdRef = useRef(0);

  // Cart
  const [cartCount, setCartCount] = useState(0);
  const [addingToCart, setAddingToCart] = useState(null);

  // Distance
  const [restaurantDistance, setRestaurantDistance] = useState(null);
  let userLocation = null;
  try {
    const ctx = useLocationContext();
    userLocation = ctx?.currentLocation;
  } catch {
    // LocationProvider may not be present
  }

  // ─── Fetch restaurant ───
  useEffect(() => {
    fetchRestaurant();
    fetchCartCount();
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      setRestaurantLoading(true);
      setError(null);
      const data = await fetchJsonWithCache(
        restaurantCacheKey,
        async () => {
          const res = await fetch(
            `${API_BASE_URL}/public/restaurants/${restaurantId}`,
          );
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload.message || "Restaurant not found");
          }
          return payload;
        },
        { ttlMs: 180000 },
      );
      setRestaurant(data.restaurant);
      prefetchImageUrls([
        data?.restaurant?.cover_image_url,
        data?.restaurant?.logo_url,
      ]);
    } catch (err) {
      console.error("Error fetching restaurant:", err);
      setError(err.message);
    } finally {
      setRestaurantLoading(false);
    }
  };

  // ─── Fetch foods from API (supports abort) ───
  const fetchFoodsFromApi = useCallback(
    async (search = "", options = {}) => {
      const { signal } = options;

      try {
        setFoodsError(null);
        let url = `${API_BASE_URL}/public/restaurants/${restaurantId}/foods`;
        if (search) url += `?search=${encodeURIComponent(search)}`;
        const data = await fetchJsonWithCache(
          search
            ? `${foodsCacheKey}:search:${search.toLowerCase()}`
            : foodsCacheKey,
          async () => {
            const res = await fetch(url, { signal });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(payload.message || "Failed to fetch foods");
            }
            return payload;
          },
          { ttlMs: search ? 60000 : 180000 },
        );

        let parsedFoods = normalizeFoodsPayload(data);

        // Avoid stale empty cache on restaurant menu open: re-validate once from network.
        if (!search && parsedFoods.length === 0) {
          const freshData = await fetchJsonWithCache(
            foodsCacheKey,
            async () => {
              const res = await fetch(url, { signal });
              const payload = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(payload.message || "Failed to fetch foods");
              }
              return payload;
            },
            { ttlMs: 0, forceRefresh: true },
          );
          parsedFoods = normalizeFoodsPayload(freshData);
        }

        return parsedFoods;
      } catch (err) {
        if (err?.name === "AbortError") {
          throw err;
        }
        console.error("Error fetching foods:", err);
        setFoodsError(err.message);
        throw err;
      }
    },
    [restaurantId],
  );

  // Initial foods load for this restaurant
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadFoods = async () => {
      setFoodsLoading(true);

      try {
        const fetchedFoods = await fetchFoodsFromApi("", {
          signal: controller.signal,
        });

        if (!isMounted) return;
        setAllFoodsCache(fetchedFoods);
        setFoods(fetchedFoods);
        prefetchImageUrls(fetchedFoods.map((item) => item?.image_url));
      } catch (err) {
        if (err?.name !== "AbortError") {
          setAllFoodsCache([]);
          setFoods([]);
        }
      } finally {
        if (isMounted) {
          setFoodsLoading(false);
          setSearchLoading(false);
        }
      }
    };

    loadFoods();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [fetchFoodsFromApi]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const localFilteredFoods = useMemo(() => {
    if (!normalizedSearchQuery) return allFoodsCache;

    return allFoodsCache.filter((food) =>
      foodMatchesQuery(food, normalizedSearchQuery),
    );
  }, [allFoodsCache, normalizedSearchQuery]);

  // Instant local update on every keystroke
  useEffect(() => {
    if (!normalizedSearchQuery) {
      setFoods(allFoodsCache);
      setFoodsError(null);
      return;
    }

    setFoods(localFilteredFoods);
  }, [allFoodsCache, localFilteredFoods, normalizedSearchQuery]);

  // Debounced API sync with request cancellation
  useEffect(() => {
    const query = debouncedSearchQuery.trim();

    if (!query) {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
        searchAbortRef.current = null;
      }
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++searchRequestIdRef.current;

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    searchAbortRef.current = controller;
    setSearchLoading(true);

    fetchFoodsFromApi(query, { signal: controller.signal })
      .then((fetchedFoods) => {
        if (requestId !== searchRequestIdRef.current) return;
        setFoods(fetchedFoods);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Search request failed:", err);
        }
      })
      .finally(() => {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearchQuery, fetchFoodsFromApi]);

  const handleClearSearch = useCallback(() => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    // Invalidate older responses so stale results can't overwrite reset UI.
    searchRequestIdRef.current += 1;

    setSearchQuery("");
    setFoods(allFoodsCache);
    setSearchLoading(false);
    setFoodsError(null);
    Keyboard.dismiss();
  }, [allFoodsCache]);

  // ─── Cart count ───
  const fetchCartCount = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const total = (data.carts || []).reduce((sum, cart) => {
        const cartRestaurantId = String(
          cart?.restaurant_id || cart?.restaurant?.id || "",
        );
        if (cartRestaurantId !== String(restaurantId)) {
          return sum;
        }
        return (
          sum +
          (cart.items || []).reduce((s, item) => s + Number(item.quantity || 0), 0)
        );
      }, 0);
      setCartCount(total);
    } catch (err) {
      console.error("Fetch cart error:", err);
    }
  };

  // ─── Distance ───
  useEffect(() => {
    if (userLocation && restaurant?.latitude && restaurant?.longitude) {
      const dist = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        parseFloat(restaurant.latitude),
        parseFloat(restaurant.longitude),
      );
      setRestaurantDistance(dist);
    }
  }, [userLocation, restaurant]);

  // ─── Quick add to cart ───
  const quickAddToCart = async (food) => {
    const token = await getAccessToken();
    if (!token) {
      Alert.alert("Login required", "Please login to add items to cart");
      return;
    }
    const role = await AsyncStorage.getItem("role");
    if (role !== "customer") {
      Alert.alert("Error", "Only customers can add items to cart");
      return;
    }
    if (restaurant?.is_open === false) {
      Alert.alert(
        "Closed",
        `${restaurant?.restaurant_name || "This restaurant"} is currently closed`,
      );
      return;
    }
    try {
      setAddingToCart(food.id);
      const res = await fetch(`${API_BASE_URL}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          food_id: food.id,
          size: "regular",
          quantity: 1,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to add");
      DeviceEventEmitter.emit("cart:changed");
      fetchCartCount();
    } catch (err) {
      console.error("Add to cart error:", err);
      Alert.alert("Error", err.message);
    } finally {
      setAddingToCart(null);
    }
  };

  const handleFoodPress = (food) => {
    navigation.navigate("FoodDetail", {
      restaurantId,
      foodId: food.id,
    });
  };

  const openRestaurantCart = useCallback(() => {
    navigation.navigate("MainTabs", {
      screen: "Cart",
      params: {
        screen: "CartMain",
        params: {
          restaurantId,
          menuCartTs: Date.now(),
        },
      },
    });
  }, [navigation, restaurantId]);

  // ─── Food card renderer ───
  const renderFoodCard = useCallback(
    ({ item, index }) => (
      <StaggeredFadeInUp delay={index * 14}>
        <Pressable
          onPressIn={() => {
            navigation.preload?.("FoodDetail", {
              restaurantId,
              foodId: item.id,
            });
          }}
          onPress={() => handleFoodPress(item)}
          style={({ pressed }) => [
            styles.foodCard,
            pressed && { opacity: 0.94 },
          ]}
        >
          {/* Image */}
          <View style={styles.foodImageWrap}>
            {item.image_url ? (
              <OptimizedImage
                uri={item.image_url}
                style={styles.foodImage}
                transition={110}
                cloudinaryPreset="card"
              />
            ) : (
              <LinearGradient
                colors={[GREEN, "#06C168"]}
                style={[styles.foodImage, styles.foodImagePlaceholder]}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={32}
                  color="rgba(255,255,255,0.6)"
                />
              </LinearGradient>
            )}

            {/* Rating badge */}
            {item.stars > 0 && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={11} color="#FBBF24" />
                <Text style={styles.ratingText}>{item.stars}</Text>
              </View>
            )}

            {/* Unavailable overlay */}
            {!item.is_available && item.is_available !== undefined && (
              <View style={styles.unavailableOverlay}>
                <View style={styles.unavailablePill}>
                  <Text style={styles.unavailableText}>Unavailable</Text>
                </View>
              </View>
            )}

            {/* Quick add button */}
            {item.is_available !== false && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  quickAddToCart(item);
                }}
                disabled={addingToCart === item.id}
                style={({ pressed }) => [
                  styles.addBtn,
                  pressed && { transform: [{ scale: 0.9 }] },
                ]}
              >
                {addingToCart === item.id ? (
                  <ActivityIndicator size={14} color="#fff" />
                ) : (
                  <Ionicons name="add" size={20} color="#fff" />
                )}
              </Pressable>
            )}
          </View>

          {/* Info */}
          <View style={styles.foodInfo}>
            <Text style={styles.foodName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.foodDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            {/* Price + prep time (same treatment as Home food cards) */}
            <View style={styles.priceRow}>
              <View>
                {item.offer_price ? (
                  <View style={styles.priceGroup}>
                    <Text style={styles.foodPrice}>
                      {formatPrice(item.offer_price)}
                    </Text>
                    <Text style={styles.oldPrice}>
                      {formatPrice(item.regular_price)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.foodPrice}>
                    {formatPrice(item.regular_price || item.price)}
                  </Text>
                )}
              </View>
              <Text style={styles.foodTime}>
                {item.prep_time ? `Prep ${item.prep_time}` : ""}
              </Text>
            </View>
          </View>
        </Pressable>
      </StaggeredFadeInUp>
    ),
    [restaurantId, addingToCart, navigation],
  );

  // ─── Loading / Error states ───
  if (restaurantLoading) {
    const halfW = (Dimensions.get("window").width - 48) / 2;
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Cover image placeholder */}
        <SkeletonBlock width="100%" height={200} borderRadius={0} />
        {/* Restaurant info card skeleton */}
        <View style={{ padding: 16, gap: 14 }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              gap: 12,
            }}
          >
            <SkeletonBlock width={56} height={56} borderRadius={28} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBlock width="65%" height={18} borderRadius={6} />
              <SkeletonBlock width="90%" height={12} borderRadius={6} />
              <SkeletonBlock width="50%" height={12} borderRadius={6} />
            </View>
          </View>
          {/* Search bar skeleton */}
          <SkeletonBlock width="100%" height={44} borderRadius={12} />
          {/* Category pills skeleton */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[80, 65, 90, 55].map((w, i) => (
              <SkeletonBlock key={i} width={w} height={32} borderRadius={16} />
            ))}
          </View>
          {/* Food grid skeleton */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: halfW, gap: 8 }}>
                <SkeletonBlock width={halfW} height={120} borderRadius={14} />
                <SkeletonBlock width="75%" height={14} borderRadius={6} />
                <SkeletonBlock width="50%" height={12} borderRadius={6} />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorWrap}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.errorBtn}
          >
            <Text style={styles.errorBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main screen ───
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Sticky Header ── */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerSearchWrap}>
            <Ionicons
              name="search-outline"
              size={17}
              color="#9CA3AF"
              style={styles.headerSearchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search menu items..."
              placeholderTextColor="#9CA3AF"
              style={styles.headerSearchInput}
            />
            <View style={styles.headerSearchRightSlot}>
              {searchLoading && (
                <ActivityIndicator
                  size="small"
                  color={GREEN}
                  style={{ marginRight: 4 }}
                />
              )}
              {searchQuery.length > 0 && (
                <Pressable onPress={handleClearSearch} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Cart CTA */}
        <Pressable onPress={openRestaurantCart} style={styles.cartBtn}>
          <Ionicons name="cart" size={18} color="#fff" />
          <Text style={styles.cartBtnLabel}>
            Cart{cartCount > 0 ? ` (${cartCount > 99 ? "99+" : cartCount})` : ""}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={foodsLoading ? [] : foods}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        updateCellsBatchingPeriod={20}
        windowSize={7}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={renderFoodCard}
        ListHeaderComponent={
          <>
            {/* ── Cover Image ── */}
            <View style={styles.coverWrap}>
              {restaurant?.cover_image_url || restaurant?.logo_url ? (
                <OptimizedImage
                  uri={restaurant.cover_image_url || restaurant.logo_url}
                  style={styles.coverImage}
                  transition={120}
                  cloudinaryPreset="hero"
                />
              ) : (
                <LinearGradient
                  colors={[GREEN, "#06C168"]}
                  style={styles.coverImage}
                />
              )}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.5)"]}
                style={styles.coverGradient}
              />
            </View>

            {/* ── Restaurant Info Card ── */}
            <View style={styles.restaurantCard}>
              <View style={styles.restaurantRow}>
                {/* Logo */}
                <View style={styles.logoOuter}>
                  {restaurant?.logo_url ? (
                    <OptimizedImage
                      uri={restaurant.logo_url}
                      style={styles.restaurantLogo}
                      transition={100}
                      cloudinaryPreset="thumbnail"
                    />
                  ) : (
                    <LinearGradient
                      colors={[GREEN, "#06C168"]}
                      style={[styles.restaurantLogo, styles.logoPlaceholder]}
                    >
                      <Text style={styles.logoLetter}>
                        {restaurant?.restaurant_name?.charAt(0) || "R"}
                      </Text>
                    </LinearGradient>
                  )}
                </View>

                {/* Details */}
                <View style={styles.restaurantInfo}>
                  <View style={styles.nameRatingRow}>
                    <Text style={styles.restaurantName} numberOfLines={1}>
                      {restaurant?.restaurant_name || "Restaurant"}
                    </Text>
                    {restaurant?.rating ? (
                      <View style={styles.ratingPill}>
                        <Text style={styles.ratingPillText}>
                          {restaurant.rating}
                        </Text>
                        <Ionicons name="star" size={12} color="#fff" />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    {restaurantDistance != null && (
                      <View style={styles.metaItem}>
                        <Ionicons name="location" size={13} color={GREEN} />
                        <Text
                          style={[
                            styles.metaText,
                            { color: GREEN, fontWeight: "700" },
                          ]}
                        >
                          {formatDistance(restaurantDistance)} away
                        </Text>
                      </View>
                    )}
                    {restaurant?.city && (
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="location-outline"
                          size={13}
                          color="#6B7280"
                        />
                        <Text style={styles.metaText}>{restaurant.city}</Text>
                      </View>
                    )}
                    {restaurant?.opening_time && restaurant?.close_time && (
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color="#6B7280"
                        />
                        <Text style={styles.metaText}>
                          {formatTime(restaurant.opening_time)} -{" "}
                          {formatTime(restaurant.close_time)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {restaurant?.address && (
                    <Text style={styles.addressText} numberOfLines={1}>
                      {restaurant.address}
                    </Text>
                  )}
                </View>
              </View>

              {/* Closed banner */}
              {restaurant?.is_open === false && (
                <View style={styles.closedBanner}>
                  <View style={styles.closedIcon}>
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#DC2626"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.closedTitle}>
                      Restaurant is currently closed
                    </Text>
                    <Text style={styles.closedSub}>
                      {restaurant.opening_time && restaurant.close_time
                        ? `Open hours: ${formatTime(restaurant.opening_time)} - ${formatTime(restaurant.close_time)}`
                        : "Check back later"}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── Menu heading ── */}
            <View style={styles.menuRow}>
              <Text style={styles.menuHeading}>Menu</Text>
              {searchQuery ? (
                <Text style={styles.menuCount}>
                  • {foods.length} result{foods.length !== 1 ? "s" : ""}
                </Text>
              ) : null}
            </View>

            {/* Foods loading */}
            {foodsLoading && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 16,
                  paddingHorizontal: 4,
                  paddingTop: 8,
                }}
              >
                {[1, 2, 3, 4].map((i) => {
                  const halfW = (Dimensions.get("window").width - 48) / 2;
                  return (
                    <View key={i} style={{ width: halfW, gap: 8 }}>
                      <SkeletonBlock
                        width={halfW}
                        height={120}
                        borderRadius={14}
                      />
                      <SkeletonBlock width="75%" height={14} borderRadius={6} />
                      <SkeletonBlock width="50%" height={12} borderRadius={6} />
                    </View>
                  );
                })}
              </View>
            )}

            {/* Foods error */}
            {foodsError && !foodsLoading && (
              <View style={styles.foodsErrorBox}>
                <Text style={styles.foodsErrorTitle}>Failed to load menu</Text>
                <Text style={styles.foodsErrorMsg}>{foodsError}</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !foodsLoading && !foodsError ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="fast-food-outline" size={40} color={GREEN} />
              </View>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "Try a different search term"
                  : "This restaurant hasn't added menu items yet"}
              </Text>
            </View>
          ) : null
        }
      />

      {/* ── Floating cart button ── */}
      {cartCount > 0 && (
        <Pressable
          onPress={openRestaurantCart}
          style={({ pressed }) => [
            styles.floatingCart,
            pressed && { opacity: 0.95, transform: [{ scale: 0.985 }] },
          ]}
        >
          <LinearGradient
            colors={["#06C168", "#059B56"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.floatingCartGradient}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.floatingCartIconCircle}>
                <Ionicons name="cart" size={19} color="#fff" />
              </View>
              <View>
                <Text style={styles.floatingCartTitle}>View cart</Text>
                <Text style={styles.floatingCartSubtext}>
                  {cartCount} item{cartCount !== 1 ? "s" : ""} from this restaurant
                </Text>
              </View>
            </View>
            <View style={styles.floatingCartArrowWrap}>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </LinearGradient>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    gap: 12,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
  },

  /* ── Error ── */
  errorWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  errorMsg: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  errorBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: GREEN,
  },
  errorBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  /* ── Top bar ── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerSearchWrap: {
    position: "relative",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingLeft: 34,
    paddingRight: 10,
    height: 40,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerSearchIcon: {
    position: "absolute",
    left: 12,
    top: 11,
  },
  headerSearchInput: {
    width: "100%",
    color: "#111827",
    fontSize: 13,
    paddingRight: 56,
  },
  headerSearchRightSlot: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  cartBtn: {
    height: 42,
    borderRadius: 14,
    backgroundColor: "#06B060",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: GREEN,
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cartBtnLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  /* ── Cover image ── */
  coverWrap: {
    height: 180,
    marginBottom: -60,
  },
  coverImage: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  /* ── Restaurant card ── */
  restaurantCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 0,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logoOuter: {
    marginRight: 14,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  restaurantLogo: {
    width: 68,
    height: 68,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
  },
  restaurantInfo: {
    flex: 1,
  },
  nameRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#06C168",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  addressText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  /* Closed banner */
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
  },
  closedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  closedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  closedSub: {
    fontSize: 11,
    color: "#EF4444",
    marginTop: 1,
  },

  clearBtn: {
    padding: 4,
  },

  /* ── Menu heading ── */
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  menuHeading: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  menuCount: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  /* ── Foods loading / error ── */
  foodsLoadingWrap: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  foodsErrorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  foodsErrorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
  foodsErrorMsg: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },

  /* ── Food grid ── */
  listContent: {
    padding: CARD_PADDING,
    paddingBottom: 112,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: CARD_GAP,
  },
  foodCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  foodImageWrap: {
    position: "relative",
  },
  foodImage: {
    width: "100%",
    height: CARD_WIDTH * 0.75,
  },
  foodImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  /* Rating badge on image */
  ratingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111827",
  },

  /* Unavailable */
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  unavailablePill: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  unavailableText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  addBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  foodInfo: {
    padding: 10,
  },
  foodName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  foodDesc: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 15,
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  tag: {
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10,
    color: GREEN,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  priceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  foodPrice: {
    fontSize: 14,
    fontWeight: "900",
    color: GREEN,
  },
  oldPrice: {
    fontSize: 11,
    color: "#DC2626",
    textDecorationLine: "line-through",
    textDecorationColor: "#DC2626",
  },
  foodTime: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },

  /* ── Empty ── */
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E6F9EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    maxWidth: 260,
  },

  /* ── Floating cart ── */
  floatingCart: {
    position: "absolute",
    bottom: 18,
    left: 16,
    right: 16,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: GREEN,
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  floatingCartGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  floatingCartLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  floatingCartIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },
  floatingCartTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  floatingCartSubtext: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontWeight: "600",
  },
  floatingCartArrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
});
