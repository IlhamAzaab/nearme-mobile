import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OptimizedImage from "../../components/common/OptimizedImage";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import { prefetchImageUrls } from "../../lib/imageCache";
import { fetchJsonWithCache, getCachedJson } from "../../lib/publicDataCache";

function FoodDetailSkeleton({ onClose, insets }) {
  return (
    <View style={styles.container}>
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#0F172A" />
        </Pressable>
        <SkeletonBlock width={100} height={16} borderRadius={8} />
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <View style={styles.heroWrap}>
          <SkeletonBlock width="100%" height={260} borderRadius={16} />
        </View>
        {/* title + price */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 10 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <View style={{ gap: 8, flex: 1 }}>
              <SkeletonBlock width="75%" height={22} borderRadius={8} />
              <SkeletonBlock width="40%" height={14} borderRadius={6} />
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <SkeletonBlock width={90} height={22} borderRadius={8} />
              <SkeletonBlock width={60} height={10} borderRadius={4} />
            </View>
          </View>
          <SkeletonBlock
            width="90%"
            height={14}
            borderRadius={6}
            style={{ marginTop: 6 }}
          />
        </View>
        {/* sizes */}
        <View style={{ paddingHorizontal: 20, marginTop: 32, gap: 14 }}>
          <SkeletonBlock width={100} height={12} borderRadius={6} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <SkeletonBlock width="48%" height={64} borderRadius={16} />
            <SkeletonBlock width="48%" height={64} borderRadius={16} />
          </View>
        </View>
        {/* qty */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <SkeletonBlock width="100%" height={56} borderRadius={16} />
        </View>
      </ScrollView>
      {/* bottom */}
      <View style={[styles.bottomActions, { gap: 14 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <SkeletonBlock width={80} height={14} borderRadius={6} />
          <SkeletonBlock width={100} height={22} borderRadius={8} />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <SkeletonBlock width="30%" height={52} borderRadius={999} />
          <SkeletonBlock width="65%" height={52} borderRadius={999} />
        </View>
      </View>
    </View>
  );
}

export default function FoodDetailScreen({ route, navigation }) {
  // react-router useParams -> RN route.params
  const { restaurantId, foodId } = route.params;
  const insets = useSafeAreaInsets();
  const restaurantCacheKey = `public:restaurant:${restaurantId}`;
  const foodCacheKey = `public:restaurant:${restaurantId}:food:${foodId}`;
  const cachedRestaurantData = getCachedJson(restaurantCacheKey, 180000);
  const cachedFoodData = getCachedJson(foodCacheKey, 180000);

  const [restaurant, setRestaurant] = useState(
    () => cachedRestaurantData?.restaurant || null,
  );
  const [food, setFood] = useState(() => cachedFoodData?.food || null);
  const [loading, setLoading] = useState(
    () => !(cachedRestaurantData?.restaurant && cachedFoodData?.food),
  );
  const [error, setError] = useState("");

  const [selectedSize, setSelectedSize] = useState("regular");
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    fetchFood();
  }, [restaurantId, foodId]);

  const fetchFood = async () => {
    try {
      const shouldShowLoading = !(restaurant && food);
      if (shouldShowLoading) {
        setLoading(true);
      }
      setError("");

      // Restaurant
      const restaurantData = await fetchJsonWithCache(
        restaurantCacheKey,
        async () => {
          const restaurantRes = await fetch(
            `${API_BASE_URL}/public/restaurants/${restaurantId}`,
          );
          const payload = await restaurantRes.json().catch(() => ({}));
          if (!restaurantRes.ok) {
            throw new Error(payload.message || "Restaurant not found");
          }
          return payload;
        },
        { ttlMs: 180000 },
      );
      setRestaurant(restaurantData.restaurant);

      // Food
      const foodData = await fetchJsonWithCache(
        foodCacheKey,
        async () => {
          const foodRes = await fetch(
            `${API_BASE_URL}/public/restaurants/${restaurantId}/foods/${foodId}`,
          );
          const payload = await foodRes.json().catch(() => ({}));
          if (!foodRes.ok) {
            throw new Error(payload.message || "Food not found");
          }
          return payload;
        },
        { ttlMs: 180000 },
      );

      setFood(foodData.food);
      prefetchImageUrls([
        restaurantData?.restaurant?.logo_url,
        restaurantData?.restaurant?.cover_image_url,
        foodData?.food?.image_url,
      ]);
      setSelectedSize(foodData.food?.extra_price ? "regular" : "regular");
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return "N/A";
    const n = Number(price);
    if (Number.isNaN(n)) return "N/A";
    return `Rs. ${n.toFixed(2)}`;
  };

  const unitPrice = useMemo(() => {
    if (!food) return 0;
    const base =
      selectedSize === "large" && food.extra_price
        ? food.extra_offer_price || food.extra_price
        : food.offer_price || food.regular_price || 0;
    return Number(base) || 0;
  }, [food, selectedSize]);

  const totalPrice = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);

  const sizeOptions = useMemo(() => {
    if (!food) return [];

    const options = [
      {
        key: "regular",
        label: food.regular_size || "Regular",
        portion: food.regular_portion,
        currentPrice: food.offer_price || food.regular_price,
        oldPrice: food.offer_price ? food.regular_price : null,
      },
    ];

    if (food.extra_price) {
      options.push({
        key: "large",
        label: food.extra_size || "Large",
        portion: food.extra_portion,
        currentPrice: food.extra_offer_price || food.extra_price,
        oldPrice: food.extra_offer_price ? food.extra_price : null,
      });
    }

    return options;
  }, [food]);

  const addToCart = async ({ goToCheckout = false } = {}) => {
    try {
      const token = await getAccessToken();
      const role = await AsyncStorage.getItem("role");

      if (!token || token === "null" || token === "undefined") {
        Alert.alert("Login required", "Please login to add items to cart", [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Login", onPress: () => navigation.navigate("Login") },
        ]);
        return;
      }

      if (role !== "customer") {
        Alert.alert("Not allowed", "Only customers can add items to cart");
        return;
      }

      setAddingToCart(true);

      const res = await fetch(`${API_BASE_URL}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          food_id: foodId,
          size: selectedSize,
          quantity,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to add to cart");

      DeviceEventEmitter.emit("cart:changed");

      if (goToCheckout) {
        // Navigate to Cart and auto-select this restaurant's cart
        const cartId = data.cartId || data.cart_id || data.cart?.id;
        navigation.navigate("MainTabs", {
          screen: "Cart",
          params: {
            screen: "CartMain",
            params: {
              buyNowCartId: cartId || undefined,
              buyNowRestaurantId: restaurantId,
              buyNowTs: Date.now(),
            },
          },
        });
        return;
      }

      navigation.replace("RestaurantFoods", {
        restaurantId,
      });
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <FoodDetailSkeleton onClose={() => navigation.goBack()} insets={insets} />
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={styles.errTitle}>Oops!</Text>
          <Text style={styles.errText}>{error}</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!food) return null;

  return (
    <View style={styles.container}>
      {/* Blur Header - overlapping the image */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Item Details</Text>
        <Pressable style={styles.headerBtn}>
          <Ionicons name="share-social" size={18} color="#0F172A" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.page}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={styles.heroWrap}>
          <View style={styles.heroContainer}>
            <OptimizedImage
              uri={
                food.image_url ||
                "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=900&q=80"
              }
              style={styles.heroImg}
              transition={120}
            />
            {/* Restaurant Badge */}
            <View style={styles.restaurantBadge}>
              <View style={styles.restaurantBadgeIcon}>
                <Ionicons name="restaurant" size={12} color="#fff" />
              </View>
              <Text style={styles.restaurantBadgeText}>
                {restaurant?.restaurant_name || "Restaurant"}
              </Text>
            </View>

            {/* Not Available Overlay */}
            {food.is_available === false && (
              <View style={styles.unavailOverlay}>
                <View style={styles.unavailBadge}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.unavailBadgeText}>
                    Currently Not Available
                  </Text>
                </View>
                {food.available_time?.length > 0 && (
                  <Text style={styles.unavailSubText}>
                    Available during: {food.available_time.join(", ")}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Unified details card */}
        <View style={styles.detailsCard}>
          {/* Product Info */}
          <View style={styles.productInfo}>
            <View style={styles.productTop}>
              <View style={styles.productLeft}>
                <Text style={styles.productName}>{food.name}</Text>
              </View>
            </View>
            {!!food.description && (
              <Text style={styles.productDesc}>{food.description}</Text>
            )}
          </View>

          {/* Size Selection */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>SELECT SIZE</Text>
            <View style={styles.sizeContainer}>
              {sizeOptions.map((option) => {
                const isSelected = selectedSize === option.key;

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSelectedSize(option.key)}
                    style={[
                      styles.sizeOption,
                      isSelected && styles.sizeOptionActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.sizeSelectedBadge,
                        isSelected && styles.sizeSelectedBadgeActive,
                      ]}
                    >
                      <Ionicons
                        name={
                          isSelected ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={16}
                        color={isSelected ? "#06C168" : "#94A3B8"}
                      />
                    </View>

                    <View style={styles.sizeInfoWrap}>
                      <Text
                        style={[
                          styles.sizeOptionName,
                          isSelected && styles.sizeOptionNameActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {!!option.portion && (
                        <Text
                          style={[
                            styles.sizePortionText,
                            isSelected && styles.sizePortionTextActive,
                          ]}
                        >
                          Portion {option.portion}
                        </Text>
                      )}
                    </View>

                    <View style={styles.sizePriceWrap}>
                      <Text
                        style={[
                          styles.sizeOptionPrice,
                          isSelected && styles.sizeOptionPriceActive,
                        ]}
                      >
                        {formatPrice(option.currentPrice)}
                      </Text>
                      {!!option.oldPrice && (
                        <Text
                          style={[
                            styles.sizeOldPrice,
                            isSelected && styles.sizeOldPriceActive,
                          ]}
                        >
                          {formatPrice(option.oldPrice)}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quantity Stepper */}
          <View style={styles.quantityContainer}>
            <View style={styles.quantityInner}>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <View style={styles.quantityStepper}>
                <Pressable
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  style={styles.qtyBtnMinus}
                >
                  <Ionicons name="remove" size={20} color="#0F172A" />
                </Pressable>
                <Text style={styles.qtyValue}>
                  {String(quantity).padStart(2, "0")}
                </Text>
                <Pressable
                  onPress={() => setQuantity(quantity + 1)}
                  style={styles.qtyBtnPlus}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Actions in same unified view */}
          <View style={styles.bottomActions}>
            <View style={styles.btnRow}>
              <Pressable
                disabled={addingToCart}
                onPress={() => addToCart({ goToCheckout: true })}
                style={({ pressed }) => [
                  styles.buyNowBtn,
                  pressed && { opacity: 0.8 },
                  addingToCart && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.buyNowText}>
                  {addingToCart ? "Buying..." : "Buy Now"}
                </Text>
              </Pressable>
              <Pressable
                disabled={addingToCart}
                onPress={() => addToCart()}
                style={({ pressed }) => [
                  styles.addToCartBtn,
                  pressed && { opacity: 0.8 },
                  addingToCart && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.addToCartText}>
                  {addingToCart
                    ? "Adding..."
                    : `Add to Cart • ${formatPrice(totalPrice)}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  page: { flex: 1, backgroundColor: "#fff" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  // Loading / Error
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 12,
  },
  muted: { color: "#64748B", fontSize: 14, fontWeight: "500" },

  // Hero Image
  heroWrap: {
    // Edge-to-edge hero — no padding
  },
  heroContainer: {
    width: "100%",
    height: 260,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  heroImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  restaurantBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  restaurantBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Not Available overlay
  unavailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  unavailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  unavailBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  unavailSubText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.9,
  },

  detailsCard: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  // Product Info
  productInfo: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  productTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productLeft: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#06C168",
  },
  reviewText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
    marginLeft: 4,
  },
  productRight: {
    alignItems: "flex-end",
  },
  productPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: "#06C168",
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    marginTop: 2,
  },
  productDesc: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "400",
  },

  // Size Selection
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 2,
  },
  sizeContainer: {
    gap: 10,
    marginTop: 12,
  },
  sizeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F1F5F9",
    backgroundColor: "#fff",
  },
  sizeOptionActive: {
    borderColor: "#06C168",
    backgroundColor: "#F2FCF6",
    shadowColor: "#06C168",
    shadowOpacity: 0.09,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sizeSelectedBadge: {
    minWidth: 34,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  sizeSelectedBadgeActive: {
    minWidth: 62,
  },
  sizeSelectedBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#06C168",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  sizeInfoWrap: {
    flex: 1,
  },
  sizeOptionName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  sizeOptionNameActive: {
    color: "#0B1324",
    fontWeight: "800",
  },
  sizeOptionPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  sizeOptionPriceActive: {
    color: "#0B1324",
    fontWeight: "800",
  },
  sizePriceWrap: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 12,
  },
  sizeOldPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    textDecorationLine: "line-through",
    marginTop: 3,
  },
  sizeOldPriceActive: {
    color: "#DC2626",
  },
  sizePortionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
  },
  sizePortionTextActive: {
    color: "#475569",
    fontWeight: "700",
  },

  // Quantity
  quantityContainer: {
    paddingHorizontal: 20,
    marginTop: 18,
  },
  quantityInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  quantityStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  qtyBtnMinus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  qtyBtnPlus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#06C168",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    minWidth: 30,
    textAlign: "center",
  },

  // Bottom Actions
  bottomActions: {
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
  },
  buyNowBtn: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  buyNowText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  addToCartBtn: {
    flex: 2,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#06C168",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#06C168",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addToCartText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // Error
  errTitle: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  errText: { color: "#DC2626", textAlign: "center" },
  primaryBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 32,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
