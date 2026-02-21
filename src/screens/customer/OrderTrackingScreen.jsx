/**
 * Order Tracking Screen
 *
 * Shows order status with:
 * - Full-screen map background
 * - Floating back button
 * - Bottom sheet with order details
 * - Real-time updates via Supabase
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FreeMapView from "../../components/maps/FreeMapView";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import supabase from "../../services/supabaseClient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Status steps for progress tracking
const STATUS_STEPS = [
  { key: "placed", label: "Placed" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "picked_up", label: "Picked Up" },
  { key: "on_the_way", label: "On the Way" },
  { key: "delivered", label: "Delivered" },
];

export default function OrderTrackingScreen({ route, navigation }) {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewOrderExpanded, setViewOrderExpanded] = useState(false);

  // Animation for bottom sheet
  const [sheetAnim] = useState(new Animated.Value(0));

  // ============================================================================
  // FETCH ORDER DETAILS
  // ============================================================================

  const fetchOrder = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setOrder(data.order || data);
      } else {
        console.log("Failed to fetch order:", data.message);
      }
    } catch (error) {
      console.log("Fetch order error:", error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  // Animate bottom sheet on load
  useEffect(() => {
    if (!loading && order) {
      Animated.spring(sheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [loading, order]);

  // ============================================================================
  // SUPABASE REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (!supabase || !orderId) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          console.log("Order updated:", payload);
          setOrder((prev) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusIndex = (status) => {
    return STATUS_STEPS.findIndex((s) => s.key === status);
  };

  const formatPrice = (price) => {
    return `Rs. ${parseFloat(price || 0).toFixed(2)}`;
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      placed: "Order Placed!",
      accepted: "Order Accepted!",
      preparing: "Preparing Your Order",
      ready: "Order Ready!",
      picked_up: "Order Picked Up!",
      on_the_way: "On the Way!",
      delivered: "Delivered!",
      cancelled: "Order Cancelled",
      rejected: "Order Rejected",
    };
    return statusLabels[status] || "Order Placed!";
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorText}>Order not found</Text>
        <Pressable style={styles.errorButton} onPress={() => navigation.goBack()}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currentIndex = getStatusIndex(order.status);
  const totalSteps = 5; // Show 5 progress segments
  
  // Parse coordinates properly (they might be strings from API)
  const deliveryPosition = {
    latitude: parseFloat(order.delivery_latitude) || 7.8731,
    longitude: parseFloat(order.delivery_longitude) || 80.7718,
  };

  // Validate coordinates
  const isValidCoordinate = 
    !isNaN(deliveryPosition.latitude) && 
    !isNaN(deliveryPosition.longitude) &&
    deliveryPosition.latitude !== 0 &&
    deliveryPosition.longitude !== 0;

  const mapRegion = {
    latitude: isValidCoordinate ? deliveryPosition.latitude : 7.8731,
    longitude: isValidCoordinate ? deliveryPosition.longitude : 80.7718,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <View style={styles.container}>
      {/* Full Screen Map Background */}
      <FreeMapView
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}
        scrollEnabled={true}
        zoomEnabled={true}
        markers={isValidCoordinate ? [{
          id: 'delivery',
          coordinate: deliveryPosition,
          type: 'delivery',
          emoji: '📍',
        }] : []}
      />

      {/* Floating Back Button */}
      <SafeAreaView style={styles.floatingHeader} edges={["top"]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY }] },
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView
          style={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Status Title with Progress */}
          <View style={styles.headerSection}>
            {/* Progress Bar - 5 segments */}
            <View style={styles.progressContainer}>
              {[...Array(totalSteps)].map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressSegment,
                    index <= currentIndex && styles.progressSegmentActive,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.statusTitle}>{getStatusLabel(order.status)}</Text>
          </View>

          {/* Delivery Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DELIVERY DETAILS</Text>
            <Text style={styles.deliveryText}>
              {order.delivery_address
                ? `${order.delivery_address}, ${order.delivery_city || ""}`
                : "Your delivery location"}
            </Text>
            <Text style={styles.deliverySubtext}>
              Estimated delivery in ~{order.estimated_duration_min || 30} mins
            </Text>
          </View>

          {/* View Order Expandable */}
          <Pressable
            style={styles.expandableCard}
            onPress={() => setViewOrderExpanded(!viewOrderExpanded)}
          >
            <View style={styles.expandableRow}>
              <View style={styles.expandableIconWrap}>
                <Text style={styles.expandableIcon}>📋</Text>
              </View>
              <Text style={styles.expandableText}>View Order</Text>
              <Text style={styles.expandableArrow}>{viewOrderExpanded ? "∧" : "∨"}</Text>
            </View>

            {viewOrderExpanded && (
              <View style={styles.orderDetails}>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Order No</Text>
                  <Text style={styles.orderValue}>{order.order_number || order.id}</Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Items</Text>
                  <Text style={styles.orderValue}>
                    {order.order_items?.length || order.items_count || 0}
                  </Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Distance</Text>
                  <Text style={styles.orderValue}>{order.distance_km || 0} km</Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Est. Time</Text>
                  <Text style={styles.orderValue}>
                    ~{order.estimated_duration_min || 30} mins
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Order Items */}
                {order.order_items?.map((item, index) => (
                  <View key={item.id || index} style={styles.itemRow}>
                    {item.food_image_url ? (
                      <Image source={{ uri: item.food_image_url }} style={styles.itemImage} />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Text>🍽️</Text>
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.food_name}
                      </Text>
                      <Text style={styles.itemSize}>
                        {item.size} × {item.quantity}
                      </Text>
                    </View>
                    <Text style={styles.itemPrice}>{formatPrice(item.total_price)}</Text>
                  </View>
                ))}

                <View style={styles.divider} />

                {/* Pricing */}
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Subtotal</Text>
                  <Text style={styles.orderValue}>{formatPrice(order.subtotal)}</Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Delivery Fee</Text>
                  <Text style={styles.orderValue}>{formatPrice(order.delivery_fee)}</Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Service Fee</Text>
                  <Text style={styles.orderValue}>{formatPrice(order.service_fee)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.orderRow}>
                  <Text style={[styles.orderLabel, styles.totalLabel]}>Total</Text>
                  <Text style={[styles.orderValue, styles.totalValue]}>
                    {formatPrice(order.total_amount)}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* Restaurant Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RESTAURANT</Text>
            <View style={styles.restaurantCard}>
              {order.restaurant_logo_url ? (
                <Image
                  source={{ uri: order.restaurant_logo_url }}
                  style={styles.restaurantLogo}
                />
              ) : (
                <View style={styles.restaurantLogoFallback}>
                  <Text style={styles.restaurantLogoText}>
                    {(order.restaurant_name || "R").charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={styles.restaurantName} numberOfLines={1}>
                {order.restaurant_name || "Restaurant"}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            <Pressable
              style={styles.homeButton}
              onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
            >
              <Text style={styles.homeButtonText}>Back to Home</Text>
            </Pressable>
          </View>

          {/* Bottom padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: "#6B7280",
    marginBottom: 24,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#10B981",
    borderRadius: 24,
  },
  errorButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  // Map
  map: {
    ...StyleSheet.absoluteFillObject,
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

  // Floating Header
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonText: {
    fontSize: 22,
    color: "#111827",
    fontWeight: "600",
  },

  // Bottom Sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Header Section
  headerSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  progressContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  progressSegment: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: "#10B981",
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  deliveryText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
    fontWeight: "500",
  },
  deliverySubtext: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },

  // Expandable Card
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
  expandableIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#E0F2F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  expandableIcon: {
    fontSize: 18,
  },
  expandableText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  expandableArrow: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  // Order Details (expanded)
  orderDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  totalLabel: {
    fontWeight: "700",
    color: "#111827",
  },
  totalValue: {
    fontWeight: "800",
    color: "#10B981",
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },

  // Item Row
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  itemImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  itemSize: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },

  // Restaurant Card
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  restaurantLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  restaurantLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  restaurantLogoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B7280",
  },
  restaurantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  // Buttons
  buttonsContainer: {
    marginTop: 10,
  },
  homeButton: {
    height: 52,
    backgroundColor: "#10B981",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
