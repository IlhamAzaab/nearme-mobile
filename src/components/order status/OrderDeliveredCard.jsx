// src/screens/customer/OrderTrackingScreen.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
  ScrollView,
} from "react-native";

import { ORDER_STATUSES } from "../../config/orderStatus.config";
import { fetchDeliveryStatus } from "../../services/api/orders.api";

// Status cards
import PlacingOrderCard from "../../components/order-status/PlacingOrderCard";
import DriverAcceptedCard from "../../components/order-status/DriverAcceptedCard";
import OrderReceivedCard from "../../components/order-status/OrderReceivedCard";
import OrderPickedUpCard from "../../components/order-status/OrderPickedUpCard";
import OrderOnTheWayCard from "../../components/order-status/OrderOnTheWayCard";
import OrderDeliveredCard from "../../components/order-status/OrderDeliveredCard";

export default function OrderTrackingScreen({ route, navigation }) {
  const orderId = route?.params?.orderId;

  const initialStatus = route?.params?.deliveryStatus || ORDER_STATUSES.PLACED;

  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [orderData, setOrderData] = useState(route?.params || {});
  const [restaurantLogo, setRestaurantLogo] = useState(
    route?.params?.restaurantLogo || null
  );
  const [imageError, setImageError] = useState(false);

  // Animation
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const animateStatusChange = useCallback(() => {
    fade.setValue(0);
    slide.setValue(8);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const handleStatusChange = useCallback(
    (newStatus) => {
      if (!newStatus || newStatus === currentStatus) return;
      setCurrentStatus(newStatus);
      animateStatusChange();
    },
    [currentStatus, animateStatusChange]
  );

  const handleImageError = () => setImageError(true);

  // Poll delivery status (every 2 seconds)
  useEffect(() => {
    if (!orderId) return;

    let mounted = true;

    const pollStatus = async () => {
      try {
        const data = await fetchDeliveryStatus(orderId);
        if (!mounted) return;

        const newStatus = data?.status;

        // Merge full payload (so cards can read fields like etaMinutes, prepTime...)
        setOrderData((prev) => ({ ...prev, ...data }));

        // Restaurant logo update
        if (data?.restaurantLogo && !restaurantLogo) {
          setRestaurantLogo(data.restaurantLogo);
          setImageError(false);
        }

        if (newStatus && newStatus !== currentStatus) {
          handleStatusChange(newStatus);
        }
      } catch (err) {
        console.log("Error polling status:", err?.message || err);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    pollStatus();

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [orderId, currentStatus, restaurantLogo, handleStatusChange]);

  // Render correct card for current status
  const renderStatusCard = () => {
    switch (currentStatus) {
      case ORDER_STATUSES.PLACED:
        return (
          <PlacingOrderCard restaurantName={orderData?.restaurantName} />
        );

      case ORDER_STATUSES.DRIVER_ACCEPTED:
        return (
          <DriverAcceptedCard
            driverName={orderData?.driverName || orderData?.driver?.name}
            vehicleNumber={orderData?.vehicleNumber || orderData?.driver?.vehicleNumber}
          />
        );

      case ORDER_STATUSES.RECEIVED:
        return (
          <OrderReceivedCard
            restaurantName={orderData?.restaurantName}
            prepTime={orderData?.prepTime || orderData?.prepTimeMins}
          />
        );

      case ORDER_STATUSES.PICKED_UP:
        return (
          <OrderPickedUpCard pickedUpTime={orderData?.pickedUpTime} />
        );

      case ORDER_STATUSES.ON_THE_WAY:
        return (
          <OrderOnTheWayCard
            etaMinutes={orderData?.etaMinutes}
            distanceKm={orderData?.distanceKm}
          />
        );

      case ORDER_STATUSES.DELIVERED:
        return (
          <OrderDeliveredCard deliveredTime={orderData?.deliveredTime} />
        );

      default:
        return (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>Tracking...</Text>
          </View>
        );
    }
  };

  // Dev controls
  const isDev = __DEV__;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Simple header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <Text style={styles.headerSub}>
            Order ID: {orderId || "N/A"} | Status: {currentStatus}
          </Text>
        </View>

        {/* Status card with animation */}
        <Animated.View
          style={[
            styles.animatedWrap,
            { opacity: fade, transform: [{ translateY: slide }] },
          ]}
        >
          {renderStatusCard()}
        </Animated.View>

        {/* Optional: If you want logo info available to cards later */}
        {/* restaurantLogo, imageError, handleImageError already tracked */}
      </ScrollView>

      {isDev && (
        <View style={styles.devPanel}>
          <Text style={styles.devTitle}>Status Controls:</Text>

          <View style={styles.devButtonsWrap}>
            {Object.values(ORDER_STATUSES).map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => handleStatusChange(status)}
                style={[
                  styles.devBtn,
                  currentStatus === status ? styles.devBtnActive : null,
                ]}
              >
                <Text style={styles.devBtnText}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 16, paddingBottom: 120 },

  header: { marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerSub: { marginTop: 6, fontSize: 12, color: "#666" },

  animatedWrap: { flex: 1 },

  fallback: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#fff",
    elevation: 3,
    marginTop: 10,
    alignItems: "center",
  },
  fallbackText: { fontSize: 14, color: "#555" },

  devPanel: {
    position: "absolute",
    left: 12,
    bottom: 20,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 10,
    borderRadius: 10,
  },
  devTitle: { color: "white", fontSize: 12, marginBottom: 8 },
  devButtonsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  devBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#374151",
    marginRight: 6,
    marginBottom: 6,
  },
  devBtnActive: { backgroundColor: "#22C55E" },
  devBtnText: { color: "white", fontSize: 11 },
});