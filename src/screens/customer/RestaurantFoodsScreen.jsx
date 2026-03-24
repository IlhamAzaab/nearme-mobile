import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";
import { useLocationContext } from "../../context/LocationContext";
import { formatDistance } from "../../services/restaurantDistanceService";
import { calculateDistance } from "../../utils/locationUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;
const GREEN = "#06C168";

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

export default function RestaurantFoodsScreen({ route, navigation }) {
  const { restaurantId } = route.params;

  // Restaurant & foods
  const [restaurant, setRestaurant] = useState(null);
  const [foods, setFoods] = useState([]);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [foodsError, setFoodsError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      const res = await fetch(
        `${API_BASE_URL}/public/restaurants/${restaurantId}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Restaurant not found");
      setRestaurant(data.restaurant);
      fetchFoods(searchQuery);
    } catch (err) {
      console.error("Error fetching restaurant:", err);
      setError(err.message);
    } finally {
      setRestaurantLoading(false);
    }
  };

  // ─── Fetch foods (with optional search) ───
  const fetchFoods = async (search = "") => {
    try {
      setFoodsLoading(true);
      setFoodsError(null);
      let url = `${API_BASE_URL}/public/restaurants/${restaurantId}/foods`;
      if (search) url += `?search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to fetch foods");
      setFoods(data.foods || []);
    } catch (err) {
      console.error("Error fetching foods:", err);
      setFoodsError(err.message);
    } finally {
      setFoodsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchFoods(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, restaurantId]);

  // ─── Cart count ───
  const fetchCartCount = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const total = (data.carts || []).reduce(
        (sum, cart) =>
          sum + (cart.items || []).reduce((s, item) => s + item.quantity, 0),
        0,
      );
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
    const token = await AsyncStorage.getItem("token");
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

  // ─── Food card renderer ───
  const renderFoodCard = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => handleFoodPress(item)}
        style={({ pressed }) => [styles.foodCard, pressed && { opacity: 0.94 }]}
      >
        {/* Image */}
        <View style={styles.foodImageWrap}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.foodImage} />
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

          {/* Available time tags */}
          {item.available_time?.length > 0 && (
            <View style={styles.tagsRow}>
              {item.available_time.map((time) => (
                <View style={styles.tag} key={time}>
                  <Text style={styles.tagText}>
                    {time.charAt(0).toUpperCase() + time.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Price + View Details */}
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
          </View>
        </View>
      </Pressable>
    ),
    [restaurantId, addingToCart],
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
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {restaurant?.restaurant_name || "Restaurant"}
          </Text>
          {restaurant?.city ? (
            <Text style={styles.topBarSub} numberOfLines={1}>
              {restaurant.city}
            </Text>
          ) : null}
        </View>

        {/* Cart icon */}
        <Pressable
          onPress={() =>
            navigation.navigate("MainTabs", {
              screen: "Cart",
              params: { screen: "CartMain" },
            })
          }
          style={styles.cartBtn}
        >
          <Ionicons name="cart-outline" size={22} color={GREEN} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartCount > 9 ? "9+" : cartCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <FlatList
        data={foodsLoading ? [] : foods}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={renderFoodCard}
        ListHeaderComponent={
          <>
            {/* ── Cover Image ── */}
            <View style={styles.coverWrap}>
              {restaurant?.cover_image_url || restaurant?.logo_url ? (
                <Image
                  source={{
                    uri: restaurant.cover_image_url || restaurant.logo_url,
                  }}
                  style={styles.coverImage}
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
                    <Image
                      source={{ uri: restaurant.logo_url }}
                      style={styles.restaurantLogo}
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

            {/* ── Search Bar ── */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={18}
                color="#9CA3AF"
                style={{ marginRight: 8 }}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search menu items..."
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
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
          onPress={() =>
            navigation.navigate("MainTabs", {
              screen: "Cart",
              params: { screen: "CartMain" },
            })
          }
          style={({ pressed }) => [
            styles.floatingCart,
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Ionicons name="cart" size={20} color="#fff" />
          <Text style={styles.floatingCartText}>
            {cartCount} item{cartCount !== 1 ? "s" : ""}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
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
  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  topBarSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  cartBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E6F9EE",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
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

  /* ── Search ── */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
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
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  viewDetails: {
    fontSize: 10,
    color: GREEN,
    fontWeight: "700",
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
    bottom: 20,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: GREEN,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  floatingCartText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
});
