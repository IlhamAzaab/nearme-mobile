import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";

const ORANGE = "#FF7A00";
const GREEN = "#10B981";
const TEXT = "#111827";
const MUTED = "#6B7280";


export default function CartScreen({ navigation }) {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingItem, setUpdatingItem] = useState(null);
  const [selectedCartId, setSelectedCartId] = useState(null);

  const selectedCart = useMemo(
    () => carts.find((c) => c.id === selectedCartId) || null,
    [carts, selectedCartId]
  );

  const cartCount = useMemo(() => {
    return (carts || []).reduce((sum, cart) => {
      return sum + (cart.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
    }, 0);
  }, [carts]);

  useEffect(() => {
    fetchCarts();
  }, []);

  // Refetch when screen focuses
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchCarts();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await AsyncStorage.getItem("token");
      const role = await AsyncStorage.getItem("role");

      if (!token || token === "null" || token === "undefined") {
        setLoading(false);
        Alert.alert("Login required", "Please login to view your cart", [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Login", onPress: () => navigation.navigate("Login") },
        ]);
        return;
      }

      if (role !== "customer") {
        setLoading(false);
        Alert.alert("Not allowed", "Only customers can view cart");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || "Failed to fetch cart");

      setCarts(data.carts || []);
      setSelectedCartId((prev) =>
        data.carts && data.carts.some((c) => c.id === prev) ? prev : null
      );
    } catch (e) {
      setError(e.message || "Failed to fetch cart");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    const n = Number(price);
    if (Number.isNaN(n)) return "N/A";
    return `Rs. ${n.toFixed(2)}`;
  };

  const updateQuantity = async (itemId, newQty) => {
    if (newQty < 1) return;

    try {
      setUpdatingItem(itemId);
      const token = await AsyncStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/cart/item/${itemId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: newQty }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update quantity");

      await fetchCarts();
    } catch (e) {
      Alert.alert("Error", e.message || "Update failed");
    } finally {
      setUpdatingItem(null);
    }
  };

  const removeItem = async (itemId) => {
    Alert.alert("Remove item", "Remove this item from cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/cart/item/${itemId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to remove item");
            await fetchCarts();
          } catch (e) {
            Alert.alert("Error", e.message || "Remove failed");
          }
        },
      },
    ]);
  };

  const removeCart = async (cartId) => {
    Alert.alert("Clear cart", "Remove all items from this restaurant?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/cart/${cartId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to clear cart");
            setSelectedCartId((prev) => (prev === cartId ? null : prev));
            await fetchCarts();
          } catch (e) {
            Alert.alert("Error", e.message || "Clear failed");
          }
        },
      },
    ]);
  };

  const goCheckout = (cartId) => {
    navigation.navigate("Checkout", { cartId });
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader cartCount={cartCount} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.muted}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader cartCount={cartCount} />
        <View style={styles.center}>
          <Text style={styles.errTitle}>Oops!</Text>
          <Text style={styles.errText}>{error}</Text>
          <Pressable onPress={fetchCarts} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // EMPTY CART STATE
  // ============================================================================
  if (!carts?.length) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader cartCount={0} />
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🛒</Text>
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.muted}>Add items from restaurants</Text>
          <Pressable onPress={() => navigation.navigate("MainTabs", { screen: "Home" })} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Go to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // SELECTED CART DETAIL VIEW (Image 2)
  // ============================================================================
  if (selectedCart) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader cartCount={cartCount} />

        <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 95 }}>
          {/* Back Button */}
          <Pressable onPress={() => setSelectedCartId(null)} style={styles.backRow}>
            <Text style={styles.backText}>{"<"}</Text>
            <Text style={styles.backLabel}>Back to restaurants</Text>
          </Pressable>

          {/* Restaurant Header Card (Orange) */}
          <View style={styles.restaurantHeader}>
            <View style={styles.restaurantHeaderRow}>
              {selectedCart?.restaurant?.logo_url ? (
                <Image
                  source={{ uri: selectedCart.restaurant.logo_url }}
                  style={styles.restaurantLogo}
                />
              ) : (
                <View style={styles.restaurantLogoFallback}>
                  <Text style={styles.restaurantLogoText}>
                    {(selectedCart?.restaurant?.restaurant_name || "R").charAt(0)}
                  </Text>
                </View>
              )}

              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {selectedCart?.restaurant?.restaurant_name}
                </Text>
                <Text style={styles.restaurantMeta}>
                  {selectedCart?.restaurant?.city || ""} • {selectedCart?.item_count || 0} item
                </Text>
              </View>

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(selectedCart.cart_total)}</Text>
              </View>
            </View>
          </View>

          {/* Items List */}
          <View style={styles.itemsCard}>
            {(selectedCart.items || []).map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Image
                  source={{
                    uri:
                      item.food_image_url ||
                      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400",
                  }}
                  style={styles.itemImage}
                />

                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.food_name}
                  </Text>
                  <View style={styles.sizeTag}>
                    <Text style={styles.sizeTagText}>
                      {String(item.size || "Regular").charAt(0).toUpperCase() +
                        String(item.size || "Regular").slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatPrice(item.unit_price)}</Text>
                </View>

                {/* Quantity Controls */}
                <View style={styles.qtyContainer}>
                  <Pressable
                    onPress={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                    disabled={updatingItem === item.id || (item.quantity || 1) <= 1}
                    style={[styles.qtyBtn, (item.quantity || 1) <= 1 && styles.qtyBtnDisabled]}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </Pressable>

                  <Text style={styles.qtyValue}>{item.quantity}</Text>

                  <Pressable
                    onPress={() => updateQuantity(item.id, (item.quantity || 0) + 1)}
                    disabled={updatingItem === item.id}
                    style={[styles.qtyBtn, styles.qtyBtnPlus]}
                  >
                    <Text style={[styles.qtyBtnText, { color: "#fff" }]}>+</Text>
                  </Pressable>
                </View>

                {/* Delete Button */}
                <Pressable onPress={() => removeItem(item.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Cart Total Section */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalItemsText}>
                Total Items: {selectedCart?.item_count || selectedCart?.items?.length || 0}
              </Text>
              <View style={styles.totalRight}>
                <Text style={styles.cartTotalLabel}>Cart Total</Text>
                <Text style={styles.cartTotalValue}>{formatPrice(selectedCart.cart_total)}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              onPress={() =>
                navigation.navigate("RestaurantFoods", {
                  restaurantId: selectedCart.restaurant_id,
                })
              }
              style={styles.outlineBtn}
            >
              <Text style={styles.outlineBtnText}>Add More Items</Text>
            </Pressable>

            <Pressable onPress={() => goCheckout(selectedCart.id)} style={styles.checkoutBtn}>
              <Text style={styles.checkoutBtnText}>Checkout</Text>
              <Text style={styles.checkoutArrow}>{">"}</Text>
            </Pressable>
          </View>

          {/* Clear Cart Link */}
          <Pressable onPress={() => removeCart(selectedCart.id)} style={styles.clearCartLink}>
            <Text style={styles.clearCartText}>Clear this cart</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // ACTIVE RESTAURANTS LIST (Image 1)
  // ============================================================================
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <CartHeader cartCount={cartCount} />

      <View style={styles.page}>
        <Text style={styles.sectionTitle}>Active Restaurants</Text>

        <FlatList
          data={carts}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingBottom: 18 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <View style={styles.restaurantCard}>
              <View style={styles.restaurantCardRow}>
                {item?.restaurant?.logo_url ? (
                  <Image
                    source={{ uri: item.restaurant.logo_url }}
                    style={styles.restaurantCardLogo}
                  />
                ) : (
                  <View style={styles.restaurantCardLogoFallback}>
                    <Text style={styles.restaurantLogoText}>
                      {(item?.restaurant?.restaurant_name || "R").charAt(0)}
                    </Text>
                  </View>
                )}

                <View style={styles.restaurantCardInfo}>
                  <View style={styles.restaurantNameRow}>
                    <Text style={styles.restaurantCardName} numberOfLines={1}>
                      {item?.restaurant?.restaurant_name}
                    </Text>
                    <Text style={styles.verifiedBadge}>✓</Text>
                  </View>
                  <Text style={styles.restaurantCardCity}>
                    {item?.restaurant?.city || "Location"}
                  </Text>
                  <Text style={styles.restaurantCardMeta}>
                    {item?.item_count || 0} item • {formatPrice(item.cart_total)}
                  </Text>
                </View>
              </View>

              <View style={styles.restaurantCardActions}>
                <Pressable
                  onPress={() => setSelectedCartId(item.id)}
                  style={styles.viewItemsBtn}
                >
                  <Text style={styles.viewItemsBtnText}>View items</Text>
                </Pressable>

                <Pressable onPress={() => removeCart(item.id)} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// CART HEADER COMPONENT
// ============================================================================
function CartHeader({ cartCount }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLogoBox}>
        <Text style={styles.headerLogoText}>N</Text>
      </View>

      <View style={styles.headerTextBox}>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <Text style={styles.headerSubtitle}>Review your items and proceed to checkout</Text>
      </View>

      <View style={styles.headerCartIcon}>
        <Text style={styles.cartIconText}>🛒</Text>
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  page: {
    flex: 1,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 10,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerLogoBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  headerTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: TEXT,
  },
  headerSubtitle: {
    fontSize: 12,
    color: MUTED,
  },
  headerCartIcon: {
    position: "relative",
    padding: 8,
  },
  cartIconText: {
    fontSize: 24,
  },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: ORANGE,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT,
    marginVertical: 16,
  },

  // Error & Empty States
  muted: { color: MUTED },
  errTitle: { fontSize: 22, fontWeight: "900", color: TEXT },
  errText: { color: "#DC2626", textAlign: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: TEXT },

  // Primary Button
  primaryBtn: {
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // Restaurant Card (List View)
  restaurantCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  restaurantCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  restaurantCardLogo: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  restaurantCardLogoFallback: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  restaurantCardName: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  verifiedBadge: {
    marginLeft: 4,
    fontSize: 12,
    color: GREEN,
    fontWeight: "700",
  },
  restaurantCardCity: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
  restaurantCardMeta: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: "600",
    marginTop: 2,
  },
  restaurantCardActions: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  viewItemsBtn: {
    flex: 1,
    height: 42,
    backgroundColor: ORANGE,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  viewItemsBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  clearBtn: {
    paddingHorizontal: 24,
    height: 42,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: ORANGE,
    fontWeight: "700",
    fontSize: 14,
  },

  // Back Row
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  backText: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: "700",
    marginRight: 8,
  },
  backLabel: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: "600",
  },

  // Restaurant Header (Orange)
  restaurantHeader: {
    backgroundColor: ORANGE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  restaurantHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  restaurantLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#fff",
  },
  restaurantLogoFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  restaurantLogoText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
  },
  restaurantMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  totalBox: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
  },

  // Items Card
  itemsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  sizeTag: {
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  sizeTagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: ORANGE,
    marginTop: 4,
  },

  // Quantity Controls
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyBtnPlus: {
    backgroundColor: GREEN,
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
    minWidth: 30,
    textAlign: "center",
  },

  // Delete Button
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 18,
  },

  // Total Section
  totalSection: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalItemsText: {
    fontSize: 14,
    color: MUTED,
  },
  totalRight: {
    alignItems: "flex-end",
  },
  cartTotalLabel: {
    fontSize: 12,
    color: MUTED,
  },
  cartTotalValue: {
    fontSize: 22,
    fontWeight: "900",
    color: ORANGE,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  outlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    color: ORANGE,
    fontWeight: "700",
    fontSize: 14,
  },
  checkoutBtn: {
    flex: 1,
    height: 48,
    backgroundColor: ORANGE,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  checkoutBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  checkoutArrow: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  // Clear Cart Link
  clearCartLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  clearCartText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 14,
  },
});