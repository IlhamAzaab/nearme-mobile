import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OptimizedImage from "../../components/common/OptimizedImage";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import { prefetchImageUrls } from "../../lib/imageCache";

const PRIMARY = "#06C168";
const TEXT_DARK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#F1F5F9";
const BG = "#F8FAFC";

const asArray = (value) => (Array.isArray(value) ? value : []);

function hasValidCoordinates(latitude, longitude) {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined
  ) {
    return false;
  }

  if (
    (typeof latitude === "string" && latitude.trim() === "") ||
    (typeof longitude === "string" && longitude.trim() === "")
  ) {
    return false;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export default function CartScreen({ navigation, route }) {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingItem, setUpdatingItem] = useState(null);
  const [selectedCartId, setSelectedCartId] = useState(null);

  const safeCarts = asArray(carts);

  const selectedCart = useMemo(
    () =>
      safeCarts.find((c) => String(c?.id) === String(selectedCartId)) || null,
    [safeCarts, selectedCartId],
  );

  const cartCount = useMemo(() => {
    return safeCarts.reduce((sum, cart) => {
      return (
        sum +
        asArray(cart?.items).reduce((s, it) => s + Number(it?.quantity || 0), 0)
      );
    }, 0);
  }, [safeCarts]);

  // Handle Buy Now navigation — auto-select the specific restaurant cart
  useEffect(() => {
    if (route?.params?.buyNowTs || route?.params?.menuCartTs) {
      const rid =
        route?.params?.buyNowRestaurantId || route?.params?.restaurantId;
      const cid = route?.params?.buyNowCartId;
      navigation.setParams({
        buyNowCartId: undefined,
        buyNowRestaurantId: undefined,
        buyNowTs: undefined,
        restaurantId: undefined,
        menuCartTs: undefined,
      });
      fetchCarts(true, { autoSelectCartId: cid, autoSelectRestaurantId: rid });
    } else {
      fetchCarts(true);
    }
  }, []);

  // Refetch when screen re-focuses (silent refresh)
  const isFirstLoad = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
      } else {
        fetchCarts(false);
      }
    }, []),
  );

  // If Buy Now params arrive while screen is already mounted, handle them
  useEffect(() => {
    if (route?.params?.buyNowTs || route?.params?.menuCartTs) {
      const rid =
        route?.params?.buyNowRestaurantId || route?.params?.restaurantId;
      const cid = route?.params?.buyNowCartId;
      navigation.setParams({
        buyNowCartId: undefined,
        buyNowRestaurantId: undefined,
        buyNowTs: undefined,
        restaurantId: undefined,
        menuCartTs: undefined,
      });
      fetchCarts(true, { autoSelectCartId: cid, autoSelectRestaurantId: rid });
    }
  }, [route?.params?.buyNowTs, route?.params?.menuCartTs]);

  const fetchCarts = async (showLoading = true, opts = null) => {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const token = await getAccessToken();
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

      const fetchedCarts = asArray(data.carts);
      setCarts(fetchedCarts);
      prefetchImageUrls(
        fetchedCarts
          .flatMap((cart) => [
            cart?.restaurant?.logo_url,
            ...(cart?.items || []).map((item) => item?.food_image_url),
          ])
          .slice(0, 64),
      );

      // Auto-select logic: buyNow params > cartId param > keep current
      const { autoSelectCartId, autoSelectRestaurantId } = opts || {};
      if (
        autoSelectCartId &&
        fetchedCarts.some((c) => String(c?.id) === String(autoSelectCartId))
      ) {
        setSelectedCartId(autoSelectCartId);
      } else if (autoSelectRestaurantId) {
        const match = fetchedCarts.find(
          (c) => String(c.restaurant_id) === String(autoSelectRestaurantId),
        );
        if (match) {
          setSelectedCartId(match.id);
        } else {
          setSelectedCartId(null);
        }
      } else {
        const paramCartId = route?.params?.cartId;
        const paramRestaurantId = route?.params?.restaurantId;
        if (
          paramCartId &&
          fetchedCarts.some((c) => String(c?.id) === String(paramCartId))
        ) {
          setSelectedCartId(paramCartId);
          navigation.setParams({ cartId: undefined });
        } else if (paramRestaurantId) {
          const match = fetchedCarts.find(
            (c) => String(c.restaurant_id) === String(paramRestaurantId),
          );
          if (match) {
            setSelectedCartId(match.id);
          } else {
            setSelectedCartId(null);
          }
          navigation.setParams({ restaurantId: undefined });
        } else {
          setSelectedCartId((prev) =>
            fetchedCarts.some((c) => String(c?.id) === String(prev))
              ? prev
              : null,
          );
        }
      }
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

  // Debounced API sync for quantity updates
  const pendingUpdates = useRef({});
  const debounceTimers = useRef({});

  const syncQuantityToServer = useCallback(async (itemId, qty) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE_URL}/cart/item/${itemId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update quantity");
      // Silent background sync
      await fetchCarts(false);
    } catch (e) {
      Alert.alert("Error", e.message || "Update failed");
      // Refetch to revert to server state
      await fetchCarts(false);
    }
  }, []);

  const updateQuantity = useCallback(
    (itemId, newQty) => {
      if (newQty < 1) return;

      // Instant optimistic UI update
      setCarts((prev) =>
        asArray(prev).map((cart) => ({
          ...cart,
          items: asArray(cart?.items).map((item) =>
            item.id === itemId ? { ...item, quantity: newQty } : item,
          ),
        })),
      );

      // Store the latest value and debounce the API call
      pendingUpdates.current[itemId] = newQty;
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
      }
      debounceTimers.current[itemId] = setTimeout(() => {
        const finalQty = pendingUpdates.current[itemId];
        delete pendingUpdates.current[itemId];
        delete debounceTimers.current[itemId];
        syncQuantityToServer(itemId, finalQty);
      }, 500);
    },
    [syncQuantityToServer],
  );

  const handleQuantityInput = useCallback(
    (itemId, text) => {
      const parsed = parseInt(text, 10);
      if (text === "" || text === "0") {
        // Allow empty/zero while typing, but don't sync yet
        setCarts((prev) =>
          asArray(prev).map((cart) => ({
            ...cart,
            items: asArray(cart?.items).map((item) =>
              item.id === itemId
                ? { ...item, quantity: text === "" ? "" : 0 }
                : item,
            ),
          })),
        );
        return;
      }
      if (!isNaN(parsed) && parsed >= 1) {
        updateQuantity(itemId, parsed);
      }
    },
    [updateQuantity],
  );

  const handleQuantityBlur = useCallback(
    (itemId, currentQty) => {
      // If the user left the field empty or at 0, reset to 1
      if (!currentQty || currentQty < 1) {
        updateQuantity(itemId, 1);
      }
    },
    [updateQuantity],
  );

  const removeItem = async (itemId) => {
    Alert.alert("Remove item", "Remove this item from cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          // Optimistic update: remove the item from UI instantly
          const previousCarts = carts;
          setCarts((prev) =>
            asArray(prev)
              .map((cart) => ({
                ...cart,
                items: asArray(cart?.items).filter((item) => item.id !== itemId),
              }))
              .filter((cart) => asArray(cart?.items).length > 0),
          );

          try {
            const token = await getAccessToken();
            const res = await fetch(`${API_BASE_URL}/cart/item/${itemId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
              throw new Error(data.message || "Failed to remove item");
            await fetchCarts(false);
          } catch (e) {
            setCarts(previousCarts);
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
          // Optimistic update: remove the cart from UI instantly
          const previousCarts = carts;
          setCarts((prev) => prev.filter((c) => c.id !== cartId));
          setSelectedCartId((prev) => (prev === cartId ? null : prev));

          try {
            const token = await getAccessToken();
            const res = await fetch(`${API_BASE_URL}/cart/${cartId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
              throw new Error(data.message || "Failed to clear cart");
            await fetchCarts(false);
          } catch (e) {
            setCarts(previousCarts);
            Alert.alert("Error", e.message || "Clear failed");
          }
        },
      },
    ]);
  };

  const goCheckout = async (cartId) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert("Login required", "Please login to continue");
        return;
      }

      const profileRes = await fetch(`${API_BASE_URL}/cart/customer-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!profileRes.ok) {
        navigation.navigate("AddressPicker", {
          cartId,
          redirectTo: "Checkout",
        });
        return;
      }

      const profileData = await profileRes.json().catch(() => ({}));

      const customer = profileData?.customer || {};
      const hasSavedPin = hasValidCoordinates(
        customer?.latitude,
        customer?.longitude,
      );

      if (hasSavedPin) {
        navigation.navigate("Checkout", { cartId });
        return;
      }

      navigation.navigate("AddressPicker", {
        cartId,
        redirectTo: "Checkout",
      });
    } catch (checkoutNavError) {
      console.error("Checkout pre-check failed, redirecting to map pin:", checkoutNavError);
      navigation.navigate("AddressPicker", {
        cartId,
        redirectTo: "Checkout",
      });
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader
          cartCount={cartCount}
          onClose={() =>
            navigation.navigate("MainTabs", {
              screen: "Home",
              params: { screen: "HomeMain" },
            })
          }
        />
        <View style={{ padding: 16, gap: 14 }}>
          {/* Restaurant summary skeleton */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              gap: 10,
            }}
          >
            <SkeletonBlock width="60%" height={18} borderRadius={6} />
            <SkeletonBlock width="35%" height={13} borderRadius={6} />
          </View>
          {/* Cart item skeletons */}
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 14,
                flexDirection: "row",
                gap: 12,
              }}
            >
              <SkeletonBlock width={72} height={72} borderRadius={12} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBlock width="70%" height={16} borderRadius={6} />
                <SkeletonBlock width="40%" height={12} borderRadius={6} />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <SkeletonBlock width={80} height={28} borderRadius={14} />
                  <SkeletonBlock width={60} height={16} borderRadius={6} />
                </View>
              </View>
            </View>
          ))}
          {/* Delivery info skeleton */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              gap: 10,
            }}
          >
            <SkeletonBlock width="50%" height={14} borderRadius={6} />
            <SkeletonBlock width="100%" height={14} borderRadius={6} />
            <SkeletonBlock width="30%" height={14} borderRadius={6} />
          </View>
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
        <CartHeader
          cartCount={cartCount}
          onClose={() =>
            navigation.navigate("MainTabs", {
              screen: "Home",
              params: { screen: "HomeMain" },
            })
          }
        />
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
        <CartHeader
          cartCount={0}
          onClose={() =>
            navigation.navigate("MainTabs", {
              screen: "Home",
              params: { screen: "HomeMain" },
            })
          }
        />
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cart-outline" size={56} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Add items from restaurants to get started
          </Text>
          <Pressable
            onPress={() =>
              navigation.navigate("MainTabs", {
                screen: "Home",
                params: { screen: "HomeMain" },
              })
            }
            style={styles.primaryBtn}
          >
            <Ionicons
              name="home"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
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
    const itemCount =
      selectedCart?.item_count || selectedCart?.items?.length || 0;
    const itemSubtotal = Number(selectedCart?.cart_total) || 0;
    const selectedItems = asArray(selectedCart?.items);

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CartHeader
          cartCount={cartCount}
          onClose={() =>
            navigation.navigate("MainTabs", {
              screen: "Home",
              params: { screen: "HomeMain" },
            })
          }
        />

        <ScrollView
          style={styles.page}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Back Link */}
          <Pressable
            onPress={() => setSelectedCartId(null)}
            style={styles.backRow}
          >
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
                {selectedCart?.restaurant?.city || "Restaurant"} • {itemCount}{" "}
                item{itemCount !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {/* Food Items */}
          <View style={styles.itemsList}>
            {selectedItems.map((item, idx) => (
              <View
                key={String(item?.id || idx)}
                style={[
                  styles.itemRow,
                  idx < selectedItems.length - 1 &&
                    styles.itemRowBorder,
                ]}
              >
                <OptimizedImage
                  uri={
                    item.food_image_url ||
                    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400"
                  }
                  style={styles.itemImage}
                  transition={110}
                />
                <View style={styles.itemDetails}>
                  <View style={styles.itemTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.food_name}
                      </Text>
                      <View style={styles.sizeTag}>
                        <Text style={styles.sizeTagText}>
                          {String(item.size || "Regular")
                            .charAt(0)
                            .toUpperCase() +
                            String(item.size || "Regular").slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemPrice}>
                      {formatPrice(item.unit_price)}
                    </Text>
                  </View>

                  {/* Quantity + Delete */}
                  <View style={styles.itemBottomRow}>
                    <View style={styles.qtyPill}>
                      <Pressable
                        onPress={() =>
                          updateQuantity(item.id, (item.quantity || 1) - 1)
                        }
                        disabled={(item.quantity || 1) <= 1}
                        style={[
                          styles.qtyBtn,
                          (item.quantity || 1) <= 1 && { opacity: 0.3 },
                        ]}
                      >
                        <Ionicons name="remove" size={16} color="#94A3B8" />
                      </Pressable>
                      <TextInput
                        style={styles.qtyValue}
                        value={String(item.quantity ?? "")}
                        onChangeText={(text) =>
                          handleQuantityInput(item.id, text)
                        }
                        onBlur={() =>
                          handleQuantityBlur(item.id, item.quantity)
                        }
                        keyboardType="number-pad"
                        selectTextOnFocus
                        maxLength={3}
                      />
                      <Pressable
                        onPress={() =>
                          updateQuantity(item.id, (item.quantity || 0) + 1)
                        }
                        style={styles.qtyBtnPlus}
                      >
                        <Ionicons name="add" size={16} color="#fff" />
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => removeItem(item.id)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#CBD5E1"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Pricing Summary */}
          <View style={styles.pricingSection}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingTotalLabel}>Subtotal</Text>
              <Text style={styles.pricingTotalValue}>
                {formatPrice(itemSubtotal)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <Pressable
              onPress={() => goCheckout(selectedCart.id)}
              style={({ pressed }) => [
                styles.checkoutBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.checkoutBtnText}>Checkout</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                navigation.navigate("RestaurantFoods", {
                  restaurantId: selectedCart.restaurant_id,
                })
              }
              style={({ pressed }) => [
                styles.addMoreBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.addMoreBtnText}>Add More Items</Text>
            </Pressable>

            <Pressable
              onPress={() => removeCart(selectedCart.id)}
              style={styles.clearCartLink}
            >
              <Ionicons
                name="trash-outline"
                size={14}
                color="#EF4444"
                style={{ marginRight: 4 }}
              />
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
      <CartHeader
        cartCount={cartCount}
        onClose={() =>
          navigation.navigate("MainTabs", {
            screen: "Home",
            params: { screen: "HomeMain" },
          })
        }
      />

      <View style={styles.page}>
        <Text style={styles.sectionTitle}>Active Restaurants</Text>

        <FlatList
          data={safeCarts}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingBottom: 18 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const count = item?.item_count || item?.items?.length || 0;
            const cartTotal = Number(item?.cart_total) || 0;
            return (
              <View style={styles.restaurantCard}>
                <View style={styles.restaurantCardRow}>
                  {/* Round Logo */}
                  {item?.restaurant?.logo_url ? (
                    <OptimizedImage
                      uri={item.restaurant.logo_url}
                      style={styles.restaurantAvatar}
                      transition={90}
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
                    <View style={styles.restaurantNameRow}>
                      <Text style={styles.restaurantCardName} numberOfLines={1}>
                        {item?.restaurant?.restaurant_name}
                      </Text>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={PRIMARY}
                        style={styles.activeDot}
                      />
                    </View>
                    <View style={styles.locationRow}>
                      <Text style={styles.restaurantCardCity}>
                        {item?.restaurant?.city || "Location"}
                      </Text>
                    </View>
                    <Text style={styles.restaurantCardMeta}>
                      {count} item{count !== 1 ? "s" : ""} •{" "}
                      {formatPrice(cartTotal)}
                    </Text>
                  </View>
                </View>

                <View style={styles.restaurantActions}>
                  <Pressable
                    onPress={() => setSelectedCartId(item.id)}
                    style={({ pressed }) => [
                      styles.viewItemsBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.viewItemsText}>View items</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => removeCart(item.id)}
                    style={({ pressed }) => [
                      styles.clearOutlineBtn,
                      pressed && { backgroundColor: "rgba(16,185,129,0.08)" },
                    ]}
                  >
                    <Text style={styles.clearOutlineText}>Clear</Text>
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
      </View>
      <View style={styles.headerCartWrap}>
        <View style={styles.headerCartBtn}>
          <Ionicons name="cart" size={22} color={PRIMARY} />
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 4,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_DARK,
    letterSpacing: -0.3,
  },
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
  restaurantNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  activeDot: { marginTop: 1 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  restaurantCardCity: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  restaurantCardMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
    marginTop: 3,
  },
  restaurantActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  viewItemsBtn: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  viewItemsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  clearOutlineBtn: {
    minWidth: 92,
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#fff",
  },
  clearOutlineText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "600",
  },
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
  summaryTotal: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginTop: 2,
  },

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
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
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
    minWidth: 28,
    textAlign: "center",
    paddingVertical: 0,
    paddingHorizontal: 2,
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
