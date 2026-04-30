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
  AppState,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import OSMMapView from "../../components/maps/OSMMapView";
import LiveDriverMap from "../../components/maps/LiveDriverMap";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import OptimizedImage from "../../components/common/OptimizedImage";
import OrderPlacedBackground from "../../components/customer/OrderPlacedBackground";
import { API_BASE_URL } from "../../constants/api";
import { useSocket } from "../../context/SocketContext";
import { getAccessToken } from "../../lib/authStorage";
import { fetchOSRMRoute } from "../../utils/osrmClient";

const { width: SW, height: SH } = Dimensions.get("window");
const ORDER_TOTAL_CACHE_KEY = "@order_display_totals";
const DRIVER_INFO_CACHE_KEY = "@order_driver_info";
const DRIVER_LAST_LOCATION_CACHE_KEY = "@order_driver_last_location";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveOrderDisplayTotal(
  orderLike,
  fallback = 0,
  preferFallback = false,
) {
  const fallbackCandidates = [fallback];
  const orderCandidates = [
    orderLike?.grand_total,
    orderLike?.final_total,
    orderLike?.payable_amount,
    orderLike?.total_amount,
    orderLike?.total,
  ];
  const candidates = preferFallback
    ? [...fallbackCandidates, ...orderCandidates]
    : [...orderCandidates, ...fallbackCandidates];

  for (let i = 0; i < candidates.length; i += 1) {
    const n = Number(candidates[i]);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}

async function getCachedOrderDisplayTotal(orderId) {
  if (!orderId) return NaN;

  try {
    const raw = await AsyncStorage.getItem(ORDER_TOTAL_CACHE_KEY);
    if (!raw) return NaN;
    const map = JSON.parse(raw);
    const n = Number(map?.[String(orderId)]);
    return Number.isFinite(n) ? n : NaN;
  } catch {
    return NaN;
  }
}

async function getCachedDriverInfo(orderId) {
  if (!orderId) return null;

  try {
    const raw = await AsyncStorage.getItem(DRIVER_INFO_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map?.[String(orderId)] || null;
  } catch {
    return null;
  }
}

async function cacheDriverInfo(orderId, driver) {
  if (!orderId || !driver) return;

  try {
    const raw = await AsyncStorage.getItem(DRIVER_INFO_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(orderId)] = driver;
    await AsyncStorage.setItem(DRIVER_INFO_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore cache write failures
  }
}

async function getCachedDriverLastLocation(orderId) {
  if (!orderId) return null;

  try {
    const raw = await AsyncStorage.getItem(DRIVER_LAST_LOCATION_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const cached = map?.[String(orderId)] || null;

    const lat = Number(cached?.lat ?? cached?.latitude);
    const lng = Number(cached?.lng ?? cached?.longitude);
    const heading = Number(cached?.heading ?? 0);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      heading: Number.isFinite(heading) ? heading : 0,
    };
  } catch {
    return null;
  }
}

async function cacheDriverLastLocation(orderId, location) {
  if (!orderId || !location) return;

  const lat = Number(location?.lat ?? location?.latitude);
  const lng = Number(location?.lng ?? location?.longitude);
  const heading = Number(location?.heading ?? 0);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  try {
    const raw = await AsyncStorage.getItem(DRIVER_LAST_LOCATION_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};

    map[String(orderId)] = {
      lat,
      lng,
      heading: Number.isFinite(heading) ? heading : 0,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(
      DRIVER_LAST_LOCATION_CACHE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // ignore cache write failures
  }
}

function resolveDriverInfo(payload) {
  if (!payload || typeof payload !== "object") return null;

  const pickDriver = (source) =>
    source?.driver ||
    source?.driver_info ||
    source?.driverInfo ||
    source?.driver_profile ||
    source?.driverProfile ||
    source?.assigned_driver ||
    source?.assignedDriver ||
    source?.delivery_driver ||
    source?.deliveryDriver ||
    source?.courier ||
    source?.rider;
  
  const buildFromFlatFields = (source) => {
    if (!source || typeof source !== "object") return null;
    const fullName =
      source.driver_name ||
      source.driver_full_name ||
      source.driverFullName ||
      source.driverName;
    const phone =
      source.driver_phone || source.driverPhone || source.driver_mobile;
    const vehicleModel =
      source.vehicle_model ||
      source.driver_vehicle_model ||
      source.bike_model ||
      source.bikeModel;
    const vehicleNumber =
      source.vehicle_number ||
      source.driver_vehicle_number ||
      source.license_plate ||
      source.bike_number ||
      source.bikeNumber;
    const vehicleType =
      source.vehicle_type || source.driver_vehicle_type || source.vehicleType;
    const vehicleColor =
      source.vehicle_color ||
      source.driver_vehicle_color ||
      source.vehicleColor;
    const photoUrl =
      source.driver_photo ||
      source.driver_photo_url ||
      source.driver_avatar ||
      source.driver_avatar_url ||
      source.driverPhoto;

    if (!fullName && !phone && !vehicleModel && !vehicleNumber && !photoUrl) {
      return null;
    }

    return {
      full_name: fullName || "",
      phone: phone || "",
      vehicle_model: vehicleModel || "",
      vehicle_number: vehicleNumber || "",
      vehicle_type: vehicleType || "",
      vehicle_color: vehicleColor || "",
      photo_url: photoUrl || "",
    };
  };
  const direct = pickDriver(payload);
  if (direct && typeof direct === "object") return direct;

  const flat = buildFromFlatFields(payload);
  if (flat) return flat;

  const nestedOrder =
    payload.order || payload.orderData || payload.order_details;
  const nestedDelivery = payload.delivery || payload.delivery_info;

  const nested = pickDriver(nestedOrder) || pickDriver(nestedDelivery);
  if (nested && typeof nested === "object") return nested;

  return (
    buildFromFlatFields(nestedOrder) ||
    buildFromFlatFields(nestedDelivery) ||
    null
  );
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PROGRESS_STEPS = [
  { key: "placed" },
  { key: "pending" },
  { key: "accepted" },
  { key: "picked_up" },
  { key: "on_the_way" },
  { key: "delivered" },
];

const STEP_INDEX = {
  placed: 0,
  pending: 1,
  received: 1,
  preparing: 1,
  ready: 1,
  accepted: 2,
  driver_accepted: 2,
  driver_assigned: 2,
  picked_up: 3,
  on_the_way: 4,
  delivered: 5,
};

/** Statuses that show the cooking animation overlay */
const COOKING_STATUSES = new Set([
  "placed",
  "pending",
  "received",
  "preparing",
  "ready",
]);

/** Statuses that show the live map (pending → on_the_way) */
const MAP_STATUSES = new Set([
  "pending",
  "received",
  "preparing",
  "ready",
  "accepted",
  "driver_accepted",
  "driver_assigned",
  "picked_up",
  "on_the_way",
]);
const PREPARING_MAP_STATUSES = new Set([
  "pending",
  "received",
  "preparing",
  "accepted",
  "driver_accepted",
  "driver_assigned",
  "picked_up",
]);
const ETA_VISIBLE_STATUSES = new Set([
  "accepted",
  "driver_accepted",
  "driver_assigned",
  "picked_up",
  "on_the_way",
]);
const RESTAURANT_MARKER_HTML = `
  <div style="width:30px;height:42px;display:flex;align-items:flex-start;justify-content:center;">
    <svg width="30" height="42" viewBox="0 0 128 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="restaurant location pin">
      <path d="M64 4C30.31 4 4 30.3 4 64C4 100.95 37.79 139.47 57.86 165.35C60.79 169.13 67.21 169.13 70.14 165.35C90.21 139.47 124 100.95 124 64C124 30.3 97.69 4 64 4Z" fill="#33B54A"/>
      <circle cx="64" cy="64" r="36" fill="#F8FAFC"/>
      <rect x="47" y="50" width="5" height="27" rx="2.2" fill="#33B54A"/>
      <rect x="43" y="42" width="2.2" height="12" rx="1" fill="#33B54A"/>
      <rect x="46.4" y="42" width="2.2" height="12" rx="1" fill="#33B54A"/>
      <rect x="49.8" y="42" width="2.2" height="12" rx="1" fill="#33B54A"/>
      <rect x="53.2" y="42" width="2.2" height="12" rx="1" fill="#33B54A"/>
      <path d="M72 42C77.3 45.8 80 53.3 80 61.8V77H75.2V42H72Z" fill="#33B54A"/>
      <path d="M67.8 42H75.2V77H67.8C69.6 69.9 70.5 62.7 70.5 55.8C70.5 50.2 69.6 45.7 67.8 42Z" fill="#33B54A"/>
    </svg>
  </div>
`;
const CUSTOMER_MARKER_HTML = `
  <div style="width:30px;height:42px;display:flex;align-items:flex-start;justify-content:center;">
    <svg width="30" height="42" viewBox="0 0 128 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="customer location pin">
      <path d="M64 4C30.31 4 4 30.3 4 64C4 100.95 37.79 139.47 57.86 165.35C60.79 169.13 67.21 169.13 70.14 165.35C90.21 139.47 124 100.95 124 64C124 30.3 97.69 4 64 4Z" fill="#0B0B0D"/>
      <circle cx="64" cy="64" r="34" fill="#FFFFFF"/>
      <path d="M45 66V56.7L64 42L83 56.7V66" stroke="#0B0B0D" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50 64V86H78V64" stroke="#0B0B0D" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M60.5 86V73.5H67.5V86" stroke="#0B0B0D" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
`;

function createTopArcRoute(start, end, steps = 32) {
  const midLat = (start.latitude + end.latitude) / 2;
  const midLng = (start.longitude + end.longitude) / 2;

  const latSpan = Math.abs(start.latitude - end.latitude);
  const lngSpan = Math.abs(start.longitude - end.longitude);
  const arcLift = Math.max(latSpan, lngSpan) * 0.34;
  const control = {
    latitude: midLat + arcLift,
    longitude: midLng,
  };

  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const oneMinusT = 1 - t;
    points.push({
      latitude:
        oneMinusT * oneMinusT * start.latitude +
        2 * oneMinusT * t * control.latitude +
        t * t * end.latitude,
      longitude:
        oneMinusT * oneMinusT * start.longitude +
        2 * oneMinusT * t * control.longitude +
        t * t * end.longitude,
    });
  }
  return points;
}

const STATUS_TEXT = {
  placed: {
    title: "Order Placed!",
    subtitle: "We've received your order",
    eta: "Waiting for restaurant...",
  },
  pending: {
    title: "Preparing Your Order",
    subtitle: "The restaurant is cooking your meal",
    eta: "5-15 mins",
  },
  received: {
    title: "Preparing Your Order",
    subtitle: "The restaurant is cooking your meal",
    eta: "5-15 mins",
  },
  preparing: {
    title: "Preparing Your Order",
    subtitle: "The restaurant is cooking your meal",
    eta: "5-15 mins",
  },
  ready: {
    title: "Order Ready",
    subtitle: "Your order is ready for pickup",
    eta: "Driver arriving soon",
  },
  accepted: {
    title: "Driver Accepted",
    subtitle: "A driver has accepted your order",
    eta: "Calculating...",
  },
  driver_accepted: {
    title: "Driver Accepted",
    subtitle: "A driver has accepted your order",
    eta: "Calculating...",
  },
  driver_assigned: {
    title: "Driver Assigned",
    subtitle: "A driver has assigned to your order",
    eta: "Calculating...",
  },
  picked_up: {
    title: "Order Picked Up",
    subtitle: "Driver has picked up your order",
    eta: "Calculating...",
  },
  on_the_way: {
    title: "On The Way",
    subtitle: "Your order is heading to you",
    eta: "Calculating...",
  },
  delivered: {
    title: "Delivered!",
    subtitle: "Enjoy your meal",
    eta: "Delivered",
  },
};

const STATUS_MESSAGES = {
  placed:
    "Your order has been placed successfully. We're notifying the restaurant.",
  pending: "Your delicious meal is being prepared with care.",
  received: "Your delicious meal is being prepared with care.",
  preparing: "Your delicious meal is being prepared with care.",
  ready: "Your order is ready and waiting for pickup.",
  accepted: "Your driver is on the way to pick up your order.",
  driver_accepted: "Your driver is on the way to pick up your order.",
  driver_assigned:
    "A driver has been assigned and is heading to the restaurant.",
  picked_up: "The driver will head towards you soon",
  on_the_way: "Your driver is on the way to your location.",
  delivered: "Your order has been delivered. Bon app\u00e9tit!",
};

const STATUS_SVG_PATHS = {
  placed: "M5 13l4 4L19 7",
  pending:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  received:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  preparing:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  ready: "M5 13l4 4L19 7",
  accepted:
    "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8zM12 13a3 3 0 100-6 3 3 0 000 6z",
  driver_accepted:
    "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8zM12 13a3 3 0 100-6 3 3 0 000 6z",
  driver_assigned:
    "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8zM12 13a3 3 0 100-6 3 3 0 000 6z",
  picked_up: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
  on_the_way:
    "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8zM12 13a3 3 0 100-6 3 3 0 000 6z",
  delivered: "M20 6L9 17l-5-5",
};

const POLL_INTERVAL = 5000;
const ON_THE_WAY_ETA_REFRESH_INTERVAL = 60000;
const SOCKET_FALLBACK_POLL_INTERVAL = 10000;
const SOCKET_CONNECTED_POLL_INTERVAL = 15000;

function normalizeStatus(status) {
  const raw = String(status || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliasMap = {
    driveraccepted: "driver_accepted",
    driver_accept: "driver_accepted",
    accepted_by_driver: "driver_accepted",
    driverassigned: "driver_assigned",
    assigned_to_driver: "driver_assigned",
    pickedup: "picked_up",
    pickup: "picked_up",
    ontheway: "on_the_way",
    on_the_way_to_customer: "on_the_way",
    order_placed: "placed",
  };

  return aliasMap[raw] || raw;
}

function shouldDisplayLiveDriverLocation(status) {
  return normalizeStatus(status) === "on_the_way";
}

function formatDotClockTime(date) {
  let h = date.getHours();
  const ampm = h >= 12 ? "p.m" : "a.m";
  h = h % 12 || 12;
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}.${m}${ampm}`;
}

/** Build ETA text using website approach with mobile-specific time format. */
function buildEtaDisplayText(minMinutes, maxMinutes, options = {}) {
  const now = new Date();
  const safeMin = Math.max(0, Number(minMinutes) || 0);
  const safeMax = Math.max(0, Number(maxMinutes) || 0);
  const isSingleEta = safeMin === safeMax;
  const isOnTheWay = options.isOnTheWay === true;
  const displayMax = isOnTheWay
    ? safeMax
    : isSingleEta
      ? safeMax + 10
      : safeMax;

  const start = new Date(now.getTime() + safeMin * 60000);
  const end = new Date(now.getTime() + displayMax * 60000);

  const startText = formatDotClockTime(start);
  const endText = formatDotClockTime(end);

  if (isOnTheWay) {
    return `Estimated Arrival : ${endText} Insha Allah`;
  }

  return `Estimated Arrival : ${startText} - ${endText}`;
}

function getNextStepMessage(currentStatus) {
  if (currentStatus === "placed") {
    return "We sent your order to the restaurant. We'll notify once accepted In shaa Allah ";
  }

  if (
    currentStatus === "pending" ||
    currentStatus === "received" ||
    currentStatus === "preparing" ||
    currentStatus === "ready"
  ) {
    return "restaurant is preparing your order. we are searching nearby drivers";
  }

  if (
    currentStatus === "accepted" ||
    currentStatus === "driver_accepted" ||
    currentStatus === "driver_assigned"
  ) {
    return "Driver is on the way to restaurant.";
  }

  if (currentStatus === "picked_up") {
    return "The driver picked your food and have one more stops to deliver you.";
  }

  if (currentStatus === "on_the_way") {
    return "Your driver is on the way to your location.";
  }

  if (currentStatus === "delivered") {
    return "Your order is successfully delivered.";
  }

  const currentIndex = STEP_INDEX[currentStatus] ?? 0;
  const nextStep = PROGRESS_STEPS[currentIndex + 1];
  if (!nextStep) {
    return "We are finalizing your order updates.";
  }

  const nextInfo = STATUS_TEXT[nextStep.key] || STATUS_TEXT.placed;
  return `${nextInfo.title}. We will update this screen automatically.`;
}

function getStatusScreenName(status) {
  switch (status) {
    case "placed":
      return "PlacingOrder";
    case "pending":
    case "received":
    case "preparing":
    case "ready":
      return "OrderReceived";
    case "accepted":
    case "driver_accepted":
    case "driver_assigned":
      return "DriverAccepted";
    case "picked_up":
      return "OrderPickedUp";
    case "on_the_way":
      return "OrderOnTheWay";
    case "delivered":
      return "OrderDelivered";
    default:
      return null;
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/* ─── Animated Segment (progress bar fill) ─── */
const AnimatedSegment = React.memo(({ active, done }) => {
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      flow.setValue(0);
      const loop = Animated.loop(
        Animated.timing(flow, {
          toValue: 1,
          duration: 1300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      flow.stopAnimation();
      flow.setValue(0);
    }
  }, [active]);

  if (done) {
    return <View style={[st.progressSeg, st.progressDone]} />;
  }

  if (active) {
    const sweepLead = flow.interpolate({
      inputRange: [0, 1],
      outputRange: [-26, 82],
    });
    const sweepTrail = flow.interpolate({
      inputRange: [0, 1],
      outputRange: [-56, 52],
    });
    return (
      <View style={[st.progressSeg, { backgroundColor: "#B8F0D0" }]}>
        <Animated.View
          style={[
            st.progressSweep,
            {
              opacity: 0.95,
              transform: [{ translateX: sweepLead }],
            },
          ]}
        />
        <Animated.View
          style={[
            st.progressSweep,
            {
              opacity: 0.5,
              transform: [{ translateX: sweepTrail }],
            },
          ]}
        />
      </View>
    );
  }

  return <View style={st.progressSeg} />;
});

/* ─── Progress Bar (6 segments + labels, matching web) ─── */
const ProgressBar = React.memo(({ stepIndex }) => (
  <View style={st.progressContainer}>
    <View style={st.progressTrack}>
      {PROGRESS_STEPS.map((step, i) => (
        <AnimatedSegment
          key={step.key}
          done={i <= stepIndex}
          active={stepIndex < PROGRESS_STEPS.length - 1 && i === stepIndex + 1}
        />
      ))}
    </View>
    <View style={st.progressLabelRow}>
      {PROGRESS_STEPS.map((step, i) => (
        <Text
          key={step.key}
          style={[st.progressLabel, i <= stepIndex && st.progressLabelActive]}
          numberOfLines={1}
        >
          {step.label}
        </Text>
      ))}
    </View>
  </View>
));

/* ─── Floating Food Icons (web-matching background decoration) ─── */
const FOOD_ICONS = ["🍔", "🍕", "🛵", "🥡", "🍜", "🍗"];
const ICON_POSITIONS = [
  { top: "15%", left: "10%" },
  { top: "25%", right: "15%" },
  { top: "10%", left: "50%" },
  { top: "35%", right: "30%" },
  { top: "40%", left: "20%" },
  { top: "20%", left: "70%" },
];
const FloatingFoodIcons = React.memo(() => {
  const anims = useRef(FOOD_ICONS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    anims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 800),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, []);
  return (
    <>
      {FOOD_ICONS.map((icon, i) => {
        const ty = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -20],
        });
        const op = anims[i].interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.3, 0.55, 0.3],
        });
        return (
          <Animated.Text
            key={i}
            style={[
              st.floatingIcon,
              ICON_POSITIONS[i],
              { transform: [{ translateY: ty }], opacity: op },
            ]}
          >
            {icon}
          </Animated.Text>
        );
      })}
    </>
  );
});

/* ─── Status Icon Bubble (plain SVG icon, no circular shell) ─── */
const StatusIconBubble = React.memo(({ status }) => {
  const svgPath = STATUS_SVG_PATHS[status] || STATUS_SVG_PATHS.placed;

  return (
    <View style={st.statusBubbleWrap}>
      <Svg
        width={50}
        height={50}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#06C168"
        strokeWidth="2.4"
      >
        <Path d={svgPath} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
});

/* ─── Restaurant Info Card (web-matching: circular logo + name + chevron) ─── */
const RestaurantCard = React.memo(({ data }) => {
  const [logoError, setLogoError] = React.useState(false);
  const logoUri =
    data.restaurantLogoUrl ||
    data.order?.restaurant_logo_url ||
    data.order?.restaurant_logo ||
    data.order?.restaurant?.logo_url ||
    data.order?.restaurant?.logo;
  return (
    <View style={st.restaurantCard}>
      <View style={st.restaurantLogoWrap}>
        {logoUri && !logoError ? (
          <OptimizedImage
            uri={logoUri}
            style={st.restaurantLogoImg}
            contentFit="cover"
            onError={() => setLogoError(true)}
          />
        ) : (
          <Svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#06C168"
            strokeWidth="1.5"
          >
            <Path
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
      <View style={st.restaurantInfo}>
        <Text style={st.restaurantNameTxt} numberOfLines={1}>
          {data.restaurantName || "Restaurant"}
        </Text>
        {data.order?.cuisine && (
          <Text style={st.restaurantSubtitleTxt} numberOfLines={1}>
            {data.order.cuisine}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </View>
  );
});

/* ─── Order Summary Card: Restaurant + Total always visible, View Details dropdown ─── */
const OrderSummaryCard = React.memo(({ data, expanded, onToggle }) => {
  const [logoError, setLogoError] = React.useState(false);
  const logoUri =
    data.restaurantLogoUrl ||
    data.order?.restaurant_logo_url ||
    data.order?.restaurant_logo ||
    data.order?.restaurant?.logo_url ||
    data.order?.restaurant?.logo;
  const initial = (data.restaurantName || "R").charAt(0).toUpperCase();
  const items = data.items || [];
  const spinAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(spinAnim, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [expanded]);

  const chevronRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={st.summaryCard}>
      {/* ── Always visible: Restaurant row ── */}
      <View style={st.summaryRestaurantSection}>
        <View style={st.summaryRestaurantLogoWrap}>
          {logoUri && !logoError ? (
            <OptimizedImage
              uri={logoUri}
              style={st.summaryRestaurantLogo}
              contentFit="cover"
              onError={() => setLogoError(true)}
            />
          ) : (
            <View style={st.summaryRestaurantLogoFallback}>
              <Text style={st.summaryRestaurantLogoInitial}>{initial}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.summaryRestaurantName} numberOfLines={1}>
            {data.restaurantName || "Restaurant"}
          </Text>
          {data.orderNumber ? (
            <Text style={st.summaryOrderNum}>Order #{data.orderNumber}</Text>
          ) : null}
        </View>
      </View>

      <View style={st.summaryDivider} />

      {/* ── Always visible: Total row ── */}
      <View style={st.summaryTotalSection}>
        <Text style={st.summaryTotalLabel}>TOTAL</Text>
        <Text style={st.summaryTotalVal}>
          LKR {parseFloat(data.totalAmount || 0).toFixed(2)}
        </Text>
      </View>

      <View style={st.summaryDivider} />

      {/* ── View Details toggle ── */}
      <Pressable style={st.viewDetailsRow} onPress={onToggle}>
        <Ionicons name="document-text-outline" size={16} color="#6B7280" />
        <Text style={st.viewDetailsText}>View Details</Text>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </Animated.View>
      </Pressable>

      {/* ── Expanded details ── */}
      {expanded && (
        <View style={st.detailsExpanded}>
          {/* Ordered Items */}
          {items.length > 0 && (
            <View style={st.detailBlock}>
              <View style={st.detailItemsBox}>
                {items.map((item, idx) => {
                  const itemName =
                    item.food_name ||
                    item.name ||
                    item.menu_item_name ||
                    "Item";
                  const qty = item.quantity || 1;
                  const size =
                    item.size || item.variation || item.variant || "";
                  return (
                    <View
                      key={item.id || idx}
                      style={[
                        st.orderedItemRow,
                        idx < items.length - 1 && st.detailItemBorder,
                      ]}
                    >
                      <Text style={st.orderedItemName}>
                        {qty}x {itemName}
                      </Text>
                      {size ? (
                        <Text style={st.orderedItemSize}>{size}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

/* ─── Animated Info Message (web-matching: italic bold green 3D emerge) ─── */
const InfoMessage = React.memo(({ status }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  const scale = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 1, 0.6],
  });
  const op = anim.interpolate({
    inputRange: [0, 0.25, 0.75, 1],
    outputRange: [0.3, 1, 1, 0.3],
  });
  return (
    <View style={st.infoMsgContainer}>
      <Animated.Text
        style={[st.infoMsgText, { transform: [{ scale }], opacity: op }]}
      >
        {STATUS_MESSAGES[status] || ""}
      </Animated.Text>
    </View>
  );
});

/* ─── Scooter Delivery Animation (driver is coming / on the way) ─── */
const ScooterAnimation = React.memo(({ status }) => {
  const scooterPos = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(0)).current;
  const foodFloat = useRef(new Animated.Value(0)).current;

  const progress =
    status === "accepted" ? 0.2 : status === "picked_up" ? 0.5 : 0.78;

  useEffect(() => {
    Animated.spring(scooterPos, {
      toValue: progress,
      friction: 8,
      tension: 35,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -6,
          duration: 350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 2,
          duration: 250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRing, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(foodFloat, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(foodFloat, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [progress]);

  const roadW = SW - 90;
  const scooterTX = scooterPos.interpolate({
    inputRange: [0, 1],
    outputRange: [0, roadW - 50],
  });
  const ringScale = pulseRing.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });
  const ringOp = pulseRing.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.5, 0.15, 0],
  });
  const floatY = foodFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <View style={st.scooterScene}>
      {/* Floating food items */}
      <Animated.View
        style={[
          st.floatingFood,
          { left: SW * 0.15, top: 10, transform: [{ translateY: floatY }] },
        ]}
      >
        <Text style={{ fontSize: 22 }}>🍕</Text>
      </Animated.View>
      <Animated.View
        style={[
          st.floatingFood,
          {
            right: SW * 0.2,
            top: 20,
            transform: [{ translateY: Animated.multiply(floatY, -1) }],
          },
        ]}
      >
        <Text style={{ fontSize: 18 }}>🍔</Text>
      </Animated.View>
      <Animated.View
        style={[
          st.floatingFood,
          { left: SW * 0.4, top: 5, transform: [{ translateY: floatY }] },
        ]}
      >
        <Text style={{ fontSize: 16 }}>🌮</Text>
      </Animated.View>

      {/* Road */}
      <View style={st.roadPath}>
        <View style={st.roadBg} />
        <View style={st.roadCenter}>
          {Array.from({ length: 14 }).map((_, i) => (
            <View key={i} style={st.roadDash} />
          ))}
        </View>
      </View>

      {/* Restaurant marker */}
      <View style={[st.heroMarker, { left: 24 }]}>
        <View style={st.heroMarkerCircle}>
          <Text style={{ fontSize: 18 }}>🥄🥄</Text>
        </View>
        <View style={st.heroMarkerDot} />
      </View>

      {/* Home marker */}
      <View style={[st.heroMarker, { right: 24 }]}>
        <Animated.View
          style={[
            st.heroMarkerPulse,
            { transform: [{ scale: ringScale }], opacity: ringOp },
          ]}
        />
        <View style={[st.heroMarkerCircle, { backgroundColor: "#fff" }]}>
          <Text style={{ fontSize: 20 }}>🏠</Text>
        </View>
        <View style={st.heroMarkerDot} />
      </View>

      {/* Animated Scooter */}
      <Animated.View
        style={[
          st.scooterWrap,
          { transform: [{ translateX: scooterTX }, { translateY: bounce }] },
        ]}
      >
        <View style={st.speedLines}>
          <View style={[st.speedLine, { width: 14, opacity: 0.5 }]} />
          <View style={[st.speedLine, { width: 10, opacity: 0.35 }]} />
          <View style={[st.speedLine, { width: 7, opacity: 0.2 }]} />
        </View>
        <View style={st.scooterBubble}>
          <Text style={{ fontSize: 28 }}>🛵</Text>
        </View>
      </Animated.View>
    </View>
  );
});

/* ─── Delivered Celebration Animation ─── */
const DeliveredAnimation = React.memo(() => {
  const checkScale = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const confettis = useRef(
    Array.from({ length: 10 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

    const makeRing = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 1800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    makeRing(ring1, 0).start();
    makeRing(ring2, 900).start();

    const COLORS = [
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#3B82F6",
      "#EC4899",
      "#06C168",
      "#F97316",
      "#06B6D4",
      "#06C168",
      "#A855F7",
    ];
    confettis.forEach((c, i) => {
      const angle = (i / 10) * Math.PI * 2;
      const dist = 55 + Math.random() * 45;
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.parallel([
            Animated.timing(c.x, {
              toValue: Math.cos(angle) * dist,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(c.y, {
              toValue: Math.sin(angle) * dist,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(c.opacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(c.scale, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(c.opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(c.x, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(c.y, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(c.scale, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(600),
        ]),
      ).start();
    });
  }, []);

  const CONFETTI_COLORS = [
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#3B82F6",
    "#EC4899",
    "#06C168",
    "#F97316",
    "#06B6D4",
    "#06C168",
    "#A855F7",
  ];

  const ringStyle = (anim) => ({
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 2.8],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0.6, 0.25, 0],
    }),
  });

  return (
    <View style={st.deliveredScene}>
      {/* Pulse rings */}
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />

      {/* Confetti */}
      {confettis.map((c, i) => (
        <Animated.View
          key={i}
          style={[
            st.confetti,
            {
              backgroundColor: CONFETTI_COLORS[i],
              borderRadius: i % 2 === 0 ? 5 : 2,
              width: i % 2 === 0 ? 10 : 8,
              height: i % 2 === 0 ? 10 : 14,
              transform: [
                { translateX: c.x },
                { translateY: c.y },
                { scale: c.scale },
                { rotate: `${i * 36}deg` },
              ],
              opacity: c.opacity,
            },
          ]}
        />
      ))}

      {/* Checkmark */}
      <Animated.View
        style={[st.deliveredCheck, { transform: [{ scale: checkScale }] }]}
      >
        <Ionicons name="checkmark" size={52} color="#fff" />
      </Animated.View>

      <Text style={st.deliveredTxt}>Delivered!</Text>
      <Text style={st.deliveredSub}>Enjoy your meal</Text>
    </View>
  );
});

/* ─── Driver Card ─── */
const DriverCard = React.memo(({ driver }) => {
  if (!driver) return null;
  const vehicleNumber = driver.vehicle_number || driver.license_plate;
  const vehicleModel =
    driver.vehicle_model ||
    driver?.driverInfo?.vehicle_model ||
    driver?.vehicle?.model ||
    "";

  return (
    <View style={st.driverCard}>
      <View style={st.driverAvatarWrap}>
        {driver.photo_url ? (
          <OptimizedImage uri={driver.photo_url} style={st.driverAvatar} />
        ) : (
          <View style={st.driverAvatarFallback}>
            <Ionicons name="person" size={20} color="#06C168" />
          </View>
        )}
      </View>

      <View style={st.driverMeta}>
        <Text style={st.driverName} numberOfLines={1}>
          {driver.full_name || "Your Driver"}
        </Text>
        {vehicleNumber && (
          <View style={st.driverRow}>
            <Ionicons name="bicycle" size={11} color="#6B7280" />
            <Text style={st.driverRowText}>{vehicleNumber}</Text>
          </View>
        )}
        {vehicleModel ? (
          <View style={st.driverRow}>
            <Text style={st.driverRowText}>{vehicleModel}</Text>
          </View>
        ) : null}
        {driver.phone ? (
          <View style={st.driverRow}>
            <Text style={[st.driverRowText, st.driverPhoneText]}>
              {driver.phone}
            </Text>
          </View>
        ) : null}
        {driver.rating != null && (
          <View style={st.driverRow}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={st.driverRowText}>
              {parseFloat(driver.rating).toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {driver.phone && (
        <Pressable
          style={st.callBtn}
          onPress={() => Linking.openURL(`tel:${driver.phone}`)}
        >
          <Ionicons name="call" size={16} color="#fff" />
        </Pressable>
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
        <Ionicons name="bicycle" size={30} color="#06C168" />
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
        <Ionicons name="checkmark-circle" size={22} color="#06C168" />
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

export default function OrderStatusFlowScreen({ route, navigation }) {
  const params = route.params || {};
  const orderId =
    params.orderId ||
    params.order?.id ||
    params.order?.order_id ||
    params.order?.orderId ||
    null;
  const routeName = route?.name || "PlacingOrder";
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { on, off, isConnected: isSocketConnected } = useSocket();
  const initialRouteStatus = normalizeStatus(params.status || "");
  const keepInitialPlacedUI = initialRouteStatus === "placed";
  const statusScreens = new Set([
    "PlacingOrder",
    "OrderTracking",
    "OrderReceived",
    "DriverAccepted",
    "OrderPickedUp",
    "OrderOnTheWay",
    "OrderDelivered",
  ]);
  const isStatusScreenMode =
    params.statusScreenMode === true || statusScreens.has(routeName);

  // Guard: if no orderId, this screen was opened without valid data — go back
  useEffect(() => {
    if (!orderId) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    }
  }, [orderId, navigation]);

  /* ── order data (navigation or fetched) ── */
  const [orderData, setOrderData] = useState({
    restaurantName:
      params.restaurantName || params.order?.restaurant_name || "",
    orderNumber: params.orderNumber || params.order?.order_number || "",
    address: params.address || params.order?.delivery_address || "",
    items:
      params.items || params.order?.order_items || params.order?.items || [],
    totalAmount: resolveOrderDisplayTotal(
      params.order,
      params.totalAmount ?? 0,
      true,
    ),
    order: params.order || null,
    restaurantLogoUrl:
      params.restaurantLogoUrl ||
      params.logoUrl ||
      params.order?.restaurant_logo_url ||
      "",
  });

  /* ── tracking state ── */
  const [currentStatus, setCurrentStatus] = useState(
    normalizeStatus(
      params.status ||
        params.order?.status ||
        params.order?.delivery_status ||
        "placed",
    ),
  );
  const [driverInfo, setDriverInfo] = useState(
    () => resolveDriverInfo(params) || resolveDriverInfo(params.order) || null,
  );
  const [estimatedTime, setEstimatedTime] = useState("");
  const [driverLocation, setDriverLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [restaurantLocation, setRestaurantLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeFlowOffset, setRouteFlowOffset] = useState(0);
  const [showRecenterButton, setShowRecenterButton] = useState(false);
  const [isSheetHalfDown, setIsSheetHalfDown] = useState(false);
  const hasRouteOrderData = Boolean(params.order);
  const [loading, setLoading] = useState(!hasRouteOrderData);
  const [viewOrderExpanded, setViewOrderExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);

  /* ── cancel order state ── */
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [customCancelReason, setCustomCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelled, setIsCancelled] = useState(currentStatus === "cancelled");

  const CANCEL_REASONS = [
    "Changed my mind",
    "Found better option",
    "Ordered by mistake",
    "Delivery taking too long",
    "Wrong items selected",
    "Other",
  ];

  const handleCancelOrder = async () => {
    const reason =
      cancelReason === "Other" ? customCancelReason.trim() : cancelReason;
    if (!reason) {
      Alert.alert(
        "Reason Required",
        "Please select or type a cancellation reason.",
      );
      return;
    }

    // Validate and normalize orderId — use ref as fallback for closure issues
    const activeOrderId = String(orderId || orderIdRef.current || "").trim();
    if (!activeOrderId) {
      console.error("Cancel order error: orderId is missing or invalid");
      Alert.alert(
        "Error",
        "Order ID is missing. Please try again or contact support.",
      );
      return;
    }

    setIsCancelling(true);
    try {
      const token = await getAccessToken();
      const cancelUrl = `${API_BASE_URL}/orders/${activeOrderId}/cancel`;
      console.log(
        "[Order Cancel] Attempting cancel for orderId:",
        activeOrderId,
      );

      const res = await fetch(cancelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancelled_reason: reason }),
      });

      const data = await res.json().catch(() => ({}));

      console.log("[Order Cancel] Response status:", res.status, "data:", data);

      if (res.ok) {
        console.log("[Order Cancel] Success for orderId:", activeOrderId);
        setIsCancelled(true);
        setShowCancelModal(false);
        setCurrentStatus("cancelled");
        Alert.alert(
          "Order Cancelled",
          "Your order has been successfully cancelled.",
          [
            {
              text: "OK",
              onPress: () =>
                navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] }),
            },
          ],
        );
      } else if (res.status === 404) {
        console.error(
          "[Order Cancel] Order not found (404) for orderId:",
          activeOrderId,
        );
        setShowCancelModal(false);
        Alert.alert(
          "Order Not Found",
          "The order could not be found in the system. It may have already been cancelled or processed. Please refresh and try again.",
        );
      } else if (res.status === 409) {
        console.warn(
          "[Order Cancel] Conflict (409) for orderId:",
          activeOrderId,
          data,
        );
        setShowCancelModal(false);
        Alert.alert(
          "Cannot Cancel",
          data.message || "The restaurant has already accepted your order.",
        );
      } else if (res.status === 400) {
        console.error(
          "[Order Cancel] Bad request (400) for orderId:",
          activeOrderId,
          data,
        );
        setShowCancelModal(false);
        Alert.alert(
          "Invalid Request",
          data.message || "Unable to cancel order. Please check and try again.",
        );
      } else {
        console.error(
          "[Order Cancel] Failed with status",
          res.status,
          "for orderId:",
          activeOrderId,
          data,
        );
        Alert.alert(
          "Error",
          data.message ||
            `Failed to cancel order (Error: ${res.status}). Please try again.`,
        );
      }
    } catch (err) {
      console.error("Cancel order error:", err, "orderId:", orderId);
      Alert.alert(
        "Error",
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  /* ── animations ── */
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const statusFade = useRef(new Animated.Value(1)).current;

  /* ── refs ── */
  const prevRouteKeyRef = useRef(null);
  const pollRef = useRef(null);
  const pollNowRef = useRef(null);
  const wasSocketConnectedRef = useRef(Boolean(isSocketConnected));
  const mapRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isProgrammaticMapMoveRef = useRef(false);
  const programmaticMoveTimerRef = useRef(null);
  const sheetDragOffset = useRef(new Animated.Value(0)).current;
  const sheetBaseOffsetRef = useRef(0);
  const sheetScrollYRef = useRef(0);
  const driverLocationRef = useRef(null);
  const deliveryLocationRef = useRef(null);
  const estimatedTimeRef = useRef("");
  const lastOnTheWayEtaRefreshRef = useRef(0);
  const orderIdRef = useRef(orderId);
  const currentStatusRef = useRef(currentStatus);

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  useEffect(() => {
    currentStatusRef.current = currentStatus;
  }, [currentStatus]);

  /* ── derived ── */
  const stepIndex = STEP_INDEX[currentStatus] ?? 0;
  const info = STATUS_TEXT[currentStatus] || STATUS_TEXT.placed;
  const isCooking = COOKING_STATUSES.has(currentStatus);
  const isOTW = currentStatus === "on_the_way";
  const isDone = currentStatus === "delivered";
  const isPreparingMapStage = PREPARING_MAP_STATUSES.has(currentStatus);
  const shouldShowEta = ETA_VISIBLE_STATUSES.has(currentStatus);
  const nextStepMessage = useMemo(
    () => getNextStepMessage(currentStatus),
    [currentStatus],
  );
  const shouldShowDriverCard =
    !!driverInfo &&
    (currentStatus === "accepted" ||
      currentStatus === "driver_accepted" ||
      currentStatus === "driver_assigned" ||
      currentStatus === "picked_up" ||
      isOTW);
  const shouldHideDeliveryAddress =
    currentStatus === "accepted" ||
    currentStatus === "driver_accepted" ||
    currentStatus === "driver_assigned" ||
    currentStatus === "picked_up" ||
    currentStatus === "on_the_way";
  const mapSectionHeight = useMemo(
    () =>
      Math.max(
        clamp(Math.round(windowHeight * 0.48), 280, 460),
        Math.round(windowHeight * 0.52),
      ),
    [windowHeight],
  );
  const sheetTopOffset = useMemo(
    () => clamp(Math.round(windowHeight * 0.4), 220, mapSectionHeight - 22),
    [windowHeight, mapSectionHeight],
  );
  const sheetHalfDownTopOffset = useMemo(
    () => Math.max(sheetTopOffset, Math.round(windowHeight * 0.5)),
    [sheetTopOffset, windowHeight],
  );
  const sheetHalfDownOffset = Math.max(
    0,
    sheetHalfDownTopOffset - sheetTopOffset,
  );
  const mapBottomPadding = Math.max(34, mapSectionHeight - sheetTopOffset + 20);
  const mapCenterShiftFactor = 0.2;
  const sheetBottomPadding = Math.max(18, insets.bottom + 12);
  const shouldLowerSheetContent =
    currentStatus === "picked_up" || currentStatus === "on_the_way";
  const sheetContentTopPadding = shouldLowerSheetContent ? 18 : 2;

  const fitMapToPins = useCallback(() => {
    if (!mapRef.current || !restaurantLocation || !deliveryLocation || isOTW) {
      return;
    }

    isProgrammaticMapMoveRef.current = true;
    if (programmaticMoveTimerRef.current) {
      clearTimeout(programmaticMoveTimerRef.current);
    }

    mapRef.current.fitToCoordinates(
      [
        {
          latitude: restaurantLocation.lat,
          longitude: restaurantLocation.lng,
        },
        {
          latitude: deliveryLocation.lat,
          longitude: deliveryLocation.lng,
        },
      ],
      {
        edgePadding: {
          top: 60,
          right: 50,
          bottom: mapBottomPadding,
          left: 50,
        },
      },
    );

    programmaticMoveTimerRef.current = setTimeout(() => {
      isProgrammaticMapMoveRef.current = false;
    }, 900);
  }, [deliveryLocation, restaurantLocation, mapBottomPadding, isOTW]);

  const handleMapRegionChangeComplete = useCallback(() => {
    if (!isProgrammaticMapMoveRef.current) {
      setShowRecenterButton(true);
    }
  }, []);

  const handleRecenterMap = useCallback(() => {
    setShowRecenterButton(false);
    fitMapToPins();
  }, [fitMapToPins]);

  useEffect(() => {
    if (!isSheetHalfDown) {
      sheetBaseOffsetRef.current = 0;
      Animated.spring(sheetDragOffset, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 170,
        mass: 0.7,
      }).start();
      return;
    }

    sheetBaseOffsetRef.current = sheetHalfDownOffset;
    Animated.spring(sheetDragOffset, {
      toValue: sheetHalfDownOffset,
      useNativeDriver: true,
      damping: 18,
      stiffness: 170,
      mass: 0.7,
    }).start();
  }, [isSheetHalfDown, sheetHalfDownOffset, sheetDragOffset]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const verticalIntent =
            Math.abs(gestureState.dy) > 8 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
          return verticalIntent && sheetScrollYRef.current <= 0;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = clamp(
            sheetBaseOffsetRef.current + gestureState.dy,
            0,
            sheetHalfDownOffset,
          );
          sheetDragOffset.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gestureState) => {
          const dragOffset = clamp(
            sheetBaseOffsetRef.current + gestureState.dy,
            0,
            sheetHalfDownOffset,
          );

          const shouldHalfDown =
            gestureState.vy > 0.25 ||
            gestureState.dy > 40 ||
            dragOffset > sheetHalfDownOffset * 0.45;

          setIsSheetHalfDown(shouldHalfDown);
        },
        onPanResponderTerminate: () => {
          setIsSheetHalfDown(sheetBaseOffsetRef.current > 0);
        },
      }),
    [sheetDragOffset, sheetHalfDownOffset],
  );

  const getBikeEtaMinutes = useCallback(async (driverLoc, customerLoc) => {
    if (
      !driverLoc?.lat ||
      !driverLoc?.lng ||
      !customerLoc?.lat ||
      !customerLoc?.lng
    ) {
      return null;
    }

    try {
      const route = await fetchOSRMRoute({
        from: {
          latitude: Number(driverLoc.lat),
          longitude: Number(driverLoc.lng),
        },
        to: {
          latitude: Number(customerLoc.lat),
          longitude: Number(customerLoc.lng),
        },
        profile: "driving",
        overview: "false",
      });

      if (!route || !Number.isFinite(route.duration)) return null;
      return Math.max(1, Math.ceil(route.duration / 60));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);

  useEffect(() => {
    if (orderId && driverLocation) {
      cacheDriverLastLocation(orderId, driverLocation);
    }
  }, [orderId, driverLocation]);

  useEffect(() => {
    deliveryLocationRef.current = deliveryLocation;
  }, [deliveryLocation]);

  useEffect(() => {
    estimatedTimeRef.current = estimatedTime;
  }, [estimatedTime]);

  useEffect(() => {
    if (currentStatus !== "on_the_way") {
      lastOnTheWayEtaRefreshRef.current = 0;
    }
  }, [currentStatus]);

  const applyRealtimeTrackingPayload = useCallback(
    (payload) => {
      const payloadOrderId = String(
        payload?.order_id || payload?.orderId || "",
      ).trim();
      const activeOrderId = String(orderIdRef.current || "").trim();

      if (
        !payloadOrderId ||
        !activeOrderId ||
        payloadOrderId !== activeOrderId
      ) {
        return;
      }

      const realtimeDriver = resolveDriverInfo(payload);
      if (realtimeDriver) {
        setDriverInfo(realtimeDriver);
        cacheDriverInfo(activeOrderId, realtimeDriver);
      }

      const locationPayload =
        payload?.driver_location || payload?.driverLocation;
      const driverLat = Number(
        locationPayload?.latitude ?? payload?.lat ?? payload?.latitude,
      );
      const driverLng = Number(
        locationPayload?.longitude ?? payload?.lng ?? payload?.longitude,
      );
      const driverHeading = Number(
        locationPayload?.heading ?? payload?.heading ?? 0,
      );

      const nextStatus = normalizeStatus(
        payload?.status ||
          payload?.delivery_status ||
          payload?.orderStatus ||
          "",
      );

      const effectiveLocationStatus =
        nextStatus || normalizeStatus(currentStatusRef.current || "");

      if (
        shouldDisplayLiveDriverLocation(effectiveLocationStatus) &&
        Number.isFinite(driverLat) &&
        Number.isFinite(driverLng)
      ) {
        setDriverLocation({
          lat: driverLat,
          lng: driverLng,
          heading: Number.isFinite(driverHeading) ? driverHeading : 0,
        });
      } else if (!shouldDisplayLiveDriverLocation(effectiveLocationStatus)) {
        setDriverLocation(null);
      }

      if (
        nextStatus &&
        nextStatus !== currentStatusRef.current &&
        STEP_INDEX[nextStatus] !== undefined
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
        setCurrentStatus(nextStatus);
      }

      const etaPayload = payload?.eta;
      const etaMin = Number(
        etaPayload?.etaRangeMin ?? etaPayload?.etaMinutes ?? Number.NaN,
      );
      const etaMax = Number(
        etaPayload?.etaRangeMax ?? etaPayload?.etaMinutes ?? etaMin,
      );

      if (Number.isFinite(etaMin) && Number.isFinite(etaMax)) {
        const effectiveStatus = nextStatus || currentStatusRef.current;
        const isOnTheWayEta =
          effectiveStatus === "on_the_way" || effectiveStatus === "at_customer";

        setEstimatedTime(
          buildEtaDisplayText(etaMin, etaMax, {
            isOnTheWay: isOnTheWayEta,
          }),
        );
        lastOnTheWayEtaRefreshRef.current = Date.now();
      }
    },
    [statusFade],
  );

  useEffect(() => {
    if (!orderId || !on || !off) return;

    const handleDriverLocationUpdate = (payload) => {
      applyRealtimeTrackingPayload(payload);
    };

    const handleOrderStatusUpdate = (payload) => {
      applyRealtimeTrackingPayload(payload);
    };

    on("order:driver_location", handleDriverLocationUpdate);
    on("order:status_update", handleOrderStatusUpdate);

    return () => {
      off("order:driver_location", handleDriverLocationUpdate);
      off("order:status_update", handleOrderStatusUpdate);
    };
  }, [applyRealtimeTrackingPayload, off, on, orderId]);

  useEffect(() => {
    let mounted = true;

    const hydrateTotalFromCache = async () => {
      const cachedTotal = await getCachedOrderDisplayTotal(orderId);
      if (!mounted || !Number.isFinite(cachedTotal)) return;

      setOrderData((prev) => ({
        ...prev,
        totalAmount: resolveOrderDisplayTotal(prev.order, cachedTotal, true),
      }));
    };

    hydrateTotalFromCache();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  useEffect(() => {
    let mounted = true;

    const hydrateLastKnownDriverLocation = async () => {
      const cachedLocation = await getCachedDriverLastLocation(orderId);
      if (!mounted || !cachedLocation) return;

      const effectiveStatus = normalizeStatus(
        currentStatusRef.current || params.status || "",
      );

      if (shouldDisplayLiveDriverLocation(effectiveStatus)) {
        setDriverLocation((prev) => prev || cachedLocation);
      }
    };

    hydrateLastKnownDriverLocation();

    return () => {
      mounted = false;
    };
  }, [orderId, params.status]);

  useEffect(() => {
    let mounted = true;

    const hydrateDriverFromCache = async () => {
      const cachedDriver = await getCachedDriverInfo(orderId);
      if (!mounted || !cachedDriver) return;
      setDriverInfo((prev) => prev || cachedDriver);
    };

    hydrateDriverFromCache();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (!isStatusScreenMode || !orderId) return;

    const targetRoute = getStatusScreenName(currentStatus);
    if (!targetRoute || targetRoute === routeName) return;

    navigation.replace(targetRoute, {
      ...params,
      orderId,
      status: currentStatus,
      order: orderData.order || params.order,
      totalAmount: resolveOrderDisplayTotal(
        orderData.order,
        orderData.totalAmount ?? params.totalAmount ?? 0,
        true,
      ),
      restaurantName: orderData.restaurantName || params.restaurantName,
      restaurantLogoUrl:
        orderData.restaurantLogoUrl || params.restaurantLogoUrl,
      statusScreenMode: true,
    });
  }, [
    isStatusScreenMode,
    orderId,
    currentStatus,
    routeName,
    navigation,
    params,
    orderData.order,
    orderData.totalAmount,
    orderData.restaurantName,
    orderData.restaurantLogoUrl,
  ]);

  const shouldShowEstimatedArrival =
    shouldShowEta &&
    Boolean(estimatedTime) &&
    estimatedTime !== "Calculating...";

  // ===========================================================================
  // FETCH ORDER (if navigated from Orders list, not checkout)
  // ===========================================================================

  // Fetch logo_url for a restaurant from the public API (same source as home page)
  const fetchRestaurantLogo = React.useCallback(async (restaurantId) => {
    if (!restaurantId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/public/restaurants/${restaurantId}`,
      );
      if (res.ok) {
        const json = await res.json();
        const r = json.restaurant || json;
        const logoUrl =
          r.logo_url || r.logo || r.restaurant_logo_url || r.restaurant_logo;
        if (logoUrl) {
          setOrderData((prev) => ({ ...prev, restaurantLogoUrl: logoUrl }));
        }
      }
    } catch (e) {
      console.log("Restaurant logo fetch error:", e);
    }
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      // Use params data for immediate display (optimistic UI)
      if (orderData.order) {
        const o = orderData.order;
        const resolvedStatus = normalizeStatus(
          o.effective_status || o.status || "",
        );
        if (resolvedStatus && !keepInitialPlacedUI)
          setCurrentStatus(resolvedStatus);
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
      }

      // ALWAYS fetch full order from API to get order_items (single source of truth)
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const o = data.order || data;
          const orderDriver = resolveDriverInfo(data) || resolveDriverInfo(o);
          if (orderDriver) {
            setDriverInfo(orderDriver);
            cacheDriverInfo(orderId, orderDriver);
          }
          setOrderData({
            restaurantName:
              o.restaurant_name || orderData.restaurantName || "Restaurant",
            orderNumber: o.order_number || orderData.orderNumber || "",
            address: o.delivery_address || orderData.address || "",
            items: o.order_items || o.items || [],
            totalAmount: resolveOrderDisplayTotal(
              o,
              params.totalAmount ?? orderData.totalAmount ?? 0,
              true,
            ),
            order: o,
            restaurantLogoUrl:
              orderData.restaurantLogoUrl || o.restaurant_logo_url || "",
          });
          // Fetch the restaurant logo from the public API if not present
          if (!orderData.restaurantLogoUrl && !o.restaurant_logo_url) {
            fetchRestaurantLogo(o.restaurant_id || o.restaurant?.id);
          }
          const resolvedFetchStatus = normalizeStatus(
            o.effective_status || o.status || "",
          );
          if (resolvedFetchStatus && !keepInitialPlacedUI)
            setCurrentStatus(resolvedFetchStatus);

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
  }, [orderId, keepInitialPlacedUI]);

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
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE_URL}/orders/${orderId}/delivery-status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const newStatus = normalizeStatus(
          data.effective_status || data.delivery_status || data.status || "",
        );

        const statusDriver = resolveDriverInfo(data);
        if (statusDriver) {
          setDriverInfo(statusDriver);
          cacheDriverInfo(orderId, statusDriver);
        }

        const driverLat = Number(data.driverLocation?.latitude);
        const driverLng = Number(data.driverLocation?.longitude);
        const driverHeading = Number(
          data.driverLocation?.heading ??
            data.driverLocation?.bearing ??
            data.driverLocation?.course ??
            0,
        );
        const parsedDriverLocation =
          Number.isFinite(driverLat) && Number.isFinite(driverLng)
            ? {
                lat: driverLat,
                lng: driverLng,
                heading: Number.isFinite(driverHeading) ? driverHeading : 0,
              }
            : null;

        const effectiveLocationStatus = normalizeStatus(
          newStatus || currentStatusRef.current || "",
        );

        if (
          shouldDisplayLiveDriverLocation(effectiveLocationStatus) &&
          parsedDriverLocation
        ) {
          setDriverLocation(parsedDriverLocation);
        } else if (!shouldDisplayLiveDriverLocation(effectiveLocationStatus)) {
          setDriverLocation(null);
        }

        const customerLat = Number(data.customerLocation?.latitude);
        const customerLng = Number(data.customerLocation?.longitude);
        const parsedCustomerLocation =
          Number.isFinite(customerLat) && Number.isFinite(customerLng)
            ? {
                lat: customerLat,
                lng: customerLng,
              }
            : null;

        if (parsedCustomerLocation) {
          setDeliveryLocation(parsedCustomerLocation);
          if (data.customerLocation.address) {
            setOrderData((prev) => ({
              ...prev,
              address: data.customerLocation.address,
            }));
          }
        }

        const restaurantLat = Number(data.restaurantLocation?.latitude);
        const restaurantLng = Number(data.restaurantLocation?.longitude);
        if (Number.isFinite(restaurantLat) && Number.isFinite(restaurantLng)) {
          setRestaurantLocation({
            lat: restaurantLat,
            lng: restaurantLng,
          });
        }

        // ETA
        const effectiveStatus = normalizeStatus(
          newStatus || data.eta?.driverStatus || currentStatus || "",
        );
        const isOnTheWayEta =
          effectiveStatus === "on_the_way" || effectiveStatus === "at_customer";

        if (isOnTheWayEta) {
          const nowMs = Date.now();
          const shouldRefreshEtaNow =
            !estimatedTimeRef.current ||
            nowMs - lastOnTheWayEtaRefreshRef.current >=
              ON_THE_WAY_ETA_REFRESH_INTERVAL;

          if (shouldRefreshEtaNow) {
            const liveDriverLoc =
              parsedDriverLocation || driverLocationRef.current;
            const liveCustomerLoc =
              parsedCustomerLocation || deliveryLocationRef.current;

            const bikeEtaMinutes = await getBikeEtaMinutes(
              liveDriverLoc,
              liveCustomerLoc,
            );

            const serverEtaMinutes = Number(data.eta?.etaMinutes);
            const serverEstimatedDuration = Number(data.estimatedDuration);
            const serverEtaMin = Number(data.eta?.etaRangeMin);

            const preferredEtaMinutes =
              (Number.isFinite(bikeEtaMinutes) && bikeEtaMinutes) ||
              (Number.isFinite(serverEtaMinutes) && serverEtaMinutes) ||
              (Number.isFinite(serverEstimatedDuration) &&
                serverEstimatedDuration) ||
              (Number.isFinite(serverEtaMin) && serverEtaMin) ||
              null;

            if (Number.isFinite(preferredEtaMinutes)) {
              setEstimatedTime(
                buildEtaDisplayText(preferredEtaMinutes, preferredEtaMinutes, {
                  isOnTheWay: true,
                }),
              );
              lastOnTheWayEtaRefreshRef.current = nowMs;
            }
          }
        } else if (
          data.eta?.etaRangeMin != null &&
          data.eta?.etaRangeMax != null
        ) {
          setEstimatedTime(
            buildEtaDisplayText(data.eta.etaRangeMin, data.eta.etaRangeMax, {
              isOnTheWay: false,
            }),
          );
        } else if (data.estimatedDuration) {
          setEstimatedTime(
            buildEtaDisplayText(
              data.estimatedDuration,
              data.estimatedDuration,
              {
                isOnTheWay: false,
              },
            ),
          );
        } else {
          setEstimatedTime("");
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

    pollNowRef.current = poll;

    poll();
    const isLiveDeliveryStatus =
      currentStatus === "on_the_way" || currentStatus === "at_customer";

    const intervalMs = isLiveDeliveryStatus
      ? isSocketConnected
        ? SOCKET_CONNECTED_POLL_INTERVAL
        : SOCKET_FALLBACK_POLL_INTERVAL
      : POLL_INTERVAL;

    pollRef.current = setInterval(poll, intervalMs);
    return () => {
      clearInterval(pollRef.current);
      pollNowRef.current = null;
    };
  }, [orderId, loading, currentStatus, getBikeEtaMinutes, isSocketConnected]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        const previousAppState = appStateRef.current;
        appStateRef.current = nextAppState;

        if (
          previousAppState.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          pollNowRef.current?.();
        }
      },
    );

    return () => {
      appStateSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    const wasConnected = wasSocketConnectedRef.current;
    const isConnectedNow = Boolean(isSocketConnected);

    if (!wasConnected && isConnectedNow) {
      pollNowRef.current?.();
    }

    wasSocketConnectedRef.current = isConnectedNow;
  }, [isSocketConnected]);

  // ===========================================================================
  // LINE ROUTE for map statuses (curved for preparing stage, straight otherwise)
  // ===========================================================================
  useEffect(() => {
    if (currentStatus === "on_the_way") {
      // No route line when on the way — live driver tracking
      setRouteCoords([]);
      return;
    }
    if (restaurantLocation && deliveryLocation) {
      const start = {
        latitude: restaurantLocation.lat,
        longitude: restaurantLocation.lng,
      };
      const end = {
        latitude: deliveryLocation.lat,
        longitude: deliveryLocation.lng,
      };
      setRouteCoords(
        PREPARING_MAP_STATUSES.has(currentStatus)
          ? createTopArcRoute(start, end)
          : [start, end],
      );
    }
  }, [restaurantLocation, deliveryLocation, currentStatus]);

  // Continuous marching animation for preparing route from customer -> restaurant.
  useEffect(() => {
    if (!isPreparingMapStage || isOTW || routeCoords.length < 2) {
      setRouteFlowOffset(0);
      return;
    }

    const timer = setInterval(() => {
      setRouteFlowOffset((prev) => (prev <= -72 ? 0 : prev - 2));
    }, 120);

    return () => clearInterval(timer);
  }, [isPreparingMapStage, isOTW, routeCoords.length]);

  // ===========================================================================
  // LIVE DRIVER TRACKING — now handled by LiveDriverMap component
  // ===========================================================================

  // Fit map bounds after map loads for cooking statuses (not OTW)
  // Bottom padding accounts for the bottom sheet covering ~55% of screen
  useEffect(() => {
    if (
      !isOTW &&
      MAP_STATUSES.has(currentStatus) &&
      restaurantLocation &&
      deliveryLocation &&
      mapRef.current &&
      !showRecenterButton
    ) {
      const timer = setTimeout(() => {
        fitMapToPins();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [
    currentStatus,
    isOTW,
    restaurantLocation,
    deliveryLocation,
    mapBottomPadding,
    showRecenterButton,
    fitMapToPins,
  ]);

  useEffect(() => {
    return () => {
      if (programmaticMoveTimerRef.current) {
        clearTimeout(programmaticMoveTimerRef.current);
      }
    };
  }, []);

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
      const token = await getAccessToken();
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
  // LOADING SKELETON
  // ===========================================================================

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#E6F9EE" }}
        edges={["top"]}
      >
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#06C168" />
          <Text
            style={{
              color: "#06C168",
              marginTop: 10,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            Loading order...
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: "#fff",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -20,
            padding: 20,
            gap: 16,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#D1D5DB",
            }}
          />
          <SkeletonBlock width="55%" height={22} borderRadius={8} />
          <SkeletonBlock width="45%" height={14} borderRadius={6} />
          <SkeletonBlock width="100%" height={8} borderRadius={4} />
          <SkeletonBlock width="100%" height={64} borderRadius={14} />
          <SkeletonBlock width="100%" height={56} borderRadius={14} />
        </View>
      </SafeAreaView>
    );
  }

  if (isDone) {
    const itemCount = (orderData.items || []).reduce(
      (sum, item) => sum + (Number(item?.quantity) || 1),
      0,
    );
    const restaurantName = orderData.restaurantName || "Restaurant";
    const orderNumber =
      orderData.orderNumber || orderData.order?.order_number || "Not available";
    const deliveryAddress =
      orderData.address || orderData.order?.delivery_address || "Not available";
    const orderTotal = parseFloat(orderData.totalAmount || 0).toFixed(2);
    const reportTopPadding = Math.max(insets.top + 26, 46);

    return (
      <View style={st.reportRoot}>
        <StatusBar barStyle="dark-content" backgroundColor="#EEF8F1" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            st.reportScrollContent,
            {
              paddingTop: reportTopPadding,
              paddingBottom: Math.max(insets.bottom + 20, 30),
            },
          ]}
          bounces={false}
        >
          <View style={st.reportHeroCard}>
            <View style={st.reportHeroIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color="#06C168" />
            </View>
            <Text style={st.reportHeroTitle}>Thank you for your order!</Text>
            <Text style={st.reportHeroSubtitle}>
              Your delivery is complete and successfully delivered.
            </Text>
            <Text style={st.reportHeroGoodNote}>
              We hope your meal brought a smile to your day. We look forward to
              serving you again soon.
            </Text>
          </View>

          <View style={st.reportCardBox}>
            <View style={st.reportPill}>
              <Text style={st.reportPillTxt}>Delivery Report</Text>
            </View>

            <View style={st.reportRow}>
              <Text style={st.reportLabel}>Status</Text>
              <Text style={st.reportValueSuccess}>Delivered</Text>
            </View>
            <View style={st.reportDivider} />

            <View style={st.reportRow}>
              <Text style={st.reportLabel}>Restaurant</Text>
              <Text style={st.reportValue} numberOfLines={1}>
                {restaurantName}
              </Text>
            </View>
            <View style={st.reportDivider} />

            <View style={st.reportRow}>
              <Text style={st.reportLabel}>Order Number</Text>
              <Text style={st.reportValue} numberOfLines={1}>
                {orderNumber}
              </Text>
            </View>
            <View style={st.reportDivider} />

            <View style={st.reportDivider} />

            <View style={st.reportRow}>
              <Text style={st.reportLabel}>Total Paid</Text>
              <Text style={st.reportTotal}>LKR {orderTotal}</Text>
            </View>
            <View style={st.reportDivider} />

            <View style={[st.reportRow, st.reportRowTop]}>
              <Text style={st.reportLabel}>Delivered To</Text>
              <Text style={st.reportValueAddress} numberOfLines={3}>
                {deliveryAddress}
              </Text>
            </View>
          </View>

          <View style={st.actionRow}>
            <Pressable style={st.orderAgainBtn} onPress={goHome}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={st.orderAgainTxt}>Order Again</Text>
            </Pressable>
            <Pressable style={st.goHomeBtn} onPress={goHome}>
              <Ionicons name="home-outline" size={20} color="#06C168" />
              <Text style={st.goHomeTxt}>Back to Home</Text>
            </Pressable>
          </View>
        </ScrollView>
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
      <StatusBar barStyle="dark-content" backgroundColor="#E6F9EE" />

      {/* ══════ HERO: MAP or GREEN BACKGROUND ══════ */}
      <View style={[st.mapStage, { height: mapSectionHeight }]}>
        {isOTW ? (
          /* ── On-the-way: dedicated tight-zoom driver-only map ── */
          <View style={st.mapWrap}>
            <LiveDriverMap
              orderId={orderId}
              driverLocation={driverLocation}
              deliveryLocation={deliveryLocation}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        ) : MAP_STATUSES.has(currentStatus) &&
          restaurantLocation &&
          deliveryLocation ? (
          <View style={st.mapWrap}>
            <OSMMapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={(() => {
                const latD =
                  Math.abs(restaurantLocation.lat - deliveryLocation.lat) *
                    2.2 +
                  0.012;
                const lngD =
                  Math.abs(restaurantLocation.lng - deliveryLocation.lng) *
                    2.2 +
                  0.012;
                // Keep map center slightly upward so both markers remain visible above the sheet overlap.
                return {
                  latitude:
                    (restaurantLocation.lat + deliveryLocation.lat) / 2 -
                    latD * mapCenterShiftFactor,
                  longitude:
                    (restaurantLocation.lng + deliveryLocation.lng) / 2,
                  latitudeDelta: latD,
                  longitudeDelta: lngD,
                };
              })()}
              scrollEnabled={true}
              zoomEnabled={true}
              onRegionChangeComplete={handleMapRegionChangeComplete}
              markers={[
                {
                  id: "restaurant",
                  coordinate: {
                    latitude: restaurantLocation.lat,
                    longitude: restaurantLocation.lng,
                  },
                  type: "restaurant",
                  title: orderData.restaurantName || "Restaurant",
                  emoji: "",
                  customHtml: RESTAURANT_MARKER_HTML,
                  iconSize: [30, 42],
                  iconAnchor: [15, 42],
                  iconOnly: true,
                },
                {
                  id: "customer",
                  coordinate: {
                    latitude: deliveryLocation.lat,
                    longitude: deliveryLocation.lng,
                  },
                  type: "customer",
                  title: "Delivery",
                  emoji: "",
                  customHtml: CUSTOMER_MARKER_HTML,
                  iconSize: [30, 42],
                  iconAnchor: [15, 42],
                  iconOnly: true,
                },
              ]}
              polylines={
                routeCoords.length > 1
                  ? isPreparingMapStage
                    ? [
                        {
                          id: "route-flow",
                          coordinates: [...routeCoords].reverse(),
                          strokeColor: "#06C168",
                          strokeWidth: 6,
                          strokeOpacity: 0.98,
                          dashArray: "4, 14",
                          dashOffset: String(routeFlowOffset),
                        },
                      ]
                    : [
                        {
                          id: "route",
                          coordinates: routeCoords,
                          strokeColor: "#111827",
                          strokeWidth: 3,
                          dashArray: "10, 10",
                        },
                      ]
                  : []
              }
            />

            {showRecenterButton && (
              <Pressable
                style={[
                  st.recenterBtn,
                  { bottom: Math.max(14, mapBottomPadding - 10) },
                ]}
                onPress={handleRecenterMap}
              >
                <Ionicons name="locate" size={20} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        ) : currentStatus === "placed" || isDone ? (
          <View style={st.heroWrap}>
            <OrderPlacedBackground />
          </View>
        ) : (
          <View style={st.heroWrap}>
            {/* bg gradient layers */}
            <View style={st.heroBgLayer1} />
            <View style={st.heroBgLayer2} />
            {/* Floating food icons */}
            <FloatingFoodIcons />
            {/* Status icon with pulse rings */}
            <StatusIconBubble status={currentStatus} />
          </View>
        )}
      </View>

      {/* Back Button */}
      {!isDone && (
        <Pressable
          style={[st.backBtn, { top: Math.max(insets.top + 10, 44) }]}
          onPress={goBack}
        >
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>
      )}

      {/* Copied toast */}
      {phoneCopied && (
        <View style={[st.toast, { top: Math.max(insets.top + 54, 90) }]}>
          <Ionicons name="checkmark-circle" size={15} color="#06C168" />
          <Text style={st.toastTxt}>Phone number copied!</Text>
        </View>
      )}

      {/* ══════ BOTTOM SHEET (web-matching structure) ══════ */}
      <Animated.View
        {...sheetPanResponder.panHandlers}
        style={[
          st.sheet,
          {
            top: sheetTopOffset,
            transform: [
              { translateY: sheetY },
              { translateY: sheetDragOffset },
            ],
            opacity: contentFade,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={st.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            sheetScrollYRef.current = event.nativeEvent.contentOffset.y || 0;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            st.sheetInner,
            {
              paddingTop: sheetContentTopPadding,
              paddingBottom: sheetBottomPadding,
            },
          ]}
          bounces={false}
        >
          {/* 1) Status title + ETA */}
          <Animated.View style={{ opacity: statusFade }}>
            <Text style={[st.title, isDone && st.titleSuccess]}>
              {info.title}
            </Text>
            <Text style={st.statusNextTxt}>{nextStepMessage}</Text>
            {shouldShowEstimatedArrival ? (
              <Text style={st.statusEtaTxt}>{estimatedTime}</Text>
            ) : null}
          </Animated.View>

          {/* 2) Segmented progress bar */}
          <ProgressBar stepIndex={stepIndex} />

          {/* 3) Driver card (accepted / picked_up / on_the_way) */}
          {shouldShowDriverCard && <DriverCard driver={driverInfo} />}

          {/* ── Delivered: premium thank-you screen ── */}
          {isDone ? (
            <>
              <View style={st.thankYouWrap}>
                <View style={st.thankYouIconCircle}>
                  <Ionicons name="checkmark-circle" size={52} color="#06C168" />
                </View>
                <Text style={st.thankYouTitle}>Thank you for your order!</Text>
                <Text style={st.thankYouBody}>
                  Your food has been successfully delivered.{"\n"}
                  We hope you enjoyed your meal and look forward to serving you
                  again.
                </Text>
              </View>
            </>
          ) : (
            <>
              {/* 4) Delivery Address Card */}
              {!shouldHideDeliveryAddress && (
                <View style={st.deliveryAddressCard}>
                  <View style={st.deliveryAddressRow}>
                    <Ionicons name="location" size={18} color="#06C168" />
                    <View style={st.deliveryAddressContent}>
                      <Text style={st.deliveryAddressLabel}>
                        DELIVERY ADDRESS
                      </Text>
                      <Text style={st.deliveryAddressText} numberOfLines={2}>
                        {orderData.address || "Your delivery address"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 5) Order Summary Card */}
              <View
                style={shouldHideDeliveryAddress ? st.summaryCardOffset : null}
              >
                <OrderSummaryCard
                  data={orderData}
                  expanded={viewOrderExpanded}
                  onToggle={() => setViewOrderExpanded(!viewOrderExpanded)}
                />
              </View>

              {/* 6) Cancel Order Button — only visible in 'placed' status */}
              {currentStatus === "placed" && !isCancelled && (
                <Pressable
                  style={st.cancelOrderBtn}
                  onPress={() => setShowCancelModal(true)}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#DC2626"
                  />
                  <Text style={st.cancelOrderTxt}>Cancel Order</Text>
                </Pressable>
              )}
            </>
          )}

          {/* 8) Delivered action buttons */}
          {isDone && (
            <View style={st.actionRow}>
              <Pressable style={st.orderAgainBtn} onPress={goHome}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={st.orderAgainTxt}>Order Again</Text>
              </Pressable>
              <Pressable style={st.goHomeBtn} onPress={goHome}>
                <Ionicons name="home-outline" size={20} color="#06C168" />
                <Text style={st.goHomeTxt}>Back to Home</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ══════ CANCEL ORDER MODAL ══════ */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isCancelling && setShowCancelModal(false)}
      >
        <View style={st.cancelModalOverlay}>
          <View style={st.cancelModalContent}>
            <View style={st.cancelModalHeader}>
              <Ionicons name="warning-outline" size={28} color="#DC2626" />
              <Text style={st.cancelModalTitle}>Cancel Order?</Text>
              <Text style={st.cancelModalSubtitle}>
                Please tell us why you want to cancel
              </Text>
            </View>

            <ScrollView
              style={st.cancelReasonsScroll}
              showsVerticalScrollIndicator={false}
            >
              {CANCEL_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  style={[
                    st.cancelReasonItem,
                    cancelReason === reason && st.cancelReasonItemActive,
                  ]}
                  onPress={() => setCancelReason(reason)}
                >
                  <View
                    style={[
                      st.cancelReasonRadio,
                      cancelReason === reason && st.cancelReasonRadioActive,
                    ]}
                  >
                    {cancelReason === reason && (
                      <View style={st.cancelReasonRadioDot} />
                    )}
                  </View>
                  <Text
                    style={[
                      st.cancelReasonText,
                      cancelReason === reason && st.cancelReasonTextActive,
                    ]}
                  >
                    {reason}
                  </Text>
                </Pressable>
              ))}

              {cancelReason === "Other" && (
                <TextInput
                  style={st.cancelReasonInput}
                  placeholder="Type your reason..."
                  placeholderTextColor="#9CA3AF"
                  value={customCancelReason}
                  onChangeText={setCustomCancelReason}
                  multiline
                  maxLength={200}
                />
              )}
            </ScrollView>

            <View style={st.cancelModalActions}>
              <Pressable
                style={st.cancelModalKeepBtn}
                onPress={() => !isCancelling && setShowCancelModal(false)}
                disabled={isCancelling}
              >
                <Text style={st.cancelModalKeepTxt}>Keep Order</Text>
              </Pressable>
              <Pressable
                style={[
                  st.cancelModalConfirmBtn,
                  (!cancelReason || isCancelling) && { opacity: 0.5 },
                ]}
                onPress={handleCancelOrder}
                disabled={!cancelReason || isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={st.cancelModalConfirmTxt}>Confirm Cancel</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// STYLES  (web-matching design)
// =============================================================================

const st = StyleSheet.create({
  /* ── layout ── */
  root: { flex: 1, backgroundColor: "#E6F9EE" },
  reportRoot: { flex: 1, backgroundColor: "#EEF8F1" },
  reportScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  reportHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  reportHeroIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#EAFBF1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  reportHeroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },
  reportHeroSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  reportHeroGoodNote: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  reportCardBox: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  reportPill: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  reportPillTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    letterSpacing: 0.3,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
  },
  reportRowTop: {
    alignItems: "flex-start",
  },
  reportLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  reportValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  reportValueSuccess: {
    fontSize: 14,
    fontWeight: "800",
    color: "#06C168",
  },
  reportTotal: {
    fontSize: 17,
    fontWeight: "800",
    color: "#06C168",
  },
  reportValueAddress: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    lineHeight: 18,
  },
  reportDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },

  /* ── map container ── */
  mapStage: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#E6F9EE",
  },
  mapWrap: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  recenterBtn: {
    position: "absolute",
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 8,
  },

  /* ── hero background (light green gradient, web-matching) ── */
  heroWrap: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E6F9EE",
  },
  heroBgLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#E6F9EE",
  },
  heroBgLayer2: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "60%",
    backgroundColor: "#86E5AF",
    opacity: 0.35,
  },

  /* ── floating food icons ── */
  floatingIcon: {
    position: "absolute",
    fontSize: 32,
  },

  /* ── status icon area (icon only, no circle shell) ── */
  statusBubbleWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
  },

  /* ── back button (light bg for light hero) ── */
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 44,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  /* ── toast ── */
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

  /* ── bottom sheet ── */
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 2,
  },
  sheetInner: { paddingHorizontal: 20, paddingBottom: 34, paddingTop: 2 },

  /* ── 1) title + ETA ── */
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginTop: 6,
    marginBottom: 1,
  },
  titleSuccess: { color: "#06C168" },
  statusEtaTxt: {
    fontSize: 16,
    color: "#374151",
    marginTop: 0,
    marginBottom: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  statusNextTxt: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 12,
    fontWeight: "500",
  },

  /* ── 2) progress bar (6 segments + labels) ── */
  progressContainer: { marginBottom: 14 },
  progressTrack: { flexDirection: "row", gap: 4, height: 6 },
  progressSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressDone: { backgroundColor: "#06C168" },
  progressFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#06C168",
    borderRadius: 3,
  },
  progressSweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 28,
    borderRadius: 3,
    backgroundColor: "#06C168",
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressLabel: {
    flex: 1,
    fontSize: 9,
    color: "#9CA3AF",
    textAlign: "center",
    fontWeight: "500",
  },
  progressLabelActive: { color: "#06C168", fontWeight: "700" },

  /* ── 3) View Order collapsible ── */
  viewOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 16,
  },
  viewOrderText: { fontSize: 15, fontWeight: "500", color: "#1F2937" },

  /* expanded order details */
  orderDetailsExpanded: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 5,
  },
  detailLabel: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
  detailValue: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
    maxWidth: "58%",
    textAlign: "right",
  },
  itemsSection: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 4,
    paddingTop: 8,
    gap: 4,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  itemRowLeft: { fontSize: 13, color: "#4B5563", flex: 1, marginRight: 8 },
  itemRowRight: { fontSize: 13, color: "#374151", fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#06C168",
    marginTop: 8,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 14, color: "#374151", fontWeight: "700" },
  totalAmount: { fontSize: 16, color: "#06C168", fontWeight: "800" },

  /* ── delivery address card ── */
  deliveryAddressCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deliveryAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  deliveryAddressContent: {
    flex: 1,
  },
  deliveryAddressLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  deliveryAddressText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    lineHeight: 20,
  },

  /* ── 3) summary card ── */
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  summaryCardOffset: {
    marginTop: 6,
  },
  /* restaurant section (always visible) */
  summaryRestaurantSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryRestaurantLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EDFBF2",
  },
  summaryRestaurantLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  summaryRestaurantLogoFallback: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#B8F0D0",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryRestaurantLogoInitial: {
    fontSize: 22,
    fontWeight: "800",
    color: "#06C168",
  },
  summaryRestaurantName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  summaryOrderNum: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  /* total section (always visible) */
  summaryTotalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  summaryTotalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 0.5,
  },
  summaryTotalVal: {
    fontSize: 17,
    fontWeight: "800",
    color: "#06C168",
  },
  /* view details toggle */
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#F9FAFB",
  },
  viewDetailsText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  /* expanded details area */
  detailsExpanded: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  detailBlock: { gap: 6 },
  detailBlockLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.8,
  },
  detailAddrRow: {
    flexDirection: "row",
    gap: 6,
  },
  detailAddrText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    lineHeight: 19,
  },
  detailItemsBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    overflow: "hidden",
  },
  detailItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  detailItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailQtyBadge: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  detailQtyTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#06C168",
  },
  detailItemName: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  detailItemPrice: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  /* ordered items in View Details */
  orderedItemRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  orderedItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  orderedItemSize: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  /* ── 4) restaurant card (kept for reference, now replaced by summaryCard) ── */
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  restaurantLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  restaurantLogoImg: { width: 44, height: 44, borderRadius: 22 },
  restaurantInfo: { flex: 1 },
  restaurantNameTxt: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  restaurantSubtitleTxt: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  /* ── 5) driver card (compact) ── */
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 9,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  driverAvatarWrap: { marginRight: 10 },
  driverAvatar: { width: 40, height: 40, borderRadius: 20 },
  driverAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F9EE",
    justifyContent: "center",
    alignItems: "center",
  },
  driverMeta: { flex: 1 },
  driverName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  driverRowText: { fontSize: 11, color: "#111827" },
  driverPhoneText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── 7) info message (italic 3D animated text, web-matching) ── */
  infoMsgContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  infoMsgText: {
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#06C168",
    textAlign: "center",
    lineHeight: 26,
  },

  /* ── rating ── */
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
    backgroundColor: "#06C168",
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
  ratingDoneText: { fontSize: 14, fontWeight: "600", color: "#06C168" },

  /* ── action buttons (delivered) ── */
  actionRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  orderAgainBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#06C168",
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
    backgroundColor: "#EDFBF2",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#06C168",
  },
  goHomeTxt: { color: "#06C168", fontSize: 15, fontWeight: "700" },

  /* ── delivered thank-you section ── */
  thankYouWrap: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 8,
  },
  thankYouIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E6F9EE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  thankYouTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
  },
  thankYouBody: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  quoteDivider: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#B8F0D0",
    marginVertical: 20,
  },
  quoteText: {
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "italic",
    color: "#06C168",
    textAlign: "center",
    lineHeight: 20,
  },

  /* ── cancel order ── */
  cancelOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  cancelOrderTxt: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },

  /* cancel modal */
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cancelModalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    maxHeight: "80%",
  },
  cancelModalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    marginTop: 10,
  },
  cancelModalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  cancelReasonsScroll: {
    maxHeight: 280,
  },
  cancelReasonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
    backgroundColor: "#FAFAFA",
  },
  cancelReasonItemActive: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  cancelReasonRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelReasonRadioActive: {
    borderColor: "#DC2626",
  },
  cancelReasonRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DC2626",
  },
  cancelReasonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  cancelReasonTextActive: {
    fontWeight: "700",
    color: "#DC2626",
  },
  cancelReasonInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#F9FAFB",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  cancelModalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  cancelModalKeepBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#06C168",
    alignItems: "center",
  },
  cancelModalKeepTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#06C168",
  },
  cancelModalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#DC2626",
    alignItems: "center",
  },
  cancelModalConfirmTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
