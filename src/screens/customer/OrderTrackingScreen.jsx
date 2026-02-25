/**
 * Order Tracking Screen — Premium Order Status Flow
 *
 * Handles ALL order statuses in a single screen with dynamic UI:
 *   placed → pending/received → accepted → picked_up → on_the_way → delivered
 *
 * Features:
 *   - FreeMapView (Leaflet + OpenStreetMap via WebView) — NO API keys needed
 *   - Map shown for: received, accepted, picked_up, on_the_way
 *   - Gradient + floating icons for: placed, delivered
 *   - Restaurant & customer location markers
 *   - Driver marker with live position (when driver assigned)
 *   - OSRM polyline route (free, no API key)
 *   - 6-segment animated progress bar
 *   - Driver & vehicle info cards
 *   - Star rating (delivered)
 *   - Polls GET /orders/{orderId}/delivery-status every 2s
 *   - Smooth animated transitions between statuses
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
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
  Easing,
  StatusBar,
  Linking,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import Svg, { G, Circle, Rect, Path, Ellipse } from "react-native-svg";
import FreeMapView from "../../components/maps/FreeMapView";
import { API_BASE_URL } from "../../constants/api";
import { formatETAClockTime } from "../../utils/etaFormatter";

const { width: SW, height: SH } = Dimensions.get("window");

// =============================================================================
// CONSTANTS
// =============================================================================

const PROGRESS_STEPS = [
  { key: "received" },
  { key: "accepted" },
  { key: "picked_up" },
  { key: "on_the_way" },
  { key: "delivered" },
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

/** Statuses that show the native map instead of gradient */
const MAP_STATUSES = new Set([
  "pending",
  "received",
  "accepted",
  "picked_up",
  "on_the_way",
]);

const STATUS_INFO = {
  placed: {
    title: "Order Placed!",
    subtitle: "We've received your order",
    message:
      "Your order has been placed successfully.\nWe're notifying the restaurant.",
    iconName: "checkmark-circle",
    floatingIcons: [],
    gradientColors: ["#10B981", "#10B981", "#10B981"],
  },
  pending: {
    title: "Preparing Your Order",
    subtitle: "The restaurant is cooking your meal",
    message: "Your delicious meal is being prepared with care.",
    iconName: "restaurant",
    floatingIcons: ["🍳", "👨‍🍳", "🔥", "🫕", "🥘", "💨"],
    gradientColors: ["#064E3B", "#065F46", "#047857"],
  },
  received: {
    title: "Preparing Your Order",
    subtitle: "The restaurant is cooking your meal",
    message: "Your delicious meal is being prepared with care.",
    iconName: "restaurant",
    floatingIcons: ["🍳", "👨‍🍳", "🔥", "🫕", "🥘", "💨"],
    gradientColors: ["#064E3B", "#065F46", "#047857"],
  },
  accepted: {
    title: "Driver Accepted",
    subtitle: "A driver has accepted your order",
    message: "Your driver is on the way to pick up your order.",
    iconName: "person",
    floatingIcons: ["🛵", "📦", "🏪", "🗺️", "⏱️", "🚗"],
    gradientColors: ["#064E3B", "#065F46", "#047857"],
  },
  picked_up: {
    title: "Order Picked Up",
    subtitle: "Driver has picked up your order",
    message: "Your order is now with the driver and on the way.",
    iconName: "bag-check",
    floatingIcons: ["🛵", "📦", "🏠", "🗺️", "⏱️", "🚗"],
    gradientColors: ["#064E3B", "#065F46", "#047857"],
  },
  on_the_way: {
    title: "On The Way",
    subtitle: "Your driver is heading to your location",
    message: "",
    iconName: "navigate",
    floatingIcons: [],
    gradientColors: [],
  },
  delivered: {
    title: "Order Delivered!",
    subtitle: "Enjoy your meal! Thank you for ordering with NearMe.",
    message: "",
    iconName: "checkmark-done-circle",
    floatingIcons: ["🎉", "✨", "🍽️", "⭐", "🎊", "👍"],
    gradientColors: ["#064E3B", "#065F46", "#047857"],
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

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/* ─── Animated Segment (Uber-style fill) ─── */
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
        ])
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
        <Animated.View
          style={[
            st.progressFill,
            { width, opacity },
          ]}
        />
      </View>
    );
  }

  return <View style={st.progressSeg} />;
});

/* ─── Progress Bar (5 segments, no labels) ─── */
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

