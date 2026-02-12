import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";

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
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.muted}>Loading delicious details...</Text>
        </View>
      </SafeAreaView>
    );
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
      {/* Back Button */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{food.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Hero */}
        <View style={styles.card}>
        <View style={styles.hero}>
          <Image
            source={{
              uri:
                food.image_url ||
                "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=900&q=80",
            }}
            style={styles.heroImg}
          />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{restaurant?.restaurant_name || "Restaurant"}</Text>
          </View>
        </View>

        <View style={{ padding: 14 }}>
          <Text style={styles.title}>{food.name}</Text>
          {!!food.description && <Text style={styles.desc}>{food.description}</Text>}
        </View>
      </View>

      {/* Size */}
      <View style={styles.cardPad}>
        <Text style={styles.h3}>Choose Size</Text>

        <Pressable
          onPress={() => setSelectedSize("regular")}
          style={[styles.sizeRow, selectedSize === "regular" && styles.sizeActive]}
        >
          <Text style={styles.sizeName}>{food.regular_size || "Regular"}</Text>
          <Text style={styles.price}>
            {food.offer_price ? formatPrice(food.offer_price) : formatPrice(food.regular_price)}
          </Text>
        </Pressable>

        {!!food.extra_price && (
          <Pressable
            onPress={() => setSelectedSize("large")}
            style={[styles.sizeRow, selectedSize === "large" && styles.sizeActive]}
          >
            <Text style={styles.sizeName}>{food.extra_size || "Large"}</Text>
            <Text style={styles.price}>{formatPrice(food.extra_price)}</Text>
          </Pressable>
        )}
      </View>

      {/* Qty */}
      <View style={styles.cardPad}>
        <Text style={styles.h3}>Quantity</Text>

        <View style={styles.qtyRow}>
          <Pressable onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.qtyBtn}>
            <Text style={styles.qtyBtnText}>−</Text>
          </Pressable>

          <Text style={styles.qtyValue}>{quantity}</Text>

          <Pressable onPress={() => setQuantity(quantity + 1)} style={[styles.qtyBtn, styles.qtyPlus]}>
            <Text style={[styles.qtyBtnText, { color: "#fff" }]}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Total + Actions */}
      <View style={styles.cardPad}>
        <View style={styles.totalRow}>
          <Text style={styles.muted}>Total</Text>
          <Text style={styles.total}>{formatPrice(totalPrice)}</Text>
        </View>

        <Pressable
          disabled={addingToCart}
          onPress={() => addToCart()}
          style={[styles.primaryBtn, addingToCart && { opacity: 0.7 }]}
        >
          <Text style={styles.primaryText}>{addingToCart ? "Adding..." : "Add to Cart"}</Text>
        </Pressable>

        <Pressable
          disabled={addingToCart}
          onPress={() => addToCart({ goToCheckout: true })}
          style={[styles.outlineBtn, addingToCart && { opacity: 0.7 }]}
        >
          <Text style={styles.outlineText}>{addingToCart ? "Processing..." : "Buy Now"}</Text>
        </Pressable>
      </View>

        {/* Bottom tab navigation web la BottomNavbar; RN la ithu CustomerTabs bottom navigator la irukkum */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  page: { flex: 1, backgroundColor: "#F9FAFB", padding: 12 },

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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 20, color: "#111827" },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#111827", flex: 1, textAlign: "center" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, gap: 10 },
  muted: { color: "#6B7280" },

  card: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", marginBottom: 12, elevation: 2 },
  cardPad: { backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 12, elevation: 2 },

  hero: { height: 220, backgroundColor: "#D1FAE5" },
  heroImg: { width: "100%", height: "100%" },
  heroBadge: { position: "absolute", left: 12, bottom: 12, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  heroBadgeText: { color: "#10b981", fontWeight: "900" },

  title: { fontSize: 22, fontWeight: "900", color: "#111827" },
  desc: { marginTop: 6, color: "#6B7280" },

  h3: { fontWeight: "900", color: "#111827", marginBottom: 10 },

  sizeRow: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 14, backgroundColor: "#F3F4F6", marginTop: 8 },
  sizeActive: { borderWidth: 2, borderColor: "#10b981", backgroundColor: "#ECFDF5" },
  sizeName: { fontWeight: "800", color: "#111827" },
  price: { fontWeight: "900", color: "#10b981" },

  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  qtyBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  qtyPlus: { backgroundColor: "#10b981" },
  qtyBtnText: { fontSize: 22, fontWeight: "900", color: "#111827" },
  qtyValue: { fontSize: 22, fontWeight: "900", color: "#10b981", minWidth: 50, textAlign: "center" },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  total: { fontSize: 22, fontWeight: "900", color: "#10b981" },

  primaryBtn: { height: 52, borderRadius: 14, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  outlineBtn: { height: 52, borderRadius: 14, borderWidth: 2, borderColor: "#10b981", alignItems: "center", justifyContent: "center", marginTop: 10 },
  outlineText: { color: "#10b981", fontWeight: "900", fontSize: 16 },

  errTitle: { fontSize: 22, fontWeight: "900", color: "#111827" },
  errText: { color: "#DC2626", textAlign: "center" },
});