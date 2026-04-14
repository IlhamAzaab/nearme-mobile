import { useFocusEffect } from "@react-navigation/native";
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
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
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OSMMapView from "../../components/maps/OSMMapView";
import * as Location from "expo-location";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import {
  calculateDeliveryFee as calculateDeliveryFeeFromConfig,
  calculateServiceFee as calculateServiceFeeFromConfig,
  fetchPublicFeeConfig,
  resolveMinimumSubtotal,
} from "../../lib/feeConfig";
import { fetchOSRMRoute } from "../../utils/osrmClient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const BIKE_SPEED_KMPH = 24;
const NIGHT_START_HOUR = 20;
const NIGHT_END_HOUR = 6;
const CHECKOUT_ADDRESS_PIN_HTML =
  "<div style='width:44px;height:44px;display:flex;align-items:center;justify-content:center;'>" +
  "<svg width='44' height='44' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' aria-label='delivery pin'>" +
  "<path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#E11D48'/>" +
  "<circle cx='12' cy='9' r='3' fill='#FFFFFF'/>" +
  "</svg>" +
  "</div>";
const DEFAULT_CHECKOUT_POSITION = {
  latitude: 7.8731,
  longitude: 80.7718,
};

function hasValidCoordinates(latitude, longitude) {
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

// ============================================================================
// OSRM route distance
// ============================================================================
async function calculateRouteDistance(lat1, lon1, lat2, lon2) {
  try {
    const route = await fetchOSRMRoute({
      from: { latitude: lat1, longitude: lon1 },
      to: { latitude: lat2, longitude: lon2 },
      profile: "foot",
      retries: 2,
      timeoutMs: 10000,
      overview: "false",
      geometries: "geojson",
    });

    if (
      route &&
      Number.isFinite(route.distance) &&
      Number.isFinite(route.duration)
    ) {
      return {
        success: true,
        distance: route.distance / 1000,
        duration: route.duration / 60,
      };
    }
    return { success: false, error: "No route found" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

const ORDER_TOTAL_CACHE_KEY = "@order_display_totals";

async function cacheOrderDisplayTotal(orderId, totalAmount) {
  if (!orderId) return;

  const total = Number(totalAmount);
  if (!Number.isFinite(total)) return;

  try {
    const raw = await AsyncStorage.getItem(ORDER_TOTAL_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(orderId)] = total;
    await AsyncStorage.setItem(ORDER_TOTAL_CACHE_KEY, JSON.stringify(map));
  } catch (e) {
    // no-op
  }
}

function resolveOrderDisplayTotal(orderLike, fallback = 0) {
  const candidates = [
    orderLike?.grand_total,
    orderLike?.final_total,
    orderLike?.payable_amount,
    orderLike?.total_amount,
    orderLike?.total,
    fallback,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const n = Number(candidates[i]);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}

export default function CheckoutScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
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

  const [position, setPosition] = useState(DEFAULT_CHECKOUT_POSITION);
  const [hasExplicitDeliveryLocation, setHasExplicitDeliveryLocation] =
    useState(false);

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
  const [isOrderSummaryExpanded, setIsOrderSummaryExpanded] = useState(false);
  const [feeConfig, setFeeConfig] = useState(null);

  // Payment
  const [paymentMethod] = useState("cash");

  // Order
  const [placing, setPlacing] = useState(false);

  const MINIMUM_SUBTOTAL = 300;
  const PRIORITY_FEE = 49;

  useEffect(() => {
    fetchPublicFeeConfig()
      .then((data) => setFeeConfig(data || null))
      .catch((err) => console.error("Failed to load fee config:", err));
  }, []);

  const calculateServiceFee = (subtotal) => {
    return calculateServiceFeeFromConfig(subtotal, feeConfig || undefined);
  };

  const calculateDeliveryFee = (distanceKm) => {
    return calculateDeliveryFeeFromConfig(distanceKm, feeConfig || undefined);
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

  // Sync address changes automatically when screen focuses
  useFocusEffect(
    useCallback(() => {
      const checkSavedAddress = async () => {
        try {
          const savedStr = await AsyncStorage.getItem("@saved_address");
          if (savedStr) {
            const saved = JSON.parse(savedStr);
            if (hasValidCoordinates(saved.latitude, saved.longitude)) {
              setPosition({
                latitude: Number(saved.latitude),
                longitude: Number(saved.longitude),
              });
              setHasExplicitDeliveryLocation(true);
              if (saved.label) {
                setAddress(String(saved.label));
              }
              if (saved.city) {
                setCity(String(saved.city));
              }
              // Animate map to new saved pin location
              if (mapRef.current?.animateToRegion) {
                mapRef.current.animateToRegion({
                  latitude: Number(saved.latitude),
                  longitude: Number(saved.longitude),
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
              } else if (mapRef.current?.panTo) {
                mapRef.current.panTo(
                  Number(saved.latitude),
                  Number(saved.longitude),
                  15,
                );
              }
            }
          }
        } catch (error) {
          console.error("Error reading saved address on checkout:", error);
        }
      };

      checkSavedAddress();
    }, []),
  );

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
          [{ text: "OK" }],
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
      setHasExplicitDeliveryLocation(true);

      // Animate map to new location
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...newPosition,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          1000,
        );
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
      if (
        !hasExplicitDeliveryLocation ||
        !position ||
        !cart?.restaurant?.latitude ||
        !cart?.restaurant?.longitude ||
        !hasValidCoordinates(position.latitude, position.longitude) ||
        !hasValidCoordinates(
          cart.restaurant.latitude,
          cart.restaurant.longitude,
        )
      ) {
        setRouteLoading(false);
        setRouteInfo(null);
        return;
      }

      setRouteLoading(true);
      const result = await calculateRouteDistance(
        position.latitude,
        position.longitude,
        parseFloat(cart.restaurant.latitude),
        parseFloat(cart.restaurant.longitude),
      );

      if (result.success)
        setRouteInfo({ distance: result.distance, duration: result.duration });
      else setRouteInfo(null);

      setRouteLoading(false);
    };

    run();
  }, [
    hasExplicitDeliveryLocation,
    position,
    cart?.restaurant?.latitude,
    cart?.restaurant?.longitude,
  ]);

  const fetchCheckoutData = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getAccessToken();
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
        fetch(`${API_BASE_URL}/cart`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/cart/customer-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const cartData = await cartRes.json().catch(() => ({}));
      const profileData = await profileRes.json().catch(() => ({}));

      if (!cartRes.ok)
        throw new Error(cartData.message || "Failed to fetch cart");
      if (!profileRes.ok)
        throw new Error(profileData.message || "Failed to fetch profile");

      // cartId match (string vs number fix)
      const selected = (cartData.carts || []).find(
        (c) => String(c.id) === String(cartId),
      );
      if (!selected) throw new Error("Cart not found");

      setCart(selected);

      if (profileData.customer) {
        const profilePhone = profileData.customer.phone || "";
        const profileAddress = String(
          profileData.customer.address || "",
        ).trim();
        const profileCity = String(profileData.customer.city || "").trim();
        const profileLat = Number(profileData.customer.latitude);
        const profileLng = Number(profileData.customer.longitude);

        setPhone(profilePhone);
        setAddress(profileAddress);
        setCity(profileCity);
        setHasExplicitDeliveryLocation(false);

        // Prefer AsyncStorage saved address if user updated it
        const savedAddressStr = await AsyncStorage.getItem("@saved_address");
        if (savedAddressStr) {
          const saved = JSON.parse(savedAddressStr);
          if (saved.label && !profileAddress) {
            setAddress(String(saved.label));
          }
          if (saved.city && !profileCity) {
            setCity(String(saved.city));
          }
          if (hasValidCoordinates(saved.latitude, saved.longitude)) {
            setPosition({
              latitude: Number(saved.latitude),
              longitude: Number(saved.longitude),
            });
            setHasExplicitDeliveryLocation(true);
          } else if (hasValidCoordinates(profileLat, profileLng)) {
            setPosition({ latitude: profileLat, longitude: profileLng });
            setHasExplicitDeliveryLocation(true);
          }
        } else {
          if (hasValidCoordinates(profileLat, profileLng)) {
            setPosition({
              latitude: profileLat,
              longitude: profileLng,
            });
            setHasExplicitDeliveryLocation(true);
          }
        }
      }
    } catch (e) {
      setError(e.message || "Checkout load failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAddressAndLocation = async ({
    newAddress,
    newCity,
    newPosition,
  }) => {
    try {
      setSavingAddress(true);
      const token = await getAccessToken();

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
      setHasExplicitDeliveryLocation(true);
      setError("");
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    try {
      if (!phone) throw new Error("Phone number is required");
      if (!String(address || "").trim())
        throw new Error("Delivery address is required");
      if (!String(city || "").trim()) throw new Error("City is required");
      if (!hasExplicitDeliveryLocation || !position)
        throw new Error("Please set delivery pin before placing order");
      if (!cart) throw new Error("Cart missing");

      const subtotal = Number(cart.cart_total) || 0;
      if (!routeInfo)
        throw new Error("Please wait for delivery fee calculation");
      if (!isDistanceWithinLimit)
        throw new Error(
          `This location is outside delivery range (${maxOrderDistanceKm} km).`,
        );

      const requiredMinSubtotal = resolveMinimumSubtotal(
        routeInfo.distance,
        feeConfig || undefined,
      );
      if (subtotal < requiredMinSubtotal)
        throw new Error(`Minimum order amount is Rs. ${requiredMinSubtotal}`);

      setPlacing(true);
      setError("");

      const token = await getAccessToken();
      const deliveryCity = String(city || "").trim();

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
          delivery_city: deliveryCity,
          payment_method: paymentMethod,
          distance_km: routeInfo.distance,
          estimated_duration_min:
            estimatedDeliveryWindow?.midpoint ||
            Math.ceil(routeInfo.duration || 0),
          checkout_subtotal: subtotal,
          checkout_service_fee: serviceFee,
          checkout_delivery_fee: deliveryFee,
          checkout_total_amount: finalTotal,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to place order");

      // Navigate to Order Tracking — reset stack so user can't go back to checkout
      const order = data.order;
      if (order?.id) {
        const displayTotal = resolveOrderDisplayTotal(order, finalTotal);
        await cacheOrderDisplayTotal(order.id, displayTotal);

        // Get restaurant logo from cart data to pass to tracking screen
        const restaurantLogoUrl =
          cart?.restaurant?.logo_url ||
          cart?.restaurant?.restaurant_logo_url ||
          cart?.restaurant?.restaurant_logo ||
          cart?.restaurant?.image_url ||
          order.restaurant_logo_url ||
          order.restaurant_logo ||
          "";

        navigation.reset({
          index: 1,
          routes: [
            { name: "MainTabs" },
            {
              name: "PlacingOrder",
              params: {
                orderId: order.id,
                status: "placed",
                order: order,
                totalAmount: displayTotal,
                restaurantName:
                  cart?.restaurant?.restaurant_name || order.restaurant_name,
                restaurantLogoUrl,
                statusScreenMode: true,
              },
            },
          ],
        });
      }
    } catch (e) {
      setError(e.message || "Place order failed");
    } finally {
      setPlacing(false);
    }
  };

  const subtotal = useMemo(
    () => (cart ? Number(cart.cart_total) || 0 : 0),
    [cart],
  );
  const serviceFee = useMemo(
    () => calculateServiceFee(subtotal),
    [subtotal, feeConfig],
  );
  const deliveryFee = useMemo(
    () => (routeInfo ? calculateDeliveryFee(routeInfo.distance) : null),
    [routeInfo, feeConfig],
  );

  const estimatedDeliveryWindow = useMemo(() => {
    if (!routeInfo?.distance) return null;

    const distanceKm = Number(routeInfo.distance);
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;

    const bikeMinutes = (distanceKm / BIKE_SPEED_KMPH) * 60;
    const hour = new Date().getHours();
    const isNight = hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;

    const prepMin = isNight ? 20 : 15;
    const prepMax = isNight ? 25 : 20;

    const min = Math.max(1, Math.ceil(bikeMinutes + prepMin));
    const max = Math.max(min, Math.ceil(bikeMinutes + prepMax));

    return {
      min,
      max,
      midpoint: Math.round((min + max) / 2),
    };
  }, [routeInfo]);

  const requiredMinSubtotal = useMemo(
    () =>
      routeInfo
        ? resolveMinimumSubtotal(routeInfo.distance, feeConfig || undefined)
        : MINIMUM_SUBTOTAL,
    [routeInfo, feeConfig],
  );

  const maxOrderDistanceKm = useMemo(() => {
    const maxDistance = Number(feeConfig?.max_order_distance_km);
    return Number.isFinite(maxDistance) ? maxDistance : 25;
  }, [feeConfig]);

  const isDistanceWithinLimit = useMemo(() => {
    if (!routeInfo?.distance) return false;
    const distance = Number(routeInfo.distance);
    return Number.isFinite(distance) && distance <= maxOrderDistanceKm;
  }, [routeInfo, maxOrderDistanceKm]);

  const isSubtotalValid = subtotal >= requiredMinSubtotal;

  const totalAmount = useMemo(() => {
    if (!isSubtotalValid || deliveryFee === null) return null;
    return subtotal + serviceFee + deliveryFee;
  }, [subtotal, serviceFee, deliveryFee, isSubtotalValid]);

  const finalTotal = useMemo(() => {
    if (totalAmount === null) return null;
    // keep priority off for now (you can add toggle later)
    return totalAmount;
  }, [totalAmount]);

  const isLocationDetailsComplete = useMemo(
    () =>
      Boolean(phone) &&
      Boolean(String(address || "").trim()) &&
      Boolean(String(city || "").trim()) &&
      hasExplicitDeliveryLocation,
    [phone, address, city, hasExplicitDeliveryLocation],
  );

  const isPlaceOrderDisabled =
    !isSubtotalValid ||
    !isDistanceWithinLimit ||
    deliveryFee === null ||
    routeLoading ||
    placing ||
    !isLocationDetailsComplete ||
    !routeInfo;

  // ✅ Loading / Error
  if (loading) {
    return (
      <View style={styles.page}>
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {/* Map Skeleton */}
          <SkeletonBlock
            width="100%"
            height={200}
            borderRadius={18}
            style={{ marginBottom: 12 }}
          />

          {/* Address Card Skeleton */}
          <View style={[styles.card, { marginTop: 0 }]}>
            <SkeletonBlock
              width="40%"
              height={20}
              style={{ marginBottom: 8 }}
            />
            <SkeletonBlock
              width="70%"
              height={16}
              style={{ marginBottom: 4 }}
            />
            <SkeletonBlock width="50%" height={14} />
          </View>

          {/* Phone Skeleton */}
          <View style={styles.card}>
            <SkeletonBlock
              width="30%"
              height={20}
              style={{ marginBottom: 8 }}
            />
            <SkeletonBlock width="60%" height={16} />
          </View>

          {/* Estimated Skeleton */}
          <View style={styles.card}>
            <SkeletonBlock
              width="40%"
              height={20}
              style={{ marginBottom: 8 }}
            />
            <SkeletonBlock width="35%" height={16} />
          </View>

          {/* Summary Skeleton */}
          <View style={styles.card}>
            <SkeletonBlock
              width="45%"
              height={20}
              style={{ marginBottom: 12 }}
            />
            <SkeletonBlock width="100%" height={60} borderRadius={12} />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (error && !cart) {
    return (
      <View style={[styles.page, styles.center]}>
        <Text style={styles.errTitle}>Error</Text>
        <Text style={styles.errText}>{error}</Text>
        <Pressable
          onPress={() => navigation.navigate("MainTabs", { screen: "Cart" })}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryText}>Back to Cart</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 110 + Math.max(0, insets.bottom),
        }}
      >
        {/* ✅ Map */}
        <View style={[styles.mapWrap, { height: 200 }]}>
          <OSMMapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: position.latitude,
              longitude: position.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={true}
            zoomEnabled={true}
            markers={[
              {
                id: "delivery",
                coordinate: position,
                type: "customer",
                title: "Delivery Location",
                emoji: "",
                customHtml: CHECKOUT_ADDRESS_PIN_HTML,
                iconOnly: true,
                iconSize: [44, 44],
                iconAnchor: [22, 44],
              },
            ]}
          />

          {/* Edit Pin Button */}
          <Pressable
            onPress={() => navigation.navigate("AddressPicker")}
            style={styles.mapBtn}
          >
            <Text style={styles.mapBtnText}>Edit Pin</Text>
          </Pressable>
        </View>

        {/* ✅ Address card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.iconContainer}>
              <Feather name="map-pin" size={20} color="#06C168" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Delivery Address</Text>
              <Text style={styles.value}>
                {address || "Add delivery address"}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setEditAddress(address);
                setEditCity(city);
                setShowAddressModal(true);
              }}
              style={styles.iconBtn}
            >
              <Feather name="edit-2" size={16} color="#06C168" />
            </Pressable>
          </View>
        </View>

        {/* ✅ Phone */}
        <View style={styles.card}>
          <View style={styles.rowInfo}>
            <View style={styles.iconContainer}>
              <Feather name="phone-call" size={20} color="#06C168" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.value}>{phone || "No phone number"}</Text>
            </View>
          </View>
        </View>

        {/* ✅ Estimated */}
        <View style={styles.card}>
          <View style={styles.rowInfo}>
            <View style={styles.iconContainer}>
              <Feather name="clock" size={20} color="#06C168" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Estimated Delivery</Text>
              <Text style={styles.value}>
                {routeLoading
                  ? "Calculating..."
                  : !hasExplicitDeliveryLocation
                    ? "Set your delivery pin"
                    : estimatedDeliveryWindow
                      ? `${estimatedDeliveryWindow.min}-${estimatedDeliveryWindow.max} mins`
                      : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* ✅ Order Summary */}
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={styles.sectionTitleNoMargin}>Order Summary</Text>
          </View>

          <View style={styles.summaryBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>
                {cart?.restaurant?.restaurant_name || "Restaurant"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 2,
                }}
              >
                <Feather name="map-pin" size={12} color="#06C168" />
                <Text
                  style={[
                    styles.muted,
                    { fontSize: 12, marginLeft: 4, color: "#06C168" },
                  ]}
                >
                  {routeInfo
                    ? `${routeInfo.distance.toFixed(1)} km away`
                    : hasExplicitDeliveryLocation
                      ? "Calculating..."
                      : "Set pin to calculate"}
                </Text>
              </View>
              <Text style={[styles.muted, { fontSize: 13, marginTop: 4 }]}>
                {cart?.items?.length || 0} item
                {cart?.items?.length !== 1 ? "s" : ""} • {formatPrice(subtotal)}
              </Text>
            </View>
            <Pressable
              onPress={() => setIsOrderSummaryExpanded((prev) => !prev)}
              style={styles.summaryToggleBtn}
            >
              <Feather
                name={isOrderSummaryExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#6b7280"
              />
            </Pressable>
          </View>

          {isOrderSummaryExpanded && (
            <View style={styles.orderItemsWrap}>
              {(cart?.items || []).length > 0 ? (
                (cart?.items || []).map((item, idx) => {
                  const itemName =
                    item?.food_name || item?.name || `Item ${idx + 1}`;
                  const qty = Number(item?.quantity) || 1;
                  const unitPrice = Number(
                    item?.unit_price ?? item?.price ?? 0,
                  );

                  return (
                    <View
                      key={item?.id || `${itemName}-${idx}`}
                      style={[
                        styles.orderItemRow,
                        idx === (cart?.items || []).length - 1 &&
                          styles.orderItemLastRow,
                      ]}
                    >
                      <View style={styles.orderItemInfo}>
                        <Text numberOfLines={1} style={styles.orderItemName}>
                          {itemName}
                        </Text>
                        <Text style={styles.orderItemMeta}>
                          {qty} x {formatPrice(unitPrice)}
                        </Text>
                      </View>
                      <Text style={styles.orderItemTotal}>
                        {formatPrice(unitPrice * qty)}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.orderItemEmpty}>
                  No items found in this cart.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ✅ Payment Method */}
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={styles.sectionTitleNoMargin}>Payment Method</Text>
          </View>

          <View style={styles.summaryBox}>
            <View style={styles.iconContainer}>
              <Ionicons name="cash-outline" size={24} color="#06C168" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>Cash on Delivery</Text>
              <Text style={[styles.muted, { fontSize: 12 }]}>
                Pay when your order arrives
              </Text>
            </View>
          </View>
        </View>

        {/* ✅ Price summary */}
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <MaterialIcons
              name="receipt-long"
              size={20}
              color="#06C168"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.sectionTitleNoMargin}>Price Details</Text>
          </View>

          <Row label="Subtotal" value={formatPrice(subtotal)} />
          <Row
            label="Delivery fee"
            value={
              routeLoading
                ? "..."
                : deliveryFee !== null
                  ? formatPrice(deliveryFee)
                  : "--"
            }
          />
          <Row label="Service fee" value={formatPrice(serviceFee)} />

          <View style={styles.divider} />
          <Row
            label="Total"
            value={finalTotal !== null ? formatPrice(finalTotal) : "--"}
            isBold
          />
        </View>

        {!isSubtotalValid && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              Minimum order: Rs. {requiredMinSubtotal}. Add Rs.{" "}
              {(requiredMinSubtotal - subtotal).toFixed(0)} more.
            </Text>
          </View>
        )}

        {!hasExplicitDeliveryLocation && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              Set your delivery pin for first order before placing this order.
            </Text>
          </View>
        )}

        {hasExplicitDeliveryLocation && !String(city || "").trim() && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              City is required to place the order.
            </Text>
          </View>
        )}

        {routeInfo && !isDistanceWithinLimit && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              Delivery not available for this distance (
              {routeInfo.distance.toFixed(1)}
              km). Maximum allowed is {maxOrderDistanceKm} km.
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
      <View
        style={[
          styles.bottomBar,
          { bottom: 0, paddingBottom: 14 + Math.max(0, insets.bottom) },
        ]}
      >
        <Pressable
          onPress={handlePlaceOrder}
          disabled={isPlaceOrderDisabled}
          style={[styles.cta, isPlaceOrderDisabled && styles.ctaDisabled]}
        >
          <Text
            style={[
              styles.ctaText,
              isPlaceOrderDisabled && { color: "#6EDE9A" },
            ]}
          >
            {placing
              ? "Placing..."
              : routeLoading
                ? "Calculating..."
                : !hasExplicitDeliveryLocation
                  ? "Set delivery pin to continue"
                  : !String(city || "").trim()
                    ? "Add city to continue"
                    : !isDistanceWithinLimit && routeInfo
                      ? `Not available beyond ${maxOrderDistanceKm} km`
                      : !isSubtotalValid
                        ? `Add Rs. ${(requiredMinSubtotal - subtotal).toFixed(0)} more`
                        : finalTotal !== null
                          ? `Place Order • ${formatPrice(finalTotal)}`
                          : "Place Order"}
          </Text>
        </Pressable>
      </View>

      {/* ✅ Address Modal */}
      <Modal transparent visible={showAddressModal} animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowAddressModal(false)}
          />
          <ScrollView
            style={styles.modalSheet}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
              <TextInput
                value={editCity}
                onChangeText={setEditCity}
                placeholder="Enter city"
                style={styles.input}
              />

              <Pressable
                disabled={savingAddress}
                onPress={async () => {
                  if (!editAddress.trim()) {
                    setError("Address is required");
                    return;
                  }
                  if (!editCity.trim()) {
                    setError("City is required");
                    return;
                  }
                  if (!hasExplicitDeliveryLocation) {
                    setError("Please set delivery pin first using Edit Pin");
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
                <Text style={styles.primaryText}>
                  {savingAddress ? "Saving..." : "Save"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowAddressModal(false)}
                style={styles.outlineBtn}
              >
                <Text style={styles.outlineText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value, isBold }) {
  return (
    <View style={[styles.rowBetween, { marginBottom: 8 }]}>
      <Text
        style={[styles.rowLabel, isBold && { fontWeight: "900", color: TEXT }]}
      >
        {label}
      </Text>
      <Text
        style={[styles.rowValue, isBold && { fontWeight: "900", color: TEXT }]}
      >
        {value}
      </Text>
    </View>
  );
}

const GREEN = "#06C168"; // main
const GREEN_DARK = "#0F7A34";
const GREEN_SOFT = "#DCFCE7";
const TEXT = "#111827";
const MUTED = "#6B7280";

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F9FAFB" },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 10,
  },

  muted: { color: MUTED },

  mapWrap: {
    margin: 12,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
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
    color: "#06C168",
    fontWeight: "700",
    fontSize: 13,
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
  value: { marginTop: 2, fontSize: 15, fontWeight: "700", color: TEXT },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT,
    marginBottom: 10,
  },
  sectionTitleNoMargin: { fontSize: 16, fontWeight: "900", color: TEXT },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { color: MUTED, fontSize: 14 },
  rowValue: { color: TEXT, fontWeight: "700", fontSize: 14 },

  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DCFCE7", // soft green
    alignItems: "center",
    justifyContent: "center",
  },

  iconContainer: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },

  summaryBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb", // soft gray bg
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },

  summaryToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  orderItemsWrap: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
  },

  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  orderItemLastRow: {
    borderBottomWidth: 0,
  },

  orderItemInfo: {
    flex: 1,
    marginRight: 12,
  },

  orderItemName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
  },

  orderItemMeta: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },

  orderItemTotal: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "800",
  },

  orderItemEmpty: {
    color: MUTED,
    fontSize: 13,
    paddingVertical: 12,
  },

  restaurantIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  restaurantIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
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

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalSheet: { maxHeight: "85%" },
  modalScrollContent: { paddingBottom: 16 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT,
    marginBottom: 10,
  },
  inputLabel: { color: MUTED, fontSize: 12, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
});
