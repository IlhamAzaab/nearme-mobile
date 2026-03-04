/**
 * Order Tracking Screen — Website-matching Design
 *
 * Always shows map background with:
 *   - Restaurant & customer markers + dashed route polyline
 *   - Cooking animation overlay for preparing statuses
 *   - Smooth bottom sheet card with status, ETA, progress, details
 *
 * Statuses: placed → pending/received → accepted → picked_up → on_the_way → delivered
 * Polls GET /orders/{orderId}/delivery-status every 2s
 */

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import FreeMapView from "../../components/maps/FreeMapView";
import { API_BASE_URL } from "../../constants/api";

const { width: SW, height: SH } = Dimensions.get("window");

// =============================================================================
// CONSTANTS
// =============================================================================

const PROGRESS_STEPS = [
  { key: "received", label: "Received" },
  { key: "accepted", label: "Accepted" },
  { key: "picked_up", label: "Picked Up" },
  { key: "on_the_way", label: "On the Way" },
  { key: "delivered", label: "Delivered" },
];

const STEP_INDEX = {
  placed: -1,
  pending: 0,
  received: 0,
  accepted: 1,
  picked_up: 2,
  on_the_way: 3,
  delivered: 4,
};

/** Statuses that show the cooking animation overlay */
const COOKING_STATUSES = new Set(["placed", "pending", "received"]);

const STATUS_TEXT = {
  placed: {
    title: "Order Placed!",
    subtitle: "We've received your order and notifying the restaurant.",
  },
  pending: {
    title: "Preparing your order...",
    subtitle: "The restaurant is cooking your meal with care.",
  },
  received: {
    title: "Preparing your order...",
    subtitle: "The restaurant is cooking your meal with care.",
  },
  accepted: {
    title: "Driver on the way!",
    subtitle: "A driver is heading to pick up your order.",
  },
  picked_up: {
    title: "Order picked up!",
    subtitle: "Your driver has your food and is on the way.",
  },
  on_the_way: {
    title: "Almost there!",
    subtitle: "Your driver is heading to your location.",
  },
  delivered: {
    title: "Order Delivered!",
    subtitle: "Enjoy your meal! Thank you for ordering with NearMe.",
  },
};

const POLL_INTERVAL = 2000;

// =============================================================================
// POLYLINE DECODER (OSRM encoded polyline → coordinates)
// =============================================================================

function decodePolyline(encoded) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coordinates;
}

/** Format ETA as clock time (e.g. "12:30 PM") */
function getFormattedETA(minMinutes, maxMinutes) {
  const now = new Date();
  const avgMin = Math.round((minMinutes + maxMinutes) / 2);
  const arrival = new Date(now.getTime() + avgMin * 60000);
  let h = arrival.getHours();
  const m = arrival.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/* ─── Animated Segment (progress bar fill) ─── */
const AnimatedSegment = React.memo(({ active, done }) => {
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      fillAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(fillAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(fillAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      fillAnim.setValue(0);
    }
  }, [active]);

  if (done) {
    return <View style={[st.progressSeg, st.progressDone]} />;
  }

  if (active) {
    const width = fillAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["15%", "100%"],
    });
    const opacity = fillAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.5, 1, 1],
    });
    return (
      <View style={st.progressSeg}>
        <Animated.View style={[st.progressFill, { width, opacity }]} />
      </View>
    );
  }

  return <View style={st.progressSeg} />;
});

/* ─── Progress Bar (5 segments) ─── */
const ProgressBar = React.memo(({ stepIndex }) => (
  <View style={st.progressContainer}>
    <View style={st.progressTrack}>
      {PROGRESS_STEPS.map((step, i) => (
        <AnimatedSegment
          key={step.key}
          done={i < stepIndex}
          active={i === stepIndex}
        />
      ))}
    </View>
  </View>
));

/* ─── Placed Progress Bar (1 segment pulsing) ─── */
const PlacedProgressBar = React.memo(() => (
  <View style={st.progressContainer}>
    <View style={st.progressTrack}>
      <AnimatedSegment done={false} active={true} />
    </View>
  </View>
));

