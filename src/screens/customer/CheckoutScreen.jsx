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
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OSMMapView from "../../components/maps/OSMMapView";
import * as Location from "expo-location";
import { API_BASE_URL } from "../../constants/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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

      // Navigate to Order Tracking — reset stack so user can't go back to checkout
      const order = data.order;
      if (order?.id) {
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
              name: "OrderTracking",
              params: {
                orderId: order.id,
                status: "placed",
                order: order,
                totalAmount: finalTotal,
                restaurantName:
                  cart?.restaurant?.restaurant_name || order.restaurant_name,
                restaurantLogoUrl,
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
          <OSMMapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: position.latitude,
              longitude: position.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={isMapEditMode}
            zoomEnabled={isMapEditMode}
            onPress={(e) => {
              if (!isMapEditMode) return;
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setPosition({ latitude, longitude });
            }}
            markers={[
              {
                id: "delivery",
                coordinate: position,
                type: "customer",
                title: "Delivery Location",
                emoji: "📍",
              },
            ]}
          />

          {/* Find My Location Button */}
          <Pressable
            disabled={fetchingLocation}
            onPress={getCurrentLocation}
            style={[styles.locationBtn, fetchingLocation && { opacity: 0.7 }]}
          >
            {fetchingLocation ? (
              <ActivityIndicator size="small" color="#06C168" />
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

        {/* ✅ Address card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Delivery Address</Text>
              <Text style={styles.value}>{address || "Add delivery address"}</Text>
              {!!city && <Text style={styles.muted}>{city}</Text>}
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
        </View>

        {/* ✅ Phone */}
        <View style={styles.card}>
          <Text style={styles.label}>Phone Number</Text>
          <Text style={styles.value}>{phone || "No phone number"}</Text>
        </View>

        {/* ✅ Estimated */}
        <View style={styles.card}>
          <Text style={styles.label}>Estimated Delivery</Text>
          <Text style={styles.value}>
            {routeLoading ? "Calculating..." : routeInfo ? `~${Math.ceil(routeInfo.duration) + 15} mins` : "—"}
          </Text>
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
          <Text style={[styles.ctaText, (!isSubtotalValid || deliveryFee === null || routeLoading || placing || !phone || !address) && { color: "#6EDE9A" }]}>
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

const GREEN = "#06C168";     // main
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
});