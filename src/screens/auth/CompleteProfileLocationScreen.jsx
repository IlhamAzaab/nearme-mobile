import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../../app/providers/AuthProvider";
import MeezoLogo from "../../components/common/MeezoLogo";
import OSMMapView from "../../components/maps/OSMMapView";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken, persistAuthSession } from "../../lib/authStorage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_WEB = Platform.OS === "web";
const WEB_CARD_MAX_WIDTH = 680;
const TERMS_AND_CONDITIONS_URL = "https://lucent-bombolone-2fa396.netlify.app";

export default function CompleteProfileLocationScreen({ navigation, route }) {
  const { refreshAuthState, markProfileCompleted } = useAuth();
  const { userId, accessToken, profileData } = route.params || {};

  const [initialRegion, setInitialRegion] = useState(null);
  const [currentCoordinate, setCurrentCoordinate] = useState(null);
  const [addressLabel, setAddressLabel] = useState("Locating...");
  const [addressCity, setAddressCity] = useState("");
  const [mapLoading, setMapLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");

  const mapRef = useRef(null);
  const geocodeTimerRef = useRef(null);
  const shakeX = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setMapLoading(true);
      setError("");

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!mounted) return;
          setError("Location permission is required to pin your address.");
          setAddressLabel("Permission denied");
          setMapLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        if (!mounted) return;

        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setInitialRegion({
          ...coords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
        setCurrentCoordinate(coords);
        await reverseGeocode(coords.latitude, coords.longitude);
      } catch (err) {
        console.error("Map setup error:", err);
        if (!mounted) return;
        setError("Unable to load map. Please try again.");
        setAddressLabel("Unable to detect location");
      } finally {
        if (mounted) {
          setMapLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
    };
  }, []);

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (!geocode.length) {
        setAddressLabel("Unknown location");
        setAddressCity("");
        return;
      }

      const place = geocode[0];
      const fullAddress = `${place.name ? `${place.name}, ` : ""}${place.street || ""}, ${place.city || place.subregion || ""}`;
      setAddressLabel(fullAddress.trim().replace(/^,|,$/g, "") || "Unknown location");
      setAddressCity(place.city || place.subregion || place.region || "");
    } catch (err) {
      console.error("Reverse geocode error:", err);
      setAddressLabel("Could not detect address details");
      setAddressCity("");
    }
  };

  const onRegionChangeComplete = (region) => {
    if (!region) return;

    setCurrentCoordinate({
      latitude: region.latitude,
      longitude: region.longitude,
    });

    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
    }

    geocodeTimerRef.current = setTimeout(() => {
      reverseGeocode(region.latitude, region.longitude);
    }, 280);
  };

  const centerOnUser = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      mapRef.current?.animateToRegion?.({
        ...coords,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } catch (err) {
      console.error("Center map error:", err);
    }
  };

  const handleSave = async () => {
    setError("");

    if (
      !profileData?.name ||
      !profileData?.email ||
      !profileData?.password ||
      !profileData?.city
    ) {
      setError("Profile details are missing. Please go back and retry.");
      triggerShake();
      return;
    }

    if (!profileData?.phone) {
      setError("Phone verification missing. Please verify OTP again.");
      triggerShake();
      return;
    }

    if (!termsAccepted) {
      setError("Please accept Terms of Service to continue.");
      triggerShake();
      return;
    }

    if (!currentCoordinate) {
      setError("Please pin your address on the map.");
      triggerShake();
      return;
    }

    setSaving(true);
    try {
      const effectiveAccessToken = accessToken || (await getAccessToken());
      if (!effectiveAccessToken) {
        setError("Session expired. Please login again.");
        triggerShake();
        setSaving(false);
        return;
      }

      const completeRes = await fetch(`${API_BASE_URL}/auth/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveAccessToken}`,
        },
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email,
          password: profileData.password,
          address: addressLabel,
          city: profileData.city || addressCity,
          latitude: currentCoordinate.latitude,
          longitude: currentCoordinate.longitude,
        }),
      });

      const completeData = await completeRes.json().catch(() => ({}));

      if (!completeRes.ok) {
        setError(completeData.message || "Failed to complete profile");
        triggerShake();
        setSaving(false);
        return;
      }

      const returnedToken =
        completeData?.data?.token || completeData?.token || effectiveAccessToken;
      const resolvedUserId =
        userId || completeData?.data?.id || completeData?.id || null;

      await persistAuthSession(
        {
          token: returnedToken,
          role: "customer",
          userId: resolvedUserId,
          userName: profileData.name,
        },
        {
          userEmail: profileData.email,
          profileCompleted: true,
        },
      );

      await markProfileCompleted();
      await refreshAuthState();
    } catch (err) {
      console.error("Complete profile final step error:", err);
      setError("Network error. Please try again.");
      triggerShake();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.pageContainer} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.pageContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            IS_WEB && styles.scrollContentWeb,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.loginShell,
              IS_WEB && styles.loginShellWeb,
              { transform: [{ translateX: shakeX }] },
            ]}
          >
            <LinearGradient
              colors={["#04753E", "#059B52", "#06C168"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.greenSection, IS_WEB && styles.greenSectionWeb]}
            >
              <View style={styles.bgCircle1} />
              <View style={styles.bgCircle2} />
              <View style={styles.logoWrap}>
                <MeezoLogo size={IS_WEB ? 320 : 250} />
              </View>
              <Text style={styles.appSubtitle}>Step 2 of 2: map pin and terms</Text>
            </LinearGradient>

            <View style={styles.waveContainer}>
              <Svg
                width={SCREEN_WIDTH}
                height={46}
                viewBox={`0 0 ${SCREEN_WIDTH} 46`}
                style={styles.waveSvg}
              >
                <Path
                  d={`M0,0 L0,20 Q${SCREEN_WIDTH * 0.25},46 ${SCREEN_WIDTH * 0.5},20 Q${SCREEN_WIDTH * 0.75},-2 ${SCREEN_WIDTH},20 L${SCREEN_WIDTH},0 Z`}
                  fill="#06C168"
                />
              </Svg>
            </View>

            <View style={[styles.whiteSection, IS_WEB && styles.whiteSectionWeb]}>
              <View style={[styles.formWrap, IS_WEB && styles.formWrapWeb]}>
                <Text style={styles.cardTitle}>Pin Delivery Address</Text>
                <Text style={styles.cardSub}>Drag map until the pin matches your place</Text>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.mapCard}>
                  {mapLoading || !initialRegion ? (
                    <View style={styles.mapLoadingWrap}>
                      <ActivityIndicator size="large" color="#06C168" />
                      <Text style={styles.mapLoadingText}>Loading map...</Text>
                    </View>
                  ) : (
                    <>
                      <OSMMapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={initialRegion}
                        onRegionChangeComplete={onRegionChangeComplete}
                        showsUserLocation={true}
                        userLocation={currentCoordinate}
                      />

                      <View style={styles.centerPinContainer} pointerEvents="none">
                        <Ionicons name="location" size={44} color="#E11D48" />
                      </View>

                      <Pressable style={styles.myLocationButton} onPress={centerOnUser}>
                        <Ionicons name="locate" size={20} color="#06C168" />
                      </Pressable>
                    </>
                  )}
                </View>

                <View style={styles.addressCard}>
                  <Text style={styles.addressLabel}>Pinned Address</Text>
                  <Text style={styles.addressValue} numberOfLines={2}>
                    {addressLabel || "Set your map pin to fetch address"}
                  </Text>
                </View>

                <View style={styles.termsRow}>
                  <Pressable
                    style={styles.termsToggle}
                    onPress={() => setTermsAccepted((v) => !v)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        termsAccepted ? styles.checkboxChecked : null,
                      ]}
                    >
                      {termsAccepted ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text style={styles.termsText}>I accept</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      navigation.navigate("WebView", {
                        title: "Terms of Service",
                        url: TERMS_AND_CONDITIONS_URL,
                      })
                    }
                  >
                    <Text style={styles.termsLink}>Terms of Service</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (pressed || saving) && { opacity: 0.88, transform: [{ scale: 0.985 }] },
                  ]}
                >
                  <LinearGradient
                    colors={["#06C168", "#059B52", "#04753E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    {saving ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.primaryBtnText}>Saving...</Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryBtnText}>Save and Continue</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#EEF4EF",
  },
  scrollContent: { flexGrow: 1 },
  scrollContentWeb: {
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  loginShell: {
    width: "100%",
    flex: 1,
  },
  loginShellWeb: {
    width: "100%",
    maxWidth: WEB_CARD_MAX_WIDTH,
    alignSelf: "center",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0B3B1E",
    shadowOpacity: 0.16,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  greenSection: {
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  greenSectionWeb: {
    paddingTop: 34,
    paddingBottom: 8,
  },
  bgCircle1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -40,
    right: -60,
  },
  bgCircle2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: 10,
    left: -50,
  },
  logoWrap: {
    alignItems: "center",
  },
  appSubtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: -6,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  waveContainer: {
    marginTop: -2,
    backgroundColor: "#FFFFFF",
  },
  waveSvg: { display: "flex" },
  whiteSection: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingBottom: 34,
  },
  whiteSectionWeb: {
    paddingHorizontal: 24,
    paddingBottom: 26,
  },
  formWrap: { paddingTop: 8 },
  formWrapWeb: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
    fontWeight: "400",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  errorText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },
  mapCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    height: 270,
    backgroundColor: "#F9FAFB",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  mapLoadingText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
  },
  centerPinContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -22,
    marginTop: -44,
  },
  myLocationButton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addressCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 12,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  addressValue: {
    marginTop: 5,
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    lineHeight: 20,
  },
  termsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  termsToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#06C168",
    borderColor: "#06C168",
  },
  termsText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  termsLink: {
    color: "#0F766E",
    fontSize: 14,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  primaryBtn: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#06C168",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryBtnGradient: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.5,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