/* ─── Cooking Animation (overlay on map for preparing statuses) ─── */
const CookingAnimation = React.memo(() => {
  const steam1 = useRef(new Animated.Value(0)).current;
  const steam2 = useRef(new Animated.Value(0)).current;
  const steam3 = useRef(new Animated.Value(0)).current;
  const pepperShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeSteam = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    makeSteam(steam1, 0).start();
    makeSteam(steam2, 700).start();
    makeSteam(steam3, 1400).start();

    // Pepper shaker shaking
    Animated.loop(
      Animated.sequence([
        Animated.timing(pepperShake, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(pepperShake, {
          toValue: -1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(pepperShake, {
          toValue: 0.5,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pepperShake, {
          toValue: -0.5,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pepperShake, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ]),
    ).start();
  }, []);

  const steamStyle = (anim, xOff) => ({
    position: "absolute",
    bottom: 78,
    alignSelf: "center",
    marginLeft: xOff,
    opacity: anim.interpolate({
      inputRange: [0, 0.15, 0.65, 1],
      outputRange: [0, 0.75, 0.25, 0],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -55],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.4, 0.85, 1.3],
        }),
      },
    ],
  });

  const pepperRotate = pepperShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  return (
    <View style={st.cookingOverlay}>
      {/* Semi-transparent backdrop */}
      <View style={st.cookingBackdrop} />

      <View style={st.cookingScene}>
        {/* Steam wisps */}
        <Animated.View style={steamStyle(steam1, -14)}>
          <Svg width={16} height={40} viewBox="0 0 16 40">
            <Path
              d="M8 40 Q2 28 8 20 Q14 12 8 0"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
        <Animated.View style={steamStyle(steam2, 10)}>
          <Svg width={16} height={40} viewBox="0 0 16 40">
            <Path
              d="M8 40 Q14 28 8 20 Q2 12 8 0"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
        <Animated.View style={steamStyle(steam3, -2)}>
          <Svg width={16} height={40} viewBox="0 0 16 40">
            <Path
              d="M6 40 Q3 30 10 22 Q15 14 7 0"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>

        {/* Pan + food SVG */}
        <Svg width={140} height={80} viewBox="0 0 140 80">
          {/* Flame under pan */}
          <Path
            d="M28 72 Q33 56 37 64 Q41 52 47 66 Q51 56 55 64 Q59 52 63 66 Q67 56 72 72"
            fill="#F59E0B"
            opacity="0.85"
          />
          <Path
            d="M34 72 Q37 60 42 66 Q46 56 51 68 Q55 58 59 66 Q63 56 67 72"
            fill="#EF4444"
            opacity="0.65"
          />

          {/* Pan body */}
          <Ellipse cx="50" cy="54" rx="40" ry="17" fill="#4B5563" />
          <Ellipse cx="50" cy="50" rx="36" ry="14" fill="#6B7280" />

          {/* Food items */}
          <Circle cx="36" cy="47" r="5.5" fill="#FDE68A" />
          <Circle cx="50" cy="45" r="5" fill="#EF4444" />
          <Circle cx="63" cy="48" r="4" fill="#34D399" />
          <Rect x="41" y="42" width="9" height="4.5" rx="2" fill="#D97706" />

          {/* Pan handle */}
          <Rect x="86" y="48" width="44" height="7" rx="3.5" fill="#9CA3AF" />
          <Rect x="88" y="49.5" width="40" height="4" rx="2" fill="#6B7280" />
        </Svg>

        {/* Pepper shaker */}
        <Animated.View
          style={[st.pepperShaker, { transform: [{ rotate: pepperRotate }] }]}
        >
          <Svg width={28} height={48} viewBox="0 0 28 48">
            {/* Cap */}
            <Rect x="8" y="0" width="12" height="6" rx="2" fill="#9CA3AF" />
            {/* Holes */}
            <Circle cx="12" cy="3" r="1" fill="#6B7280" />
            <Circle cx="16" cy="3" r="1" fill="#6B7280" />
            {/* Neck */}
            <Rect x="10" y="6" width="8" height="4" fill="#D1D5DB" />
            {/* Body */}
            <Rect x="6" y="10" width="16" height="32" rx="4" fill="#E5E7EB" />
            <Rect x="8" y="12" width="12" height="28" rx="3" fill="#F3F4F6" />
            {/* Label */}
            <Rect x="9" y="20" width="10" height="10" rx="2" fill="#D1D5DB" />
            <Circle cx="14" cy="25" r="2" fill="#9CA3AF" />
            {/* Dots falling */}
            <Circle cx="11" cy="46" r="1" fill="#D97706" opacity="0.5" />
            <Circle cx="17" cy="47" r="0.8" fill="#D97706" opacity="0.3" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
});

/* ─── Driver Card ─── */
const DriverCard = React.memo(({ driver, onCopyPhone }) => {
  if (!driver) return null;
  return (
    <View style={st.driverCard}>
      <View style={st.driverAvatarWrap}>
        {driver.photo_url ? (
          <Image source={{ uri: driver.photo_url }} style={st.driverAvatar} />
        ) : (
          <View style={st.driverAvatarFallback}>
            <Ionicons name="person" size={26} color="#10B981" />
          </View>
        )}
      </View>

      <View style={st.driverMeta}>
        <Text style={st.driverName} numberOfLines={1}>
          {driver.full_name || "Your Driver"}
        </Text>
        {(driver.vehicle_number || driver.license_plate) && (
          <View style={st.driverRow}>
            <Ionicons name="car-sport" size={13} color="#6B7280" />
            <Text style={st.driverRowText}>
              {driver.vehicle_number || driver.license_plate}
            </Text>
          </View>
        )}
        {driver.rating != null && (
          <View style={st.driverRow}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={st.driverRowText}>
              {parseFloat(driver.rating).toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {driver.phone && (
        <View style={st.driverActions}>
          <Pressable
            style={st.callBtn}
            onPress={() => Linking.openURL(`tel:${driver.phone}`)}
          >
            <Ionicons name="call" size={17} color="#fff" />
          </Pressable>
          <Pressable
            style={st.copyBtn}
            onPress={() => onCopyPhone(driver.phone)}
          >
            <Ionicons name="copy-outline" size={15} color="#10B981" />
          </Pressable>
        </View>
      )}
    </View>
  );
});

/* ─── Vehicle Card ─── */
const VehicleCard = React.memo(({ driver }) => {
  if (!driver) return null;
  return (
    <View style={st.vehicleCard}>
      <View style={st.vehicleIconWrap}>
        <Ionicons name="bicycle" size={30} color="#10B981" />
      </View>
      <View style={st.vehicleInfo}>
        <VRow label="Vehicle" value={driver.vehicle_type || "Motorbike"} />
        <VRow
          label="Plate"
          value={driver.vehicle_number || driver.license_plate || "---"}
          bold
        />
        {driver.vehicle_color && (
          <VRow label="Color" value={driver.vehicle_color} />
        )}
      </View>
    </View>
  );
});

const VRow = ({ label, value, bold }) => (
  <View style={st.vehicleRow}>
    <Text style={st.vehicleLabel}>{label}</Text>
    <Text style={[st.vehicleValue, bold && st.vehicleValueBold]}>{value}</Text>
  </View>
);

/* ─── Rating Stars ─── */
const RatingSection = React.memo(({ rating, onRate, onSubmit, submitted }) => {
  if (submitted) {
    return (
      <View style={st.ratingDone}>
        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
        <Text style={st.ratingDoneText}>Thanks for your feedback!</Text>
      </View>
    );
  }
  return (
    <View style={st.ratingWrap}>
      <Text style={st.ratingTitle}>How was your experience?</Text>
      <View style={st.stars}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Pressable key={v} onPress={() => onRate(v)} style={st.starBtn}>
            <Ionicons
              name={rating >= v ? "star" : "star-outline"}
              size={36}
              color={rating >= v ? "#F59E0B" : "#D1D5DB"}
            />
          </Pressable>
        ))}
      </View>
      {rating > 0 && (
        <Pressable style={st.submitRating} onPress={onSubmit}>
          <Text style={st.submitRatingTxt}>Submit Review</Text>
        </Pressable>
      )}
    </View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OrderTrackingScreen({ route, navigation }) {
  const params = route.params || {};
  const orderId = params.orderId;

  /* ── order data (navigation or fetched) ── */
  const [orderData, setOrderData] = useState({
    restaurantName: params.restaurantName || "",
    orderNumber: params.orderNumber || "",
    address: params.address || "",
    items: params.items || [],
    totalAmount: params.totalAmount || 0,
    order: params.order || null,
  });

  /* ── tracking state ── */
  const [currentStatus, setCurrentStatus] = useState("placed");
  const [driverInfo, setDriverInfo] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState("Calculating...");
  const [driverLocation, setDriverLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [restaurantLocation, setRestaurantLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewOrderExpanded, setViewOrderExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  /* ── animations ── */
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const statusFade = useRef(new Animated.Value(1)).current;

  /* ── refs ── */
  const mapRef = useRef(null);
  const prevRouteKeyRef = useRef(null);
  const pollRef = useRef(null);

  /* ── derived ── */
  const stepIndex = STEP_INDEX[currentStatus] ?? 0;
  const info = STATUS_TEXT[currentStatus] || STATUS_TEXT.placed;
  const isCooking = COOKING_STATUSES.has(currentStatus);
  const isOTW = currentStatus === "on_the_way";
  const isDone = currentStatus === "delivered";

  // ===========================================================================
  // FETCH ORDER (if navigated from Orders list, not checkout)
  // ===========================================================================
  useEffect(() => {
    const fetchOrder = async () => {
      if (orderData.restaurantName && orderData.order) {
        const o = orderData.order;
        if (o.restaurant_latitude && o.restaurant_longitude) {
          setRestaurantLocation({
            lat: parseFloat(o.restaurant_latitude),
            lng: parseFloat(o.restaurant_longitude),
          });
        }
        if (o.delivery_latitude && o.delivery_longitude) {
          setDeliveryLocation({
            lat: parseFloat(o.delivery_latitude),
            lng: parseFloat(o.delivery_longitude),
          });
        }
        setLoading(false);
        return;
      }
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const o = data.order || data;
          setOrderData({
            restaurantName: o.restaurant_name || "Restaurant",
            orderNumber: o.order_number || "",
            address: o.delivery_address || "",
            items: o.items || [],
            totalAmount: o.total_amount || 0,
            order: o,
          });
          if (o.status) setCurrentStatus(o.status.toLowerCase());

          if (o.restaurant_latitude && o.restaurant_longitude) {
            setRestaurantLocation({
              lat: parseFloat(o.restaurant_latitude),
              lng: parseFloat(o.restaurant_longitude),
            });
          } else if (o.restaurant?.latitude && o.restaurant?.longitude) {
            setRestaurantLocation({
              lat: parseFloat(o.restaurant.latitude),
              lng: parseFloat(o.restaurant.longitude),
            });
          }

          if (o.delivery_latitude && o.delivery_longitude) {
            setDeliveryLocation({
              lat: parseFloat(o.delivery_latitude),
              lng: parseFloat(o.delivery_longitude),
            });
          }
        }
      } catch (err) {
        console.log("Fetch order error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (orderId) fetchOrder();
    else setLoading(false);
  }, [orderId]);

  // ===========================================================================
  // ENTRANCE ANIMATION
  // ===========================================================================
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.spring(sheetAnim, {
          toValue: 1,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  // ===========================================================================
  // POLL DELIVERY STATUS (every 2s)
  // ===========================================================================
  useEffect(() => {
    if (!orderId || loading) return;

    const poll = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(
          `${API_BASE_URL}/orders/${orderId}/delivery-status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const newStatus = (data.status || "").toLowerCase();

        if (data.driver) setDriverInfo(data.driver);

        if (data.driverLocation?.latitude && data.driverLocation?.longitude) {
          setDriverLocation({
            lat: parseFloat(data.driverLocation.latitude),
            lng: parseFloat(data.driverLocation.longitude),
          });
        }

        if (
          data.customerLocation?.latitude &&
          data.customerLocation?.longitude
        ) {
          setDeliveryLocation({
            lat: parseFloat(data.customerLocation.latitude),
            lng: parseFloat(data.customerLocation.longitude),
          });
          if (data.customerLocation.address) {
            setOrderData((prev) => ({
              ...prev,
              address: data.customerLocation.address,
            }));
          }
        }

        if (
          data.restaurantLocation?.latitude &&
          data.restaurantLocation?.longitude
        ) {
          setRestaurantLocation({
            lat: parseFloat(data.restaurantLocation.latitude),
            lng: parseFloat(data.restaurantLocation.longitude),
          });
        }

        // ETA
        if (data.eta?.etaRangeMin != null && data.eta?.etaRangeMax != null) {
          const otw =
            data.eta.driverStatus === "on_the_way" ||
            data.eta.driverStatus === "at_customer";
          if (otw) {
            setEstimatedTime(
              getFormattedETA(data.eta.etaRangeMin, data.eta.etaRangeMax),
            );
          } else {
            setEstimatedTime(
              `${Math.round(data.eta.etaRangeMin)}-${Math.round(data.eta.etaRangeMax)} mins`,
            );
          }
        } else if (data.estimatedDuration) {
          setEstimatedTime(
            getFormattedETA(data.estimatedDuration, data.estimatedDuration),
          );
        }

        // Status transition
        if (
          newStatus &&
          newStatus !== currentStatus &&
          STEP_INDEX[newStatus] !== undefined
        ) {
          Animated.sequence([
            Animated.timing(statusFade, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(statusFade, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start();
          setCurrentStatus(newStatus);
        }
      } catch (err) {
        console.log("Poll error:", err);
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [orderId, loading, currentStatus]);

  // ===========================================================================
  // OSRM ROUTE
  // ===========================================================================
  useEffect(() => {
    let origin = null;
    let destination = null;

    if (isOTW || currentStatus === "picked_up") {
      if (driverLocation && deliveryLocation) {
        origin = driverLocation;
        destination = deliveryLocation;
      }
    } else {
      if (restaurantLocation && deliveryLocation) {
        origin = restaurantLocation;
        destination = deliveryLocation;
      }
    }

    if (!origin || !destination) return;

    const key = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}-${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    if (prevRouteKeyRef.current === key) return;
    prevRouteKeyRef.current = key;

    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === "Ok" && data.routes?.[0]?.geometry) {
          setRouteCoords(decodePolyline(data.routes[0].geometry));
          if (data.routes[0].duration) {
            const mins = Math.max(1, Math.ceil(data.routes[0].duration / 60));
            setEstimatedTime(
              isOTW
                ? getFormattedETA(mins, mins)
                : `${mins} min${mins !== 1 ? "s" : ""}`,
            );
          }
        }
      } catch {
        setRouteCoords([
          { latitude: origin.lat, longitude: origin.lng },
          { latitude: destination.lat, longitude: destination.lng },
        ]);
      }
    })();
  }, [
    currentStatus,
    driverLocation,
    deliveryLocation,
    restaurantLocation,
    isOTW,
  ]);

  // ===========================================================================
  // FIT MAP BOUNDS
  // ===========================================================================
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const coords = [];
    if (restaurantLocation) {
      coords.push({
        latitude: restaurantLocation.lat,
        longitude: restaurantLocation.lng,
      });
    }
    if (deliveryLocation) {
      coords.push({
        latitude: deliveryLocation.lat,
        longitude: deliveryLocation.lng,
      });
    }
    if (driverLocation) {
      coords.push({
        latitude: driverLocation.lat,
        longitude: driverLocation.lng,
      });
    }

    if (coords.length >= 2) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60 },
      });
    } else if (coords.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: coords[0].latitude,
          longitude: coords[0].longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500,
      );
    }
  }, [mapReady, restaurantLocation, deliveryLocation, driverLocation]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleCopyPhone = useCallback(async (phone) => {
    try {
      await Clipboard.setStringAsync(phone);
    } catch {
      /* ignore */
    }
    setPhoneCopied(true);
    setTimeout(() => setPhoneCopied(false), 2000);
  }, []);

  const handleSubmitRating = useCallback(async () => {
    if (rating <= 0) return;
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_BASE_URL}/orders/${orderId}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating }),
      });
    } catch {
      /* still mark submitted */
    }
    setRatingSubmitted(true);
  }, [orderId, rating]);

  const goHome = useCallback(
    () => navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] }),
    [navigation],
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  }, [navigation]);

  // ===========================================================================
  // MAP PROPS (memoised)
  // ===========================================================================

  const mapInitialRegion = useMemo(() => {
    const c = deliveryLocation || restaurantLocation || driverLocation;
    if (!c)
      return {
        latitude: 7.8731,
        longitude: 80.7718,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    return {
      latitude: c.lat,
      longitude: c.lng,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };
  }, [deliveryLocation, restaurantLocation, driverLocation]);

  const mapMarkers = useMemo(() => {
    const m = [];
    if (restaurantLocation) {
      m.push({
        id: "restaurant",
        coordinate: {
          latitude: restaurantLocation.lat,
          longitude: restaurantLocation.lng,
        },
        type: "restaurant",
        emoji: "🏪",
        title: orderData.restaurantName || "Restaurant",
      });
    }
    if (deliveryLocation) {
      m.push({
        id: "customer",
        coordinate: {
          latitude: deliveryLocation.lat,
          longitude: deliveryLocation.lng,
        },
        type: "customer",
        emoji: "🏠",
        title: "Your Location",
      });
    }
    if (driverLocation) {
      m.push({
        id: "driver",
        coordinate: {
          latitude: driverLocation.lat,
          longitude: driverLocation.lng,
        },
        type: "driver",
        emoji: "🛵",
        title: driverInfo?.full_name || "Driver",
      });
    }
    return m;
  }, [
    restaurantLocation,
    deliveryLocation,
    driverLocation,
    orderData.restaurantName,
    driverInfo,
  ]);

  const mapPolylines = useMemo(() => {
    if (routeCoords.length < 2) return [];
    return [
      {
        id: "route",
        coordinates: routeCoords,
        strokeColor: isCooking ? "#6B7280" : "#10B981",
        strokeWidth: isCooking ? 3 : 5,
        dashArray: isCooking ? "10,8" : null,
      },
    ];
  }, [routeCoords, isCooking]);

  // ===========================================================================
  // LOADING SKELETON
  // ===========================================================================

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F0FDF4" }}>
        <SkeletonBlock width="100%" height={SH * 0.45} borderRadius={0} />
        <View
          style={{
            flex: 1,
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            marginTop: -20,
            padding: 20,
            gap: 16,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: "#E2E8F0",
            }}
          />
          <SkeletonBlock width="55%" height={20} borderRadius={8} />
          <SkeletonBlock width="80%" height={14} borderRadius={6} />
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
            }}
          >
            <SkeletonBlock width={44} height={44} borderRadius={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBlock width="45%" height={12} borderRadius={6} />
              <SkeletonBlock width="65%" height={18} borderRadius={6} />
            </View>
          </View>
          <SkeletonBlock width="100%" height={8} borderRadius={4} />
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <SkeletonBlock width={48} height={48} borderRadius={24} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBlock width="50%" height={14} borderRadius={6} />
              <SkeletonBlock width="35%" height={12} borderRadius={6} />
            </View>
            <SkeletonBlock width={44} height={44} borderRadius={22} />
          </View>
        </View>
      </View>
    );
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================

  const sheetY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

      {/* ══════════════ MAP BACKGROUND (always visible) ══════════════ */}
      <View style={st.mapWrap}>
        <FreeMapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={mapInitialRegion}
          markers={mapMarkers}
          polylines={mapPolylines}
          onMapReady={() => setMapReady(true)}
        />

        {/* Map loading overlay */}
        {!mapReady && (
          <View style={st.mapLoading}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={st.mapLoadingTxt}>Loading map…</Text>
          </View>
        )}

        {/* Cooking animation overlay (placed / pending / received) */}
        {isCooking && <CookingAnimation />}

        {/* Live badge (on_the_way) */}
        {isOTW && (
          <View style={st.mapLiveBadge}>
            <View style={st.liveDot} />
            <Text style={st.mapLiveTxt}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Back Button */}
      {!isDone && (
        <Pressable style={st.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
      )}

      {/* Copied toast */}
      {phoneCopied && (
        <View style={st.toast}>
          <Ionicons name="checkmark-circle" size={15} color="#10B981" />
          <Text style={st.toastTxt}>Phone number copied!</Text>
        </View>
      )}

      {/* ══════════════ BOTTOM SHEET CARD ══════════════ */}
      <Animated.View
        style={[
          st.sheet,
          { transform: [{ translateY: sheetY }], opacity: contentFade },
        ]}
      >
        {/* Handle */}
        <View style={st.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.sheetInner}
          bounces={false}
        >
          {/* Live badge inside sheet (on_the_way) */}
          {isOTW && (
            <View style={st.liveBadge}>
              <View style={st.liveDot} />
              <Text style={st.liveTxt}>Live Tracking</Text>
            </View>
          )}

          {/* Title / subtitle */}
          <Animated.View style={{ opacity: statusFade }}>
            <Text style={[st.title, isDone && st.titleSuccess]}>
              {info.title}
            </Text>
            <Text style={st.subtitle}>{info.subtitle}</Text>
          </Animated.View>

          {/* ETA card */}
          {!isDone && currentStatus !== "placed" && (
            <View style={st.etaCard}>
              <View style={st.etaIconBox}>
                <Ionicons name="time-outline" size={22} color="#10B981" />
              </View>
              <View style={st.etaBody}>
                <Text style={st.etaLabel}>Estimated arrival</Text>
                <Text style={st.etaVal}>{estimatedTime}</Text>
              </View>
            </View>
          )}

          {/* Progress bar */}
          {currentStatus === "placed" ? (
            <PlacedProgressBar />
          ) : (
            <ProgressBar stepIndex={stepIndex} />
          )}

          {/* ── Status-specific sections ── */}
          <Animated.View style={{ opacity: statusFade }}>
            {/* Driver + Vehicle (accepted / picked_up / on_the_way) */}
            {(currentStatus === "accepted" ||
              currentStatus === "picked_up" ||
              isOTW) &&
              driverInfo && (
                <>
                  <DriverCard
                    driver={driverInfo}
                    onCopyPhone={handleCopyPhone}
                  />
                  {!isOTW && <VehicleCard driver={driverInfo} />}
                </>
              )}

            {/* Delivery address (on_the_way) */}
            {isOTW && (
              <View style={st.addrCard}>
                <View style={st.addrIconBox}>
                  <Ionicons name="location" size={20} color="#10B981" />
                </View>
                <View style={st.addrBody}>
                  <Text style={st.addrLabel}>Delivering to</Text>
                  <Text style={st.addrVal} numberOfLines={2}>
                    {orderData.address || "Your address"}
                  </Text>
                </View>
              </View>
            )}

            {/* Delivery details (placed / pending / received) */}
            {(currentStatus === "placed" ||
              currentStatus === "pending" ||
              currentStatus === "received") && (
              <View style={st.deliverySection}>
                <Text style={st.sectionLabel}>Delivery details</Text>
                <Text style={st.deliveryAddr}>
                  {orderData.address || "Your address"}
                </Text>
              </View>
            )}

            {/* View Order toggle */}
            {!isDone && (
              <>
                <Pressable
                  style={st.viewOrderBtn}
                  onPress={() => setViewOrderExpanded(!viewOrderExpanded)}
                >
                  <View style={st.viewOrderLeft}>
                    <Ionicons
                      name="receipt-outline"
                      size={18}
                      color="#374151"
                    />
                    <Text style={st.viewOrderTxt}>View Order</Text>
                  </View>
                  <Ionicons
                    name={viewOrderExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </Pressable>

                {viewOrderExpanded && <OrderDetailsBlock data={orderData} />}
              </>
            )}

            {/* ── Delivered section ── */}
            {isDone && (
              <>
                <RatingSection
                  rating={rating}
                  onRate={setRating}
                  onSubmit={handleSubmitRating}
                  submitted={ratingSubmitted}
                />

                <Pressable
                  style={st.viewOrderBtn}
                  onPress={() => setViewOrderExpanded(!viewOrderExpanded)}
                >
                  <View style={st.viewOrderLeft}>
                    <Ionicons
                      name="receipt-outline"
                      size={18}
                      color="#374151"
                    />
                    <Text style={st.viewOrderTxt}>Order details</Text>
                  </View>
                  <Ionicons
                    name={viewOrderExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </Pressable>

                {viewOrderExpanded && (
                  <OrderDetailsBlock data={orderData} showDeliveredTo />
                )}

                {/* Action buttons */}
                <View style={st.actionRow}>
                  <Pressable style={st.orderAgainBtn} onPress={goHome}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={st.orderAgainTxt}>Order Again</Text>
                  </Pressable>
                  <Pressable style={st.goHomeBtn} onPress={goHome}>
                    <Ionicons name="home-outline" size={20} color="#10B981" />
                    <Text style={st.goHomeTxt}>Back to Home</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// =============================================================================
// ORDER DETAILS BLOCK
// =============================================================================

const OrderDetailsBlock = React.memo(({ data, showDeliveredTo }) => (
  <View style={st.orderDetails}>
    <DetailRow label="Restaurant" value={data.restaurantName} />
    {data.orderNumber ? (
      <DetailRow label="Order #" value={`#${data.orderNumber}`} />
    ) : null}
    {showDeliveredTo && <DetailRow label="Delivered to" value={data.address} />}
    {data.items?.length > 0 && (
      <View style={st.itemsSection}>
        <Text style={st.detailLabelTxt}>Items</Text>
        {data.items.map((item, idx) => (
          <View key={idx} style={st.itemRow}>
            <Text style={st.itemName} numberOfLines={1}>
              {item.quantity}× {item.name || item.food_name}
            </Text>
            <Text style={st.itemPrice}>
              Rs.{" "}
              {((item.price || item.unit_price || 0) * item.quantity).toFixed(
                2,
              )}
            </Text>
          </View>
        ))}
      </View>
    )}
    {data.totalAmount > 0 && (
      <View style={st.totalRow}>
        <Text style={st.totalLabel}>
          {showDeliveredTo ? "Total Paid" : "Total"}
        </Text>
        <Text style={st.totalVal}>
          Rs. {parseFloat(data.totalAmount).toFixed(2)}
        </Text>
      </View>
    )}
  </View>
));

const DetailRow = ({ label, value }) => (
  <View style={st.detailRow}>
    <Text style={st.detailLabelTxt}>{label}</Text>
    <Text style={st.detailValTxt} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

// =============================================================================
// STYLES
// =============================================================================

const st = StyleSheet.create({
  /* layout */
  root: { flex: 1, backgroundColor: "#064E3B" },

  /* ─ map area (always visible) ─ */
  mapWrap: {
    height: SH * 0.5,
    width: "100%",
    backgroundColor: "#E5E7EB",
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  mapLoadingTxt: { color: "#fff", marginTop: 8, fontSize: 14 },

  /* cooking animation overlay */
  cookingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  cookingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  cookingScene: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 160,
    height: 160,
  },
  pepperShaker: {
    position: "absolute",
    right: -10,
    bottom: 30,
  },

  /* map live badge */
  mapLiveBadge: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 46,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
    zIndex: 10,
  },
  mapLiveTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },

  /* back button */
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 44,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  /* toast */
  toast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 90,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 20,
    gap: 6,
  },
  toastTxt: { fontSize: 13, color: "#374151", fontWeight: "500" },

  /* ─ bottom sheet ─ */
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SH * 0.58,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetInner: { paddingHorizontal: 20, paddingBottom: 34 },

  /* live badge */
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveTxt: { fontSize: 12, fontWeight: "600", color: "#059669" },

  /* title */
  title: { fontSize: 24, fontWeight: "800", color: "#111827", marginTop: 8 },
  titleSuccess: { color: "#059669" },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
    marginBottom: 14,
    lineHeight: 20,
  },

  /* ETA card */
  etaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  etaIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  etaBody: { flex: 1 },
  etaLabel: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  etaVal: { fontSize: 16, fontWeight: "700", color: "#065F46", marginTop: 1 },

  /* progress bar */
  progressContainer: { marginBottom: 16 },
  progressTrack: { flexDirection: "row", gap: 4 },
  progressSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressDone: { backgroundColor: "#10B981" },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#10B981",
    borderRadius: 3,
  },

  /* driver card */
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  driverAvatarWrap: { marginRight: 12 },
  driverAvatar: { width: 50, height: 50, borderRadius: 25 },
  driverAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  driverMeta: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  driverRowText: { fontSize: 12, color: "#6B7280" },
  driverActions: { flexDirection: "column", gap: 6, marginLeft: 8 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },

  /* vehicle card */
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  vehicleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  vehicleInfo: { flex: 1 },
  vehicleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  vehicleLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },
  vehicleValue: { fontSize: 13, color: "#374151", fontWeight: "600" },
  vehicleValueBold: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    color: "#065F46",
    fontWeight: "700",
    overflow: "hidden",
  },

  /* address card */
  addrCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  addrIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  addrBody: { flex: 1 },
  addrLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },
  addrVal: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
    marginTop: 1,
  },

  /* delivery section */
  deliverySection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  deliveryAddr: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
    marginTop: 4,
  },

  /* view order button */
  viewOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  viewOrderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  viewOrderTxt: { fontSize: 15, fontWeight: "600", color: "#374151" },

  /* order details */
  orderDetails: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 6,
  },
  detailLabelTxt: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
  detailValTxt: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  itemsSection: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 6,
    paddingTop: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  itemName: { fontSize: 13, color: "#4B5563", flex: 1, marginRight: 8 },
  itemPrice: { fontSize: 13, color: "#374151", fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#10B981",
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 14, color: "#374151", fontWeight: "700" },
  totalVal: { fontSize: 16, color: "#059669", fontWeight: "800" },

  /* rating */
  ratingWrap: { alignItems: "center", paddingVertical: 16 },
  ratingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  stars: { flexDirection: "row", gap: 8 },
  starBtn: { padding: 2 },
  submitRating: {
    marginTop: 14,
    backgroundColor: "#10B981",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  submitRatingTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  ratingDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    justifyContent: "center",
  },
  ratingDoneText: { fontSize: 14, fontWeight: "600", color: "#059669" },

  /* action buttons (delivered) */
  actionRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  orderAgainBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 14,
  },
  orderAgainTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  goHomeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#10B981",
  },
  goHomeTxt: { color: "#10B981", fontSize: 15, fontWeight: "700" },
});
