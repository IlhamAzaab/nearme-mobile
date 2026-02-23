import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FreeMapView from "../../components/maps/FreeMapView";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// ORDER SUCCESS SCREEN COMPONENT (Image-like UI)
// ============================================================================
function OrderSuccessScreen({ order, cart, position, address, navigation, formatPrice }) {
  const [viewOrderExpanded, setViewOrderExpanded] = useState(false);

  const restaurant = cart?.restaurant || {};
  const items = cart?.items || [];

  return (
    <View style={successStyles.container}>
      {/* Map Background */}
      <View style={successStyles.mapContainer}>
        <FreeMapView
          style={successStyles.map}
          region={{
            latitude: parseFloat(position?.latitude) || 7.8731,
            longitude: parseFloat(position?.longitude) || 80.7718,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          markers={[{
            id: 'delivery',
            coordinate: {
              latitude: parseFloat(position?.latitude) || 7.8731,
              longitude: parseFloat(position?.longitude) || 80.7718,
            },
            type: 'delivery',
            emoji: '📍',
          }]}
        />

        {/* Back Button */}
        <Pressable
          style={successStyles.backButton}
          onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
        >
          <Text style={successStyles.backButtonText}>←</Text>
        </Pressable>
      </View>

      {/* Bottom Sheet */}
      <View style={successStyles.bottomSheet}>
        {/* Drag Handle */}
        <View style={successStyles.dragHandle} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Order Placed Title with Progress */}
          <View style={successStyles.headerSection}>
            <View style={successStyles.progressBar}>
              <View style={successStyles.progressFill} />
            </View>
            <Text style={successStyles.title}>Order Placed!</Text>
          </View>

          {/* Delivery Details */}
          <View style={successStyles.section}>
            <Text style={successStyles.sectionLabel}>DELIVERY DETAILS</Text>
            <View style={successStyles.deliveryCard}>
              <Text style={successStyles.deliveryIcon}>📍</Text>
              <View style={successStyles.deliveryTextWrap}>
                <Text style={successStyles.deliveryLabel}>Delivering to</Text>
                <Text style={successStyles.deliveryAddress} numberOfLines={2}>
                  {address || "Your location"}
                </Text>
              </View>
            </View>
          </View>

          {/* View Order Expandable */}
          <Pressable
            style={successStyles.expandableCard}
            onPress={() => setViewOrderExpanded(!viewOrderExpanded)}
          >
            <View style={successStyles.expandableRow}>
              <Text style={successStyles.expandableIcon}>📋</Text>
              <Text style={successStyles.expandableText}>View Order</Text>
              <Text style={successStyles.expandableArrow}>
                {viewOrderExpanded ? "∧" : "∨"}
              </Text>
            </View>

            {viewOrderExpanded && (
              <View style={successStyles.orderDetails}>
                <View style={successStyles.orderRow}>
                  <Text style={successStyles.orderLabel}>Order No</Text>
                  <Text style={successStyles.orderValue}>
                    {order.order_number || order.id}
                  </Text>
                </View>
                <View style={successStyles.orderRow}>
                  <Text style={successStyles.orderLabel}>Items</Text>
                  <Text style={successStyles.orderValue}>{order.items_count || items.length}</Text>
                </View>
                <View style={successStyles.orderRow}>
                  <Text style={successStyles.orderLabel}>Est. Delivery</Text>
                  <Text style={successStyles.orderValue}>
                    ~{Math.round(order.estimated_duration_min || 30)} mins
                  </Text>
                </View>
                <View style={successStyles.divider} />
                <View style={successStyles.orderRow}>
                  <Text style={[successStyles.orderLabel, { fontWeight: "700" }]}>Total</Text>
                  <Text style={[successStyles.orderValue, { fontWeight: "900", color: "#10B981" }]}>
                    {formatPrice(order.total_amount)}
                  </Text>
                </View>

                {/* Items List */}
                {items.length > 0 && (
                  <View style={successStyles.itemsList}>
                    {items.map((item, index) => (
                      <View key={item.id || index} style={successStyles.itemRow}>
                        <Text style={successStyles.itemQty}>{item.quantity}x</Text>
                        <Text style={successStyles.itemName} numberOfLines={1}>
                          {item.food_name}
                        </Text>
                        <Text style={successStyles.itemPrice}>
                          {formatPrice(item.unit_price * item.quantity)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {/* Restaurant Section */}
          <View style={successStyles.section}>
            <Text style={successStyles.sectionLabel}>RESTAURANT</Text>
            <View style={successStyles.restaurantCard}>
              {restaurant.logo_url ? (
                <Image
                  source={{ uri: restaurant.logo_url }}
                  style={successStyles.restaurantLogo}
                />
              ) : (
                <View style={successStyles.restaurantLogoFallback}>
                  <Text style={successStyles.restaurantLogoText}>
                    {(restaurant.restaurant_name || "R").charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={successStyles.restaurantName} numberOfLines={1}>
                {restaurant.restaurant_name || order.restaurant_name || "Restaurant"}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={successStyles.buttonsContainer}>
            <Pressable
              style={successStyles.trackButton}
              onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
            >
              <Text style={successStyles.trackButtonText}>Track Order</Text>
            </Pressable>

            <Pressable
              style={successStyles.homeButton}
              onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
            >
              <Text style={successStyles.homeButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const successStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.35,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  markerPin: {
    width: 30,
    height: 40,
    backgroundColor: "#10B981",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 15,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  markerPinInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    transform: [{ rotate: "-45deg" }],
  },
  markerShadow: {
    width: 14,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 7,
    marginTop: -3,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: {
    width: "40%",
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  deliveryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  deliveryTextWrap: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  deliveryAddress: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  expandableCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  expandableRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandableIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  expandableText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  expandableArrow: {
    fontSize: 16,
    color: "#6B7280",
  },
  orderDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  orderValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 10,
  },
  itemsList: {
    marginTop: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  itemQty: {
    width: 30,
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  restaurantLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  restaurantLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  restaurantLogoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  restaurantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  buttonsContainer: {
    marginTop: 10,
    marginBottom: 30,
  },
  trackButton: {
    height: 54,
    backgroundColor: "#10B981",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  trackButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  homeButton: {
    height: 54,
    backgroundColor: "#fff",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#10B981",
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
});

// ============================================================================
// OSRM route distance
// ============================================================================
async function calculateRouteDistance(lat1, lon1, lat2, lon2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === "Ok" && data.routes?.length) {
      const r = data.routes[0];
      return { success: true, distance: r.distance / 1000, duration: r.duration / 60 };
    }
    return { success: false, error: "No route found" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default function CheckoutScreen({ route, navigation }) {
  const { cartId } = route.params || {};
  const mapRef = useRef(null);

  // Cart + profile
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Address
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const [position, setPosition] = useState({
    latitude: 7.8731,
    longitude: 80.7718,
  });

  const [isMapEditMode, setIsMapEditMode] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Modal edit
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");

  // Route info
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Payment
  const [paymentMethod] = useState("cash");

  // Order
  const [placing, setPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [showPlacingOverlay, setShowPlacingOverlay] = useState(false);
  const placingProgress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const MINIMUM_SUBTOTAL = 300;
  const PRIORITY_FEE = 49;

  const calculateServiceFee = (subtotal) => {
    if (subtotal < 300) return 0;
    if (subtotal < 1000) return 31;
    if (subtotal < 1500) return 42;
    if (subtotal < 2500) return 56;
    return 62;
  };

  const calculateDeliveryFee = (distanceKm) => {
    if (distanceKm === null || distanceKm === undefined) return null;
    if (distanceKm <= 1) return 50;
    if (distanceKm <= 2) return 80;
    if (distanceKm <= 2.5) return 87;
    const extraMeters = (distanceKm - 2.5) * 1000;
    const extra100mUnits = Math.ceil(extraMeters / 100);
    return 87 + extra100mUnits * 2.3;
  };

  const formatPrice = (p) => {
    const n = Number(p);
    if (Number.isNaN(n)) return "Rs. 0.00";
    return `Rs. ${n.toFixed(2)}`;
  };

  useEffect(() => {
    if (!cartId) {
      navigation.navigate("MainTabs", { screen: "Cart" });
      return;
    }
    fetchCheckoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId]);

  // ============================================================================
  // GET LIVE LOCATION
  // ============================================================================
  const getCurrentLocation = async () => {
    try {
      setFetchingLocation(true);

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable location permission to use this feature",
          [{ text: "OK" }]
        );
        setFetchingLocation(false);
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newPosition = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setPosition(newPosition);

      // Animate map to new location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...newPosition,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1000);
      }

      // Try to get address from coordinates (reverse geocoding)
      try {
        const [geocode] = await Location.reverseGeocodeAsync({
          latitude: newPosition.latitude,
          longitude: newPosition.longitude,
        });

        if (geocode) {
          const addressParts = [];
          if (geocode.streetNumber) addressParts.push(geocode.streetNumber);
          if (geocode.street) addressParts.push(geocode.street);
          if (geocode.district) addressParts.push(geocode.district);
          if (geocode.subregion) addressParts.push(geocode.subregion);
          
          const newAddress = addressParts.join(", ") || geocode.name || "";
          const newCity = geocode.city || geocode.region || "";

          if (newAddress) setAddress(newAddress);
          if (newCity) setCity(newCity);
        }
      } catch (geoError) {
        console.log("Reverse geocoding failed:", geoError);
      }

      setFetchingLocation(false);
    } catch (err) {
      console.log("Location error:", err);
      Alert.alert("Error", "Failed to get your location. Please try again.");
      setFetchingLocation(false);
    }
  };

  // ✅ route calc when customer position / restaurant changes
  useEffect(() => {
    const run = async () => {
      if (!position || !cart?.restaurant?.latitude || !cart?.restaurant?.longitude) {
        setRouteInfo(null);
        return;
      }

      setRouteLoading(true);
      const result = await calculateRouteDistance(
        position.latitude,
        position.longitude,
        parseFloat(cart.restaurant.latitude),
        parseFloat(cart.restaurant.longitude)
      );

      if (result.success) setRouteInfo({ distance: result.distance, duration: result.duration });
      else setRouteInfo(null);

      setRouteLoading(false);
    };

    run();
  }, [position, cart?.restaurant?.latitude, cart?.restaurant?.longitude]);

  const fetchCheckoutData = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await AsyncStorage.getItem("token");
      const role = await AsyncStorage.getItem("role");

      if (!token || token === "null" || token === "undefined") {
        Alert.alert("Login required", "Please login to checkout", [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Login", onPress: () => navigation.navigate("Login") },
        ]);
        return;
      }

      if (role !== "customer") {
        Alert.alert("Not allowed", "Only customers can checkout");
        return;
      }

      // web போல parallel calls
      const [cartRes, profileRes] = await Promise.all([
        fetch(`${API_BASE_URL}/cart`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/cart/customer-profile`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const cartData = await cartRes.json().catch(() => ({}));
      const profileData = await profileRes.json().catch(() => ({}));

      if (!cartRes.ok) throw new Error(cartData.message || "Failed to fetch cart");
      if (!profileRes.ok) throw new Error(profileData.message || "Failed to fetch profile");

      // cartId match (string vs number fix)
      const selected = (cartData.carts || []).find((c) => String(c.id) === String(cartId));
      if (!selected) throw new Error("Cart not found");

      setCart(selected);

      if (profileData.customer) {
        setPhone(profileData.customer.phone || "");
        setAddress(profileData.customer.address || "");
        setCity(profileData.customer.city || "");

        if (profileData.customer.latitude && profileData.customer.longitude) {
          setPosition({
            latitude: parseFloat(profileData.customer.latitude),
            longitude: parseFloat(profileData.customer.longitude),
          });
        }
      }
    } catch (e) {
      setError(e.message || "Checkout load failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAddressAndLocation = async ({ newAddress, newCity, newPosition }) => {
    try {
      setSavingAddress(true);
      const token = await AsyncStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/customer/address`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          address: newAddress,
          city: newCity,
          latitude: newPosition.latitude,
          longitude: newPosition.longitude,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save address");

      setAddress(newAddress);
      setCity(newCity);
      setPosition(newPosition);
      setError("");
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    try {
      if (!phone || !address || !position) throw new Error("Please fill address & location");
      if (!cart) throw new Error("Cart missing");

      const subtotal = Number(cart.cart_total) || 0;
      if (subtotal < MINIMUM_SUBTOTAL) throw new Error(`Minimum order amount is Rs. ${MINIMUM_SUBTOTAL}`);
      if (!routeInfo) throw new Error("Please wait for delivery fee calculation");

      setPlacing(true);
      setError("");

      // Show overlay and start progress animation
      setShowPlacingOverlay(true);
      placingProgress.setValue(0);
      overlayOpacity.setValue(0);

      // Fade in overlay
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Animate progress to 70% while API call is in progress
      const progressAnim = Animated.timing(placingProgress, {
        toValue: 0.7,
        duration: 2500,
        useNativeDriver: false,
      });
      progressAnim.start();

      const token = await AsyncStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/orders/place`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cartId,
          delivery_latitude: position.latitude,
          delivery_longitude: position.longitude,
          delivery_address: address,
          delivery_city: city,
          payment_method: paymentMethod,
          distance_km: routeInfo.distance,
          estimated_duration_min: routeInfo.duration,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to place order");

      // Stop partial animation and complete to 100%
      progressAnim.stop();
      Animated.timing(placingProgress, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }).start();

      // Wait for completion animation, then navigate
      const placedOrder = data.order;
      setTimeout(() => {
        navigation.replace("OrderTracking", { orderId: placedOrder.id });
      }, 900);
    } catch (e) {
      // Hide overlay on error
      setShowPlacingOverlay(false);
      placingProgress.setValue(0);
      setError(e.message || "Place order failed");
    } finally {
      setPlacing(false);
    }
  };

  const subtotal = useMemo(() => (cart ? Number(cart.cart_total) || 0 : 0), [cart]);
  const serviceFee = useMemo(() => calculateServiceFee(subtotal), [subtotal]);
  const deliveryFee = useMemo(
    () => (routeInfo ? calculateDeliveryFee(routeInfo.distance) : null),
    [routeInfo]
  );

  const isSubtotalValid = subtotal >= MINIMUM_SUBTOTAL;

  const totalAmount = useMemo(() => {
    if (!isSubtotalValid || deliveryFee === null) return null;
    return subtotal + serviceFee + deliveryFee;
  }, [subtotal, serviceFee, deliveryFee, isSubtotalValid]);

  const finalTotal = useMemo(() => {
    if (totalAmount === null) return null;
    // keep priority off for now (you can add toggle later)
    return totalAmount;
  }, [totalAmount]);

  // ✅ Loading / Error
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading checkout...</Text>
      </View>
    );
  }

  if (orderSuccess) {
    return (
      <OrderSuccessScreen
        order={orderSuccess}
        cart={cart}
        position={position}
        address={address}
        navigation={navigation}
        formatPrice={formatPrice}
      />
    );
  }

  if (error && !cart) {
    return (
      <View style={[styles.page, styles.center]}>
        <Text style={styles.errTitle}>Error</Text>
        <Text style={styles.errText}>{error}</Text>
        <Pressable onPress={() => navigation.navigate("MainTabs", { screen: "Cart" })} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Back to Cart</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* ✅ Map */}
        <View style={[styles.mapWrap, isMapEditMode ? { height: 280 } : { height: 200 }]}>
          <FreeMapView
            ref={mapRef}
            style={{ flex: 1 }}
            region={{
              latitude: position.latitude,
              longitude: position.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={isMapEditMode}
            zoomEnabled={isMapEditMode}
            showsUserLocation={true}
            onPress={(e) => {
              if (!isMapEditMode) return;
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setPosition({ latitude, longitude });
            }}
            markers={[{
              id: 'position',
              coordinate: position,
              type: 'delivery',
              emoji: '📍',
            }]}
          />

          {/* Back Button - Top Left */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>

          {/* Find My Location Button */}
          <Pressable
            disabled={fetchingLocation}
            onPress={getCurrentLocation}
            style={[styles.locationBtn, fetchingLocation && { opacity: 0.7 }]}
          >
            {fetchingLocation ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Text style={styles.locationBtnIcon}>📍</Text>
            )}
            <Text style={styles.locationBtnText}>
              {fetchingLocation ? "Finding..." : "Find My Location"}
            </Text>
          </Pressable>

          {/* Edit/Done Button */}
          <Pressable
            disabled={savingAddress}
            onPress={async () => {
              if (isMapEditMode) {
                if (address) {
                  await saveAddressAndLocation({
                    newAddress: address,
                    newCity: city,
                    newPosition: position,
                  });
                }
                setIsMapEditMode(false);
              } else {
                setIsMapEditMode(true);
              }
            }}
            style={[styles.mapBtn, savingAddress && { opacity: 0.6 }]}
          >
            <Text style={styles.mapBtnText}>
              {savingAddress ? "Saving..." : isMapEditMode ? "Done" : "Edit"}
            </Text>
          </Pressable>
        </View>

        {/* ✅ Delivery Info - Address, Phone, ETA in one block */}
        <View style={styles.card}>
          {/* Address Row */}
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={18} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Delivery Address</Text>
                <Text style={styles.value} numberOfLines={2}>{address || "Add delivery address"}</Text>
                {!!city && <Text style={styles.muted}>{city}</Text>}
              </View>
            </View>
            <Pressable
              onPress={() => {
                setEditAddress(address);
                setEditCity(city);
                setShowAddressModal(true);
              }}
              style={styles.iconBtn}
            >
              <Text style={{ fontSize: 16 }}>✏️</Text>
            </Pressable>
          </View>

          <View style={styles.infoDivider} />

          {/* Phone Row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.infoIcon}>
              <Ionicons name="call-outline" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.value}>{phone || "No phone number"}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          {/* Estimated Delivery Row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.infoIcon}>
              <Ionicons name="time-outline" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Estimated Delivery</Text>
              <Text style={styles.value}>
                {routeLoading ? "Calculating..." : routeInfo ? `~${Math.ceil(routeInfo.duration) + 15} mins` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* ✅ Price summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Price Details</Text>

          <Row label="Subtotal" value={formatPrice(subtotal)} />
          <Row
            label={`Delivery fee${routeInfo ? ` (${routeInfo.distance.toFixed(1)} km)` : ""}`}
            value={routeLoading ? "..." : deliveryFee !== null ? formatPrice(deliveryFee) : "--"}
          />
          <Row label="Service fee" value={formatPrice(serviceFee)} />

          <View style={styles.divider} />
          <Row label="Total" value={finalTotal !== null ? formatPrice(finalTotal) : "--"} isBold />
        </View>

        {!isSubtotalValid && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              Minimum order: Rs. {MINIMUM_SUBTOTAL}. Add Rs. {(MINIMUM_SUBTOTAL - subtotal).toFixed(0)} more.
            </Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errBox}>
            <Text style={styles.errBoxText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* ✅ Sticky CTA */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={handlePlaceOrder}
          disabled={!isSubtotalValid || deliveryFee === null || routeLoading || placing || !phone || !address}
          style={[
            styles.cta,
            (!isSubtotalValid || deliveryFee === null || routeLoading || placing || !phone || !address) && styles.ctaDisabled,
          ]}
        >
          <Text style={[styles.ctaText, (!isSubtotalValid || deliveryFee === null || routeLoading || placing || !phone || !address) && { color: "#86EFAC" }]}>
            {placing
              ? "Placing..."
              : routeLoading
              ? "Calculating..."
              : !isSubtotalValid
              ? `Add Rs. ${(MINIMUM_SUBTOTAL - subtotal).toFixed(0)} more`
              : finalTotal !== null
              ? `Place Order • ${formatPrice(finalTotal)}`
              : "Place Order"}
          </Text>
        </Pressable>

        <Text style={styles.tiny}>By placing this order, you agree to our terms.</Text>
      </View>

      {/* ✅ Address Modal */}
      <Modal transparent visible={showAddressModal} animationType="slide">
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowAddressModal(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Delivery Address</Text>

            <Text style={styles.inputLabel}>Street Address</Text>
            <TextInput
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Enter full address"
              multiline
              style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            />

            <Text style={styles.inputLabel}>City</Text>
            <TextInput value={editCity} onChangeText={setEditCity} placeholder="Enter city" style={styles.input} />

            <Pressable
              disabled={savingAddress}
              onPress={async () => {
                if (!editAddress.trim()) {
                  setError("Address is required");
                  return;
                }
                await saveAddressAndLocation({
                  newAddress: editAddress,
                  newCity: editCity,
                  newPosition: position,
                });
                setShowAddressModal(false);
              }}
              style={[styles.primaryBtn, savingAddress && { opacity: 0.7 }]}
            >
              <Text style={styles.primaryText}>{savingAddress ? "Saving..." : "Save"}</Text>
            </Pressable>

            <Pressable onPress={() => setShowAddressModal(false)} style={styles.outlineBtn}>
              <Text style={styles.outlineText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ✅ Placing Order Overlay */}
      {showPlacingOverlay && (
        <Animated.View style={[styles.placingOverlay, { opacity: overlayOpacity }]}>
          <View style={styles.placingCard}>
            {/* Checkmark icon */}
            <Animated.View
              style={[
                styles.placingIconCircle,
                {
                  transform: [{
                    scale: placingProgress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1, 1.1],
                    }),
                  }],
                },
              ]}
            >
              <Ionicons
                name="bag-check-outline"
                size={36}
                color="#fff"
              />
            </Animated.View>

            {/* Title */}
            <Text style={styles.placingTitle}>Placing your order</Text>
            <Text style={styles.placingSubtitle}>Please wait a moment...</Text>

            {/* Progress bar */}
            <View style={styles.placingBarTrack}>
              <Animated.View
                style={[
                  styles.placingBarFill,
                  {
                    width: placingProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>

            {/* Percentage text */}
            <Animated.Text style={styles.placingPercent}>
              {placingProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              })}
            </Animated.Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function Row({ label, value, isBold }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.rowLabel, isBold && { fontWeight: "900" }]}>{label}</Text>
      <Text style={[styles.rowValue, isBold && { fontWeight: "900" }]}>{value}</Text>
    </View>
  );
}

const GREEN = "#16A34A";     // main
const GREEN_DARK = "#0F7A34";
const GREEN_SOFT = "#DCFCE7";
const TEXT = "#111827";
const MUTED = "#6B7280";

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { alignItems: "center", justifyContent: "center", padding: 18, gap: 10 },

  muted: { color: MUTED },

  mapWrap: {
    margin: 12,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  markerPin: {
    width: 30,
    height: 40,
    backgroundColor: "#10B981",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 15,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  markerPinInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    transform: [{ rotate: "-45deg" }],
  },
  markerShadow: {
    width: 14,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 7,
    marginTop: -3,
  },
  locationBtn: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  locationBtnIcon: {
    fontSize: 16,
  },
  locationBtnText: {
    color: "#10B981",
    fontWeight: "700",
    fontSize: 13,
  },
  backBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 10,
  },
  mapBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    elevation: 3,
  },
  mapBtnText: { color: "#fff", fontWeight: "900" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 18,
    padding: 14,
    elevation: 2,
  },

  label: { fontSize: 12, color: MUTED },
  value: { marginTop: 2, fontSize: 15, fontWeight: "900", color: TEXT },

  sectionTitle: { fontSize: 14, fontWeight: "900", color: TEXT, marginBottom: 10 },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowLabel: { color: MUTED },
  rowValue: { color: TEXT, fontWeight: "800" },

  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 10 },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  infoDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },

  warn: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FEFCE8",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warnText: { color: "#92400E", fontWeight: "700" },

  errTitle: { fontSize: 20, fontWeight: "900", color: TEXT },
  errText: { color: "#DC2626", textAlign: "center" },

  errBox: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errBoxText: { color: "#B91C1C", fontWeight: "700" },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 12,
    paddingBottom: 18,
  },
  cta: {
    height: 54,
    borderRadius: 999,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  ctaDisabled: {
    backgroundColor: GREEN_SOFT,
  },
  ctaText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  tiny: { marginTop: 8, textAlign: "center", color: MUTED, fontSize: 11 },

  primaryBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  outlineBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  outlineText: { color: GREEN_DARK, fontWeight: "900" },

  successCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    elevation: 2,
  },
  successTitle: { fontSize: 20, fontWeight: "900", color: TEXT, marginTop: 10 },

  summaryBox: {
    marginTop: 14,
    width: "100%",
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  modalCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: TEXT, marginBottom: 10 },
  inputLabel: { color: MUTED, fontSize: 12, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },

  // Placing Order Overlay
  placingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  placingCard: {
    width: 280,
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  placingIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  placingTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: TEXT,
    marginBottom: 4,
  },
  placingSubtitle: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 24,
  },
  placingBarTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  placingBarFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 4,
  },
  placingPercent: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#10B981",
  },
});