/* ─── Placed Progress Bar (1 segment with animation) ─── */
const PlacedProgressBar = React.memo(() => (
  <View style={st.progressContainer}>
    <View style={st.progressTrack}>
      <AnimatedSegment done={false} active={true} />
    </View>
  </View>
));

/* ─── Bike Delivery Animation (placed status) ─── */
const DeliveryBikeSVG = React.memo(() => (
  <Svg width={150} height={130} viewBox="0 0 150 130">
    {/* ── Ground shadow ── */}
    <Ellipse cx="75" cy="122" rx="60" ry="5" fill="rgba(0,0,0,0.08)" />

    {/* ── Back wheel (right side) ── */}
    <Circle cx="118" cy="105" r="17" fill="#374151" />
    <Circle cx="118" cy="105" r="13" fill="#D1D5DB" />
    <Circle cx="118" cy="105" r="9" fill="#E5E7EB" />
    <Circle cx="118" cy="105" r="3.5" fill="#6B7280" />
    {/* Spokes */}
    <Path d="M118 92 L118 118 M105 105 L131 105 M109 96 L127 114 M127 96 L109 114" stroke="#9CA3AF" strokeWidth="0.8" />

    {/* ── Front wheel (left side) ── */}
    <Circle cx="30" cy="105" r="17" fill="#374151" />
    <Circle cx="30" cy="105" r="13" fill="#D1D5DB" />
    <Circle cx="30" cy="105" r="9" fill="#E5E7EB" />
    <Circle cx="30" cy="105" r="3.5" fill="#6B7280" />
    <Path d="M30 92 L30 118 M17 105 L43 105 M21 96 L39 114 M39 96 L21 114" stroke="#9CA3AF" strokeWidth="0.8" />

    {/* ── Scooter frame ── */}
    {/* Main body */}
    <Path d="M30 100 C35 72 50 68 68 68 L95 70 C108 72 118 85 118 100" fill="#34D399" stroke="#059669" strokeWidth="1.5" />
    {/* Floor board */}
    <Path d="M42 88 L78 88 L78 92 L42 92 Z" fill="#059669" rx="2" />
    {/* Front mudguard */}
    <Path d="M22 90 C26 78 34 78 38 82" fill="#34D399" stroke="#059669" strokeWidth="1" />
    {/* Rear mudguard */}
    <Path d="M110 90 C114 78 122 78 126 82" fill="#34D399" stroke="#059669" strokeWidth="1" />
    {/* Seat */}
    <Path d="M62 62 C64 58 88 58 90 62" fill="#065F46" stroke="#064E3B" strokeWidth="1" />
    <Rect x="62" y="62" width="28" height="6" rx="3" fill="#065F46" />
    {/* Handlebar stem */}
    <Path d="M38 82 L28 55" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" />
    {/* Handlebar */}
    <Path d="M22 52 L34 52" stroke="#4B5563" strokeWidth="3.5" strokeLinecap="round" />
    {/* Headlight */}
    <Circle cx="25" cy="62" r="4" fill="#FDE68A" stroke="#F59E0B" strokeWidth="1" />
    {/* Exhaust */}
    <Rect x="123" y="92" width="12" height="4" rx="2" fill="#9CA3AF" />
    <Circle cx="136" cy="94" r="2.5" fill="#6B7280" />

    {/* ── Driver (side profile facing LEFT) ── */}
    {/* Back leg (behind - slightly visible) */}
    <Path d="M72 68 L68 82 L62 92" stroke="#4B5563" strokeWidth="5.5" strokeLinecap="round" fill="none" />
    <Ellipse cx="60" cy="93" rx="7" ry="3.5" fill="#1F2937" />
    {/* Front leg */}
    <Path d="M70 68 L64 82 L56 92" stroke="#6B7280" strokeWidth="6" strokeLinecap="round" fill="none" />
    <Ellipse cx="54" cy="93" rx="7" ry="3.5" fill="#374151" />

    {/* Torso (side view - narrower) */}
    <Path d="M68 36 C60 36 58 42 58 48 L58 66 C58 70 62 72 68 72 C74 72 76 70 76 66 L76 48 C76 42 74 36 68 36Z" fill="#7C3AED" />
    {/* Jacket detail */}
    <Path d="M62 50 L62 64" stroke="#6D28D9" strokeWidth="1" />
    <Path d="M58 44 C56 44 55 46 56 48" stroke="#6D28D9" strokeWidth="1.5" />

    {/* Back arm (behind torso) */}
    <Path d="M66 42 L58 52 L48 56" stroke="#6D28D9" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    {/* Front arm reaching handlebar */}
    <Path d="M64 40 L52 50 L36 54" stroke="#7C3AED" strokeWidth="5" strokeLinecap="round" fill="none" />
    {/* Hand on handlebar */}
    <Circle cx="35" cy="54" r="3.5" fill="#F59E0B" />
    {/* Back hand */}
    <Circle cx="48" cy="56" r="3" fill="#D97706" />

    {/* Neck (side view) */}
    <Path d="M66 30 L66 36" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />

    {/* Head (side profile) */}
    <Circle cx="64" cy="22" r="11" fill="#F59E0B" />
    {/* Face features - looking left */}
    <Circle cx="57" cy="21" r="1.5" fill="#1F2937" />
    {/* Nose */}
    <Path d="M54 23 L52 25 L55 25" fill="#D97706" />
    {/* Mouth */}
    <Path d="M55 27 C56 28 58 28 59 27" stroke="#92400E" strokeWidth="0.8" fill="none" />
    {/* Ear */}
    <Ellipse cx="72" cy="22" rx="2.5" ry="3.5" fill="#D97706" />

    {/* Helmet */}
    <Path d="M52 18 C52 6 64 2 74 6 C78 8 78 16 76 20 L72 18 C68 12 58 12 54 18 Z" fill="#059669" />
    {/* Helmet rim */}
    <Path d="M52 18 C54 20 72 20 76 18" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Helmet shine */}
    <Path d="M58 8 C62 6 68 6 72 8" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
    {/* Visor */}
    <Path d="M53 18 L50 16 L50 14 C54 12 58 14 56 18" fill="rgba(255,255,255,0.25)" stroke="#047857" strokeWidth="0.5" />

    {/* ── Delivery Box (on rear rack) ── */}
    {/* Rack */}
    <Path d="M88 66 L110 66" stroke="#6B7280" strokeWidth="2" />
    <Path d="M92 66 L94 72" stroke="#6B7280" strokeWidth="1.5" />
    <Path d="M106 66 L108 72" stroke="#6B7280" strokeWidth="1.5" />
    {/* Box body */}
    <Rect x="86" y="32" width="34" height="34" rx="3" fill="#7C3AED" />
    {/* Box front face (3D effect) */}
    <Rect x="89" y="35" width="28" height="28" rx="2" fill="#8B5CF6" />
    {/* Circle logo */}
    <Circle cx="103" cy="49" r="7" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
    <Circle cx="103" cy="49" r="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
    {/* Box lid */}
    <Rect x="84" y="29" width="38" height="5" rx="2" fill="#6D28D9" />
    {/* Strap from box to driver */}
    <Path d="M89 40 L78 44 L76 50" stroke="#5B21B6" strokeWidth="2" strokeLinecap="round" fill="none" />
    <Path d="M89 48 L80 52 L78 56" stroke="#5B21B6" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </Svg>
));

