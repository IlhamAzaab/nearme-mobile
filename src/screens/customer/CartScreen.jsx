import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { API_BASE_URL } from "../../constants/api";

/* ── Distance & delivery fee helpers ── */
async function calculateRouteDistance(lat1, lon1, lat2, lon2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.length) {
      const r = data.routes[0];
      return { success: true, distance: r.distance / 1000, duration: r.duration / 60 };
    }
    return { success: false };
  } catch { return { success: false }; }
}

function calculateDeliveryFee(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return null;
  if (distanceKm <= 1) return 50;
  if (distanceKm <= 2) return 80;
  if (distanceKm <= 2.5) return 87;
  const extraMeters = (distanceKm - 2.5) * 1000;
  const extra100mUnits = Math.ceil(extraMeters / 100);
  return 87 + extra100mUnits * 2.3;
}

const PRIMARY = "#10b981";
const TEXT_DARK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#F1F5F9";
const BG = "#F8FAFC";


export default function CartScreen({ navigation }) {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingItem, setUpdatingItem] = useState(null);
  const [selectedCartId, setSelectedCartId] = useState(null);
  const [deliveryInfo, setDeliveryInfo] = useState({ distanceKm: null, fee: null, loading: false });

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

  // Refetch when screen focuses: spinner on first visit, silent on subsequent
  const isFirstLoad = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        // Already fetched by the useEffect above
      } else {
        fetchCarts(false);
      }
    }, [])
  );

  const fetchCarts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
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

  // ── Calculate delivery distance when a cart is selected ──
  useEffect(() => {
    if (!selectedCart?.restaurant?.latitude || !selectedCart?.restaurant?.longitude) {
      setDeliveryInfo({ distanceKm: null, fee: null, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      setDeliveryInfo((p) => ({ ...p, loading: true }));
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setDeliveryInfo({ distanceKm: null, fee: null, loading: false });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const result = await calculateRouteDistance(
          loc.coords.latitude, loc.coords.longitude,
          parseFloat(selectedCart.restaurant.latitude),
          parseFloat(selectedCart.restaurant.longitude)
        );
        if (cancelled) return;
        if (result.success) {
          const fee = calculateDeliveryFee(result.distance);
          setDeliveryInfo({ distanceKm: result.distance, fee, loading: false });
        } else {
          setDeliveryInfo({ distanceKm: null, fee: null, loading: false });
        }
      } catch {
        if (!cancelled) setDeliveryInfo({ distanceKm: null, fee: null, loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCart?.id, selectedCart?.restaurant?.latitude, selectedCart?.restaurant?.longitude]);

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader cartCount={cartCount} onClose={() => navigation.navigate("MainTabs", { screen: "Home" })} />
        <View style={styles.center}>
          <View style={styles.loadingIcon}>
            <Ionicons name="cart" size={32} color={PRIMARY} />
          </View>
          <Text style={styles.loadingText}>Loading your cart...</Text>
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
        <CartHeader cartCount={cartCount} onClose={() => navigation.navigate("MainTabs", { screen: "Home" })} />
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={40} color="#EF4444" />
          </View>
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
        <CartHeader cartCount={0} onClose={() => navigation.navigate("MainTabs", { screen: "Home" })} />
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cart-outline" size={56} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>Add items from restaurants to get started</Text>
          <Pressable
            onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
            style={styles.primaryBtn}
          >
            <Ionicons name="home" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>Browse Restaurants</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // SELECTED CART DETAIL VIEW
  // ============================================================================
  if (selectedCart) {
    const itemCount = selectedCart?.item_count || selectedCart?.items?.length || 0;

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader cartCount={cartCount} onClose={() => navigation.navigate("MainTabs", { screen: "Home" })} />

        <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Back Link */}
          <Pressable onPress={() => setSelectedCartId(null)} style={styles.backRow}>
            <Ionicons name="arrow-back" size={16} color={PRIMARY} />
            <Text style={styles.backLabel}>Back to restaurants</Text>
          </Pressable>

          {/* Restaurant Summary Card (Green) */}
          <View style={styles.summaryCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryName} numberOfLines={1}>
                {selectedCart?.restaurant?.restaurant_name}
              </Text>
              <Text style={styles.summaryMeta}>
                {selectedCart?.restaurant?.city || "Restaurant"} • {itemCount} item{itemCount !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {/* Food Items */}
          <View style={styles.itemsList}>
            {(selectedCart.items || []).map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  idx < (selectedCart.items || []).length - 1 && styles.itemRowBorder,
                ]}
              >
                <Image
                  source={{
                    uri:
                      item.food_image_url ||
                      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400",
                  }}
                  style={styles.itemImage}
                />
                <View style={styles.itemDetails}>
                  <View style={styles.itemTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.food_name}</Text>
                      <View style={styles.sizeTag}>
                        <Text style={styles.sizeTagText}>
                          {String(item.size || "Regular").charAt(0).toUpperCase() +
                            String(item.size || "Regular").slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemPrice}>{formatPrice(item.unit_price)}</Text>
                  </View>

                  {/* Quantity + Delete */}
                  <View style={styles.itemBottomRow}>
                    <View style={styles.qtyPill}>
                      <Pressable
                        onPress={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                        disabled={updatingItem === item.id || (item.quantity || 1) <= 1}
                        style={[styles.qtyBtn, (item.quantity || 1) <= 1 && { opacity: 0.3 }]}
                      >
                        <Ionicons name="remove" size={16} color="#94A3B8" />
                      </Pressable>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <Pressable
                        onPress={() => updateQuantity(item.id, (item.quantity || 0) + 1)}
                        disabled={updatingItem === item.id}
                        style={styles.qtyBtnPlus}
                      >
                        <Ionicons name="add" size={16} color="#fff" />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => removeItem(item.id)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color="#CBD5E1" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Pricing Summary */}
          <View style={styles.pricingSection}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Subtotal</Text>
              <Text style={styles.pricingValue}>{formatPrice(selectedCart.cart_total)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>
                Delivery Fee{deliveryInfo.distanceKm != null ? ` (${deliveryInfo.distanceKm.toFixed(1)} km)` : ""}
              </Text>
              {deliveryInfo.loading ? (
                <Text style={[styles.pricingValue, { color: "#94A3B8" }]}>Calculating...</Text>
              ) : deliveryInfo.fee != null ? (
                <Text style={[styles.pricingValue, { color: PRIMARY, fontWeight: "700" }]}>
                  {formatPrice(deliveryInfo.fee)}
                </Text>
              ) : (
                <Text style={[styles.pricingValue, { color: "#94A3B8" }]}>--</Text>
              )}
            </View>
            <View style={styles.pricingDivider} />
            <View style={styles.pricingRow}>
              <Text style={styles.pricingTotalLabel}>Total Amount</Text>
              <Text style={styles.pricingTotalValue}>
                {formatPrice((Number(selectedCart.cart_total) || 0) + (deliveryInfo.fee || 0))}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <Pressable
              onPress={() => goCheckout(selectedCart.id)}
              style={({ pressed }) => [styles.checkoutBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.checkoutBtnText}>
                Checkout • {formatPrice((Number(selectedCart.cart_total) || 0) + (deliveryInfo.fee || 0))}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                navigation.navigate("RestaurantFoods", {
                  restaurantId: selectedCart.restaurant_id,
                })
              }
              style={({ pressed }) => [styles.addMoreBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.addMoreBtnText}>Add More Items</Text>
            </Pressable>

            <Pressable onPress={() => removeCart(selectedCart.id)} style={styles.clearCartLink}>
              <Ionicons name="trash-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.clearCartText}>Clear this cart</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // ACTIVE RESTAURANTS LIST
  // ============================================================================
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <CartHeader cartCount={cartCount} onClose={() => navigation.navigate("MainTabs", { screen: "Home" })} />

      <View style={styles.page}>
        <Text style={styles.sectionTitle}>Active Restaurants</Text>

        <FlatList
          data={carts}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingBottom: 18 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const count = item?.item_count || item?.items?.length || 0;
            return (
              <View style={styles.restaurantCard}>
                <View style={styles.restaurantCardRow}>
                  {/* Round Logo */}
                  {item?.restaurant?.logo_url ? (
                    <Image
                      source={{ uri: item.restaurant.logo_url }}
                      style={styles.restaurantAvatar}
                    />
                  ) : (
                    <View style={styles.restaurantAvatarFallback}>
                      <Text style={styles.restaurantAvatarText}>
                        {(item?.restaurant?.restaurant_name || "R").charAt(0)}
                      </Text>
                    </View>
                  )}

                  {/* Info */}
                  <View style={styles.restaurantCardInfo}>
                    <Text style={styles.restaurantCardName} numberOfLines={1}>
                      {item?.restaurant?.restaurant_name}
                    </Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-sharp" size={12} color="#94A3B8" />
                      <Text style={styles.restaurantCardCity}>
                        {item?.restaurant?.city || "Location"}
                      </Text>
                    </View>
                    <Text style={styles.restaurantCardMeta}>
                      {count} item{count !== 1 ? "s" : ""} in basket
                    </Text>
                  </View>

                  {/* View Button */}
                  <Pressable
                    onPress={() => setSelectedCartId(item.id)}
                    style={({ pressed }) => [
                      styles.viewBtn,
                      pressed && { backgroundColor: PRIMARY },
                    ]}
                  >
                    {({ pressed }) => (
                      <>
                        <Text style={[styles.viewBtnText, pressed && { color: "#fff" }]}>View</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={pressed ? "#fff" : PRIMARY}
                        />
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// CART HEADER COMPONENT
// ============================================================================
function CartHeader({ cartCount, onClose }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#0F172A" />
          </Pressable>
        )}
        <View style={styles.headerIconBox}>
          <Ionicons name="bag-handle" size={20} color="#fff" />
        </View>
      </View>
      <View style={styles.headerCartWrap}>
        <View style={styles.headerCartBtn}>
          <Ionicons name="cart" size={22} color="#64748B" />
        </View>
        {cartCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{cartCount}</Text>
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
  container: { flex: 1, backgroundColor: "#fff" },
  page: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: TEXT_DARK, letterSpacing: -0.3 },
  headerCartWrap: { position: "relative" },
  headerCartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Section Title
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: TEXT_DARK,
    marginTop: 20,
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  // Loading
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  loadingText: { color: MUTED, fontSize: 14, fontWeight: "500" },

  // Error
  errorIcon: { marginBottom: 4 },
  errTitle: { fontSize: 20, fontWeight: "800", color: TEXT_DARK },
  errText: { color: "#EF4444", textAlign: "center", fontSize: 14 },

  // Empty
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: TEXT_DARK },
  emptySubtitle: { color: "#94A3B8", fontSize: 14, fontWeight: "500" },

  // Primary Button
  primaryBtn: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Restaurant Card (List)
  restaurantCard: {
    flexDirection: "column",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  restaurantCardRow: { flexDirection: "row", alignItems: "center" },
  restaurantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BG,
  },
  restaurantAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TEXT_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantAvatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  restaurantCardInfo: { flex: 1, marginLeft: 12 },
  restaurantCardName: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  restaurantCardCity: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  restaurantCardMeta: { fontSize: 12, fontWeight: "700", color: PRIMARY, marginTop: 3 },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  viewBtnText: { fontSize: 12, fontWeight: "700", color: PRIMARY },

  // Back Row
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
  },
  backLabel: { color: PRIMARY, fontSize: 13, fontWeight: "700" },

  // Summary Card (Green)
  summaryCard: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  summaryName: { fontSize: 18, fontWeight: "800", color: "#fff" },
  summaryMeta: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  summaryRight: { alignItems: "flex-end" },
  summarySubLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryTotal: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 2 },

  // Items List
  itemsList: { marginBottom: 4 },
  itemRow: { flexDirection: "row", paddingVertical: 16 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: BG,
  },
  itemDetails: { flex: 1, marginLeft: 14 },
  itemTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemName: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  sizeTag: {
    backgroundColor: BG,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  sizeTagText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemPrice: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  itemBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },

  // Quantity Pill
  qtyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_DARK,
    minWidth: 16,
    textAlign: "center",
  },
  deleteBtn: { padding: 6 },

  // Pricing Summary
  pricingSection: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 16,
    marginTop: 8,
    gap: 10,
    marginBottom: 8,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pricingLabel: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  pricingValue: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  pricingDivider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  pricingTotalLabel: { fontSize: 15, fontWeight: "800", color: TEXT_DARK },
  pricingTotalValue: { fontSize: 18, fontWeight: "800", color: TEXT_DARK },

  // Action Section
  actionSection: { marginTop: 20, gap: 12, paddingBottom: 8 },
  checkoutBtn: {
    height: 54,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  checkoutBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  addMoreBtn: {
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  addMoreBtnText: { color: PRIMARY, fontWeight: "700", fontSize: 15 },
  clearCartLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  clearCartText: { color: "#EF4444", fontWeight: "600", fontSize: 13 },
});