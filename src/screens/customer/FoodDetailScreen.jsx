import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Alert, Dimensions, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/api";

/* ── Skeleton shimmer block ── */
function SkeletonBlock({ width: w, height: h, borderRadius: br = 12, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  return (
    <Animated.View
      style={[
        { width: w, height: h, borderRadius: br, backgroundColor: "#CBD5E1", opacity },
        style,
      ]}
    />
  );
}

function FoodDetailSkeleton({ onClose }) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* header */}
      <View style={styles.header}>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ gap: 8, flex: 1 }}>
              <SkeletonBlock width="75%" height={22} borderRadius={8} />
              <SkeletonBlock width="40%" height={14} borderRadius={6} />
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <SkeletonBlock width={90} height={22} borderRadius={8} />
              <SkeletonBlock width={60} height={10} borderRadius={4} />
            </View>
          </View>
          <SkeletonBlock width="90%" height={14} borderRadius={6} style={{ marginTop: 6 }} />
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
    </SafeAreaView>
  );
}

export default function FoodDetailScreen({ route, navigation }) {
  // react-router useParams -> RN route.params
  const { restaurantId, foodId } = route.params;

  const [restaurant, setRestaurant] = useState(null);
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSize, setSelectedSize] = useState("regular");
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    fetchFood();
  }, [restaurantId, foodId]);

  const fetchFood = async () => {
    try {
      setLoading(true);
      setError("");

      // Restaurant
      const restaurantRes = await fetch(`${API_BASE_URL}/public/restaurants/${restaurantId}`);
      const restaurantData = await restaurantRes.json().catch(() => ({}));
      if (!restaurantRes.ok) throw new Error(restaurantData.message || "Restaurant not found");
      setRestaurant(restaurantData.restaurant);

      // Food
      const foodRes = await fetch(
        `${API_BASE_URL}/public/restaurants/${restaurantId}/foods/${foodId}`
      );
      const foodData = await foodRes.json().catch(() => ({}));
      if (!foodRes.ok) throw new Error(foodData.message || "Food not found");

      setFood(foodData.food);
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
        ? food.extra_price
        : food.offer_price || food.regular_price || 0;
    return Number(base) || 0;
  }, [food, selectedSize]);

  const totalPrice = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);

  const addToCart = async ({ goToCheckout = false } = {}) => {
    try {
      const token = await AsyncStorage.getItem("token");
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

      if (goToCheckout) {
        // Get the cartId from the response and navigate to Checkout
        const cartId = data.cartId || data.cart_id || data.cart?.id;
        if (cartId) {
          navigation.navigate("Checkout", { cartId });
        } else {
          // If no cartId in response, go to Cart tab first
          navigation.navigate("MainTabs", { screen: "Cart" });
        }
        return;
      }

      Alert.alert("Success", "Item added to cart!");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return <FoodDetailSkeleton onClose={() => navigation.goBack()} />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.errTitle}>Oops!</Text>
          <Text style={styles.errText}>{error}</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!food) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Item Details</Text>
        <Pressable style={styles.headerBtn}>
          <Ionicons name="heart" size={22} color="#F43F5E" />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.page} 
        contentContainerStyle={{ paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={styles.heroWrap}>
          <View style={styles.heroContainer}>
            <Image
              source={{
                uri:
                  food.image_url ||
                  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=900&q=80",
              }}
              style={styles.heroImg}
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
          </View>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.productTop}>
            <View style={styles.productLeft}>
              <Text style={styles.productName}>{food.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#10b981" />
                <Text style={styles.ratingText}>4.9</Text>
                <Text style={styles.reviewText}>(120+ reviews)</Text>
              </View>
            </View>
            <View style={styles.productRight}>
              <Text style={styles.productPrice}>{formatPrice(unitPrice)}</Text>
              <Text style={styles.priceLabel}>BASE PRICE</Text>
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
            <Pressable
              onPress={() => setSelectedSize("regular")}
              style={[
                styles.sizeOption,
                selectedSize === "regular" && styles.sizeOptionActive,
              ]}
            >
              <Text style={[
                styles.sizeOptionName,
                selectedSize === "regular" && styles.sizeOptionNameActive,
              ]}>
                {food.regular_size || "Regular"}
              </Text>
              <Text style={[
                styles.sizePortionText,
                selectedSize === "regular" && styles.sizePortionTextActive,
              ]}>
                2 Portions
              </Text>
              <Text style={[
                styles.sizeOptionPrice,
                selectedSize === "regular" && styles.sizeOptionPriceActive,
              ]}>
                {food.offer_price ? formatPrice(food.offer_price) : formatPrice(food.regular_price)}
              </Text>
              {selectedSize === "regular" && (
                <View style={styles.sizeCheck}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                </View>
              )}
            </Pressable>

            {!!food.extra_price && (
              <Pressable
                onPress={() => setSelectedSize("large")}
                style={[
                  styles.sizeOption,
                  selectedSize === "large" && styles.sizeOptionActive,
                ]}
              >
                <Text style={[
                  styles.sizeOptionName,
                  selectedSize === "large" && styles.sizeOptionNameActive,
                ]}>
                  {food.extra_size || "Large"}
                </Text>
                <Text style={[
                  styles.sizePortionText,
                  selectedSize === "large" && styles.sizePortionTextActive,
                ]}>
                  3-4 Portions
                </Text>
                <Text style={[
                  styles.sizeOptionPrice,
                  selectedSize === "large" && styles.sizeOptionPriceActive,
                ]}>
                  {formatPrice(food.extra_price)}
                </Text>
                {selectedSize === "large" && (
                  <View style={styles.sizeCheck}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  </View>
                )}
              </Pressable>
            )}
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
      </ScrollView>

      {/* Bottom Actions - Fixed */}
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
              {addingToCart ? "Processing..." : "Buy Now"}
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
            <Ionicons name="cart" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.addToCartText}>
              {addingToCart ? "Adding..." : `Add to Cart • ${formatPrice(totalPrice)}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  page: { flex: 1, backgroundColor: "#fff" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, gap: 12 },
  muted: { color: "#64748B", fontSize: 14, fontWeight: "500" },

  // Hero Image
  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Product Info
  productInfo: {
    paddingHorizontal: 20,
    paddingTop: 24,
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
    color: "#10b981",
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
    color: "#10b981",
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    marginTop: 2,
  },
  productDesc: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "400",
  },

  // Size Selection
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 2,
  },
  sizeContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  sizeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#F1F5F9",
    backgroundColor: "#fff",
  },
  sizeOptionActive: {
    borderColor: "#10b981",
    backgroundColor: "#ECFDF5",
    shadowColor: "#10b981",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sizeOptionName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  sizeOptionNameActive: {
    color: "#059669",
    fontWeight: "800",
  },
  sizeOptionPrice: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  sizeOptionPriceActive: {
    color: "#059669",
    fontWeight: "800",
  },
  sizePortionText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: -2,
  },
  sizePortionTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
  sizeCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // Quantity
  quantityContainer: {
    paddingHorizontal: 20,
    marginTop: 32,
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
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
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
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
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
    backgroundColor: "#10b981", 
    alignItems: "center", 
    justifyContent: "center", 
    marginTop: 12,
    paddingHorizontal: 32,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});