const BikeAnimation = React.memo(() => {
  const bikeX = useRef(new Animated.Value(SW + 80)).current;
  const smoke1 = useRef(new Animated.Value(0)).current;
  const smoke2 = useRef(new Animated.Value(0)).current;
  const smoke3 = useRef(new Animated.Value(0)).current;
  const roadDash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Bike moves right to left
    Animated.loop(
      Animated.timing(bikeX, {
        toValue: -180,
        duration: 4500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Smoke puffs
    const smokeLoop = (anim, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    smokeLoop(smoke1, 0).start();
    smokeLoop(smoke2, 300).start();
    smokeLoop(smoke3, 600).start();

    // Road dashes move left to right
    Animated.loop(
      Animated.timing(roadDash, { toValue: 60, duration: 500, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const smokeStyle = (anim, offsetX) => ({
    position: "absolute",
    right: -15 + offsetX,
    bottom: 22,
    fontSize: 12,
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
    transform: [
      { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) },
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
    ],
  });

  return (
    <View style={st.bikeScene}>
      {/* Road */}
      <View style={st.road}>
        <View style={st.roadLine}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <Animated.View
              key={i}
              style={[
                st.roadDash,
                { transform: [{ translateX: roadDash }] },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Bike group */}
      <Animated.View
        style={[
          st.bikeGroup,
          { transform: [{ translateX: bikeX }] },
        ]}
      >
        {/* Smoke puffs behind bike */}
        <Animated.Text style={smokeStyle(smoke1, 0)}>💨</Animated.Text>
        <Animated.Text style={smokeStyle(smoke2, 8)}>💨</Animated.Text>
        <Animated.Text style={smokeStyle(smoke3, 16)}>💨</Animated.Text>

        {/* SVG Delivery Bike */}
        <DeliveryBikeSVG />
      </Animated.View>
    </View>
  );
});

/* ─── Floating Icons ─── */
const FloatingIcons = React.memo(({ icons }) => {
  const anims = useRef(
    icons.map(() => ({
      y: new Animated.Value(0),
      o: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    anims.forEach((a, i) => {
      Animated.sequence([
        Animated.delay(i * 180),
        Animated.parallel([
          Animated.timing(a.o, {
            toValue: 0.65,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.loop(
            Animated.sequence([
              Animated.timing(a.y, {
                toValue: -14,
                duration: 1800 + i * 250,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(a.y, {
                toValue: 0,
                duration: 1800 + i * 250,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          ),
        ]),
      ]).start();
    });
  }, []);

  const pos = [
    { top: "8%", left: "8%" },
    { top: "5%", right: "12%" },
    { top: "22%", left: "20%" },
    { top: "16%", right: "8%" },
    { top: "34%", left: "6%" },
    { top: "30%", right: "16%" },
  ];

  return (
    <>
      {icons.map((icon, i) => (
        <Animated.Text
          key={i}
          style={[
            st.floatingIcon,
            pos[i],
            { transform: [{ translateY: anims[i].y }], opacity: anims[i].o },
          ]}
        >
          {icon}
        </Animated.Text>
      ))}
    </>
  );
});

/* ─── Pulsing Status Icon ─── */
const StatusAnimation = React.memo(({ iconName, isDelivered }) => {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    const loop = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    loop(pulse1, 0).start();
    loop(pulse2, 600).start();
    loop(pulse3, 1200).start();
  }, []);

  const ring = (anim) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.5],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 0],
    }),
  });

  return (
    <View style={st.animContainer}>
      <Animated.View style={[st.pulseRing, ring(pulse1)]} />
      <Animated.View style={[st.pulseRing, ring(pulse2)]} />
      <Animated.View style={[st.pulseRing, ring(pulse3)]} />
      <Animated.View
        style={[
          st.mainIcon,
          isDelivered && st.mainIconDelivered,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons name={iconName} size={42} color="#fff" />
      </Animated.View>
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
  const info = STATUS_INFO[currentStatus] || STATUS_INFO.placed;
  const showsMap = MAP_STATUSES.has(currentStatus);
  const isOTW = currentStatus === "on_the_way";
  const isDone = currentStatus === "delivered";

  // ===========================================================================
  // FETCH ORDER (if navigated from Orders list, not checkout)
  // ===========================================================================
  useEffect(() => {
    const fetchOrder = async () => {
      if (orderData.restaurantName && orderData.order) {
        // Extract restaurant location from existing order data
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

          // Restaurant location
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

          // Delivery (customer) location
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
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        const newStatus = (data.status || "").toLowerCase();

        // Driver info
        if (data.driver) setDriverInfo(data.driver);

        // Driver location (live)
        if (data.driverLocation?.latitude && data.driverLocation?.longitude) {
          setDriverLocation({
            lat: parseFloat(data.driverLocation.latitude),
            lng: parseFloat(data.driverLocation.longitude),
          });
        }

        // Customer / delivery location
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

        // Restaurant location (from poll if available)
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
          setEstimatedTime(
            formatETAClockTime(data.eta.etaRangeMin, data.eta.etaRangeMax, {
              isOnTheWay: otw,
            })
          );
        } else if (data.estimatedDuration) {
          setEstimatedTime(
            formatETAClockTime(data.estimatedDuration, data.estimatedDuration, {
              isOnTheWay: true,
            })
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
  // OSRM ROUTE (for all map-showing statuses)
  // ===========================================================================
  useEffect(() => {
    if (!showsMap) return;

    // Determine route origin & destination based on status
    let origin = null;
    let destination = null;

    if (isOTW || currentStatus === "picked_up") {
      // Driver → customer
      if (driverLocation && deliveryLocation) {
        origin = driverLocation;
        destination = deliveryLocation;
      }
    } else {
      // Restaurant → customer (pending/received/accepted)
      if (restaurantLocation && deliveryLocation) {
        origin = restaurantLocation;
        destination = deliveryLocation;
      }
    }

    if (!origin || !destination) return;

    // Build a cache key to avoid re-fetching when positions haven't moved
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
              formatETAClockTime(mins, mins, { isOnTheWay: isOTW })
            );
          }
        }
      } catch {
        // Fallback: straight line between origin and destination
        setRouteCoords([
          { latitude: origin.lat, longitude: origin.lng },
          { latitude: destination.lat, longitude: destination.lng },
        ]);
      }
    })();
  }, [
    showsMap,
    currentStatus,
    driverLocation,
    deliveryLocation,
    restaurantLocation,
    isOTW,
  ]);

  // ===========================================================================
  // FIT MAP BOUNDS (whenever markers or map readiness change)
  // ===========================================================================
  useEffect(() => {
    if (!showsMap || !mapReady || !mapRef.current) return;

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
        500
      );
    }
  }, [showsMap, mapReady, restaurantLocation, deliveryLocation, driverLocation]);

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
    [navigation]
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  }, [navigation]);

  // ===========================================================================
  // MAP PROPS (memoised for FreeMapView)
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
    if (!showsMap) return [];
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
    showsMap,
    restaurantLocation,
    deliveryLocation,
    driverLocation,
    orderData.restaurantName,
    driverInfo,
  ]);

  const mapPolylines = useMemo(() => {
    if (!showsMap || routeCoords.length < 2) return [];
    return [
      {
        id: "route",
        coordinates: routeCoords,
        strokeColor: "#10B981",
        strokeWidth: 5,
      },
    ];
  }, [showsMap, routeCoords]);

  // ===========================================================================
  // LOADING
  // ===========================================================================

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={st.loadingTxt}>Loading order…</Text>
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

      {/* ══════════════ TOP AREA ══════════════ */}
      {showsMap ? (
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

          {/* Live badge on map */}
          {isOTW && (
            <View style={st.mapLiveBadge}>
              <View style={st.liveDot} />
              <Text style={st.mapLiveTxt}>LIVE</Text>
            </View>
          )}
        </View>
      ) : (
        <LinearGradient
          colors={info.gradientColors}
          style={st.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {currentStatus === "placed" && <BikeAnimation />}
          {info.floatingIcons.length > 0 && (
            <FloatingIcons icons={info.floatingIcons} />
          )}
          <StatusAnimation iconName={info.iconName} isDelivered={isDone} />
        </LinearGradient>
      )}

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

      {/* ══════════════ BOTTOM SHEET ══════════════ */}
      <Animated.View
        style={[
          st.sheet,
          showsMap && st.sheetMap,
          { transform: [{ translateY: sheetY }], opacity: contentFade },
        ]}
      >
        <View style={st.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.sheetInner}
          bounces={false}
        >
          {/* Live badge (inside sheet for on_the_way) */}
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

          {/* ETA card (not for placed / delivered) */}
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

            {/* View Order toggle (all except delivered) */}
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

            {/* Info message (placed, pending, received, accepted, picked_up) */}
            {info.message !== "" && !isDone && !isOTW && (
              <View style={st.infoMsg}>
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color="#10B981"
                />
                <Text style={st.infoMsgTxt}>{info.message}</Text>
              </View>
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
              {((item.price || item.unit_price || 0) * item.quantity).toFixed(2)}
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingTxt: {
    marginTop: 12,
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "500",
  },

  /* ─ top area ─ */
  gradient: {
    height: SH * 0.42,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  /* bike animation */
  bikeScene: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    height: 140,
  },
  road: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "rgba(0,0,0,0.12)",
    justifyContent: "center",
  },
  roadLine: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 10,
  },
  roadDash: {
    width: 30,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 2,
  },
  bikeGroup: {
    position: "absolute",
    bottom: 12,
  },

  mapWrap: {
    height: SH * 0.55,
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

  /* floating icons */
  floatingIcon: { position: "absolute", fontSize: 28 },

  /* pulse animation */
  animContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  mainIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  mainIconDelivered: {
    backgroundColor: "#10B981",
    borderColor: "#34D399",
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
    maxHeight: SH * 0.65,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  sheetMap: { maxHeight: SH * 0.52 },
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

  /* info message */
  infoMsg: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    gap: 8,
  },
  infoMsgTxt: { flex: 1, fontSize: 13, color: "#065F46", lineHeight: 19 },

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
