import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OSMMapView from "../../../components/maps/OSMMapView";
import { API_URL } from "../../../config/env";
import { getAccessToken } from "../../../lib/authStorage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const KINNIYA_BUHARI_JUNCTION = {
  latitude: 8.5017,
  longitude: 81.186,
};

const DEFAULT_MAP_REGION = {
  latitude: KINNIYA_BUHARI_JUNCTION.latitude,
  longitude: KINNIYA_BUHARI_JUNCTION.longitude,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

const GEOCODE_DEBOUNCE_MS = 500;
const LOCATION_TIMEOUT_MS = 9000;

function toCoordinatePair(locationPayload) {
  const latitude = Number(locationPayload?.coords?.latitude);
  const longitude = Number(locationPayload?.coords?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function formatReverseGeocodeResult(place) {
  if (!place) return "Unknown location";

  const parts = [
    place.name,
    place.street,
    place.city || place.subregion || place.region,
  ]
    .filter((value) => String(value || "").trim().length > 0)
    .map((value) => String(value).trim());

  return parts.join(", ") || "Unknown location";
}

function buildRestaurantPinHtml() {
  return (
    "<div style='display:flex;align-items:center;justify-content:center;width:52px;height:52px;'>" +
    "<svg width='52' height='52' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' aria-label='restaurant pin'>" +
    "<path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#E11D48'/>" +
    "<circle cx='12' cy='9' r='3' fill='#FFFFFF'/>" +
    "</svg>" +
    "</div>"
  );
}

// Step Progress Bar Component
function StepProgress({ currentStep, totalSteps }) {
  const steps = ["Personal", "Restaurant", "Bank", "Contract", "Review"];
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.header}>
        <Text style={progressStyles.stepText}>
          Step {currentStep} of {totalSteps}
        </Text>
        <Text style={progressStyles.percentText}>{percentage}% Complete</Text>
      </View>

      {/* Progress Bar */}
      <View style={progressStyles.barContainer}>
        <View style={[progressStyles.barFill, { width: `${percentage}%` }]} />
      </View>

      {/* Step Indicators */}
      <View style={progressStyles.stepsRow}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View key={i} style={progressStyles.stepItem}>
            <View
              style={[
                progressStyles.stepCircle,
                i + 1 < currentStep && progressStyles.stepCompleted,
                i + 1 === currentStep && progressStyles.stepCurrent,
                i + 1 > currentStep && progressStyles.stepPending,
              ]}
            >
              {i + 1 < currentStep ? (
                <Text style={progressStyles.checkmark}>✓</Text>
              ) : (
                <Text
                  style={[
                    progressStyles.stepNumber,
                    i + 1 === currentStep && progressStyles.stepNumberCurrent,
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={progressStyles.stepLabel}>{steps[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  percentText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#06C168",
  },
  barContainer: {
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#06C168",
    borderRadius: 5,
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCompleted: {
    backgroundColor: "#06C168",
  },
  stepCurrent: {
    backgroundColor: "#06C168",
    borderWidth: 4,
    borderColor: "#9EEBBE",
  },
  stepPending: {
    backgroundColor: "#d1d5db",
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  stepNumberCurrent: {
    color: "#ffffff",
  },
  stepLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
});

// Time Picker Component
function TimePicker({ label, value, onChange }) {
  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0"),
  );
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0"),
  );

  const [selectedHour, setSelectedHour] = useState(
    value ? value.split(":")[0] : "",
  );
  const [selectedMinute, setSelectedMinute] = useState(
    value ? value.split(":")[1] : "",
  );
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);

  const clampTimeValue = (text, max) => {
    if (text === "") return "";
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return "";
    const clamped = Math.min(Math.max(Math.trunc(numeric), 0), max);
    return String(clamped).padStart(2, "0");
  };

  const handleHourInput = (text) => {
    const normalized = clampTimeValue(text.replace(/[^0-9]/g, ""), 23);
    setSelectedHour(normalized);
  };

  const handleMinuteInput = (text) => {
    const normalized = clampTimeValue(text.replace(/[^0-9]/g, ""), 59);
    setSelectedMinute(normalized);
  };

  useEffect(() => {
    if (selectedHour && selectedMinute) {
      onChange(`${selectedHour}:${selectedMinute}`);
    }
  }, [selectedHour, selectedMinute]);

  return (
    <View style={timePickerStyles.container}>
      <Text style={timePickerStyles.label}>{label}</Text>
      <View style={timePickerStyles.row}>
        {/* Hour Selector */}
        <TouchableOpacity
          style={timePickerStyles.selector}
          onPress={() => setShowHourPicker(!showHourPicker)}
        >
          <Text style={timePickerStyles.selectorText}>
            {selectedHour || "HH"}
          </Text>
          <Text style={timePickerStyles.clockIcon}>🕐</Text>
        </TouchableOpacity>

        <Text style={timePickerStyles.separator}>:</Text>

        {/* Minute Selector */}
        <TouchableOpacity
          style={timePickerStyles.selector}
          onPress={() => setShowMinutePicker(!showMinutePicker)}
        >
          <Text style={timePickerStyles.selectorText}>
            {selectedMinute || "MM"}
          </Text>
          <Text style={timePickerStyles.clockIcon}>🕐</Text>
        </TouchableOpacity>
      </View>

      <View style={timePickerStyles.manualRow}>
        <TextInput
          style={timePickerStyles.manualInput}
          value={selectedHour}
          onChangeText={handleHourInput}
          placeholder="HH"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={timePickerStyles.manualSeparator}>:</Text>
        <TextInput
          style={timePickerStyles.manualInput}
          value={selectedMinute}
          onChangeText={handleMinuteInput}
          placeholder="MM"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>

      {/* Hour Picker Modal */}
      {showHourPicker && (
        <View style={timePickerStyles.pickerContainer}>
          <ScrollView
            style={timePickerStyles.pickerScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {hours.map((hour) => (
              <TouchableOpacity
                key={hour}
                style={[
                  timePickerStyles.pickerItem,
                  selectedHour === hour && timePickerStyles.pickerItemSelected,
                ]}
                onPress={() => {
                  setSelectedHour(hour);
                  setShowHourPicker(false);
                }}
              >
                <Text
                  style={[
                    timePickerStyles.pickerItemText,
                    selectedHour === hour &&
                      timePickerStyles.pickerItemTextSelected,
                  ]}
                >
                  {hour}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Minute Picker Modal */}
      {showMinutePicker && (
        <View style={timePickerStyles.pickerContainer}>
          <ScrollView
            style={timePickerStyles.pickerScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {minutes.map((minute) => (
              <TouchableOpacity
                key={minute}
                style={[
                  timePickerStyles.pickerItem,
                  selectedMinute === minute &&
                    timePickerStyles.pickerItemSelected,
                ]}
                onPress={() => {
                  setSelectedMinute(minute);
                  setShowMinutePicker(false);
                }}
              >
                <Text
                  style={[
                    timePickerStyles.pickerItemText,
                    selectedMinute === minute &&
                      timePickerStyles.pickerItemTextSelected,
                  ]}
                >
                  {minute}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const timePickerStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  selector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EDFBF2",
    borderWidth: 2,
    borderColor: "#dcfce7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  clockIcon: {
    fontSize: 16,
  },
  separator: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#06C168",
    marginHorizontal: 8,
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    justifyContent: "center",
  },
  manualInput: {
    width: 64,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  manualSeparator: {
    fontSize: 18,
    fontWeight: "700",
    color: "#06C168",
    marginHorizontal: 8,
  },
  pickerContainer: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    zIndex: 100,
    maxHeight: 200,
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerItemSelected: {
    backgroundColor: "#dcfce7",
  },
  pickerItemText: {
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
  },
  pickerItemTextSelected: {
    color: "#06C168",
    fontWeight: "600",
  },
});

export default function Step2() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const geocodeTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const [form, setForm] = useState({
    restaurantName: "",
    registrationNumber: "",
    address: "",
    city: "",
    postalCode: "",
    openingTime: "",
    closeTime: "",
  });

  const [initialRegion, setInitialRegion] = useState(DEFAULT_MAP_REGION);
  const [position, setPosition] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [addressLabel, setAddressLabel] = useState("Loading location...");
  const [addressCity, setAddressCity] = useState("");
  const [mapLoading, setMapLoading] = useState(true);

  const [files, setFiles] = useState({
    logo: null,
    coverImage: null,
  });
  const [fileUris, setFileUris] = useState({
    logo: null,
    coverImage: null,
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({});
  const [locating, setLocating] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    mountedRef.current = true;

    const bootstrapLocation = async () => {
      setMapLoading(true);
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (permission.status !== "granted") {
          setAddressLabel(
            "Location permission denied. Pin the restaurant manually.",
          );
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
          timeout: LOCATION_TIMEOUT_MS,
        });

        const coords = toCoordinatePair(location);
        if (!coords || !mountedRef.current) return;

        setUserLocation(coords);
        setInitialRegion({
          ...coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setPosition(coords);
        setAddressLabel("Detecting address...");
        reverseGeocode(coords.latitude, coords.longitude, { force: true });
        mapRef.current?.animateToRegion?.(
          {
            ...coords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      } catch (err) {
        console.error("Location bootstrap error:", err);
        if (!mountedRef.current) return;
        setAddressLabel("Tap on the map to select the restaurant location.");
      } finally {
        if (mountedRef.current) {
          setMapLoading(false);
        }
      }
    };

    bootstrapLocation();

    return () => {
      mountedRef.current = false;
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
    };
  }, []);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const reverseGeocode = async (latitude, longitude, options = {}) => {
    const { force = false } = options;

    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
    }

    geocodeTimerRef.current = setTimeout(async () => {
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (!mountedRef.current || (!force && !geocode?.length)) return;

        const place = geocode?.[0];
        const label = formatReverseGeocodeResult(place);
        const city = String(
          place?.city || place?.subregion || place?.region || "",
        );

        setAddressLabel(label);
        setAddressCity(city);
        setForm((prev) => ({
          ...prev,
          address: label,
          city,
        }));
      } catch (err) {
        console.error("Reverse geocode error:", err);
        if (!mountedRef.current) return;
        setAddressLabel("Selected location");
      }
    }, GEOCODE_DEBOUNCE_MS);
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable location permissions to use this feature.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = toCoordinatePair(location);
      if (!coords) {
        throw new Error("Invalid location coordinates");
      }

      const { latitude, longitude } = coords;
      setUserLocation(coords);
      setPosition({ latitude, longitude });

      const newRegion = {
        ...coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setInitialRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
      reverseGeocode(latitude, longitude, { force: true });
    } catch (err) {
      console.error("Location error:", err);
      Alert.alert(
        "Error",
        "Unable to get your location. Please select manually on the map.",
      );
    } finally {
      setLocating(false);
    }
  };

  const handleMapPress = (event) => {
    const latitude = Number(event?.nativeEvent?.coordinate?.latitude);
    const longitude = Number(event?.nativeEvent?.coordinate?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const coords = { latitude, longitude };
    setPosition(coords);
    reverseGeocode(latitude, longitude, { force: true });
  };

  const handleImagePick = async (fieldKey) => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: fieldKey === "logo" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (result.canceled) return;

      const selectedAsset = result.assets?.[0];

      if (!selectedAsset) {
        Alert.alert("Error", "No image selected. Please try again.");
        return;
      }

      if (selectedAsset.type && selectedAsset.type !== "image") {
        Alert.alert("Invalid File", "Please select an image file only.");
        return;
      }

      setFileUris((prev) => ({ ...prev, [fieldKey]: selectedAsset.uri }));
      setFiles((prev) => ({ ...prev, [fieldKey]: selectedAsset }));
    } catch (err) {
      console.error("Image picker error:", err);
      Alert.alert("Error", "Failed to select image");
    }
  };

  const uploadToCloudinary = async (asset, imageType) => {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await getAccessToken();

        // Get file info from asset
        const uri = asset.uri;
        const uriParts = uri.split(".");
        const fileExtension =
          uriParts[uriParts.length - 1]?.toLowerCase() || "jpg";

        // Determine mime type
        let mimeType = "image/jpeg";
        if (fileExtension === "png") {
          mimeType = "image/png";
        } else if (fileExtension === "gif") {
          mimeType = "image/gif";
        }

        // Create FormData
        const formData = new FormData();
        formData.append("file", {
          uri: uri,
          type: mimeType,
          name: `${imageType}_${Date.now()}.${fileExtension}`,
        });
        formData.append("imageType", imageType);

        console.log("Uploading image:", { uri, mimeType, imageType });

        // Use XMLHttpRequest for better React Native compatibility
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/restaurant-onboarding/upload-image`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("Accept", "application/json");

        xhr.onload = () => {
          console.log("Upload response status:", xhr.status);
          console.log("Upload response:", xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url);
            } catch (e) {
              reject(new Error("Invalid response from server"));
            }
          } else {
            let errorMessage = "Upload failed";
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.message || `Server error: ${xhr.status}`;
            } catch (e) {
              errorMessage = xhr.responseText || `Server error: ${xhr.status}`;
            }
            reject(new Error(errorMessage));
          }
        };

        xhr.onerror = () => {
          console.error("XHR error:", xhr.status, xhr.responseText);
          reject(new Error("Network error during upload"));
        };

        xhr.send(formData);
      } catch (error) {
        console.error("Upload setup error:", error);
        reject(error);
      }
    });
  };

  const handleSubmit = async () => {
    // Validation
    const resolvedAddress = String(
      form.address?.trim() || addressLabel || "",
    ).trim();
    const resolvedCity = String(form.city?.trim() || addressCity || "").trim();

    if (
      !form.restaurantName ||
      !resolvedAddress ||
      !resolvedCity ||
      !form.postalCode ||
      !form.openingTime ||
      !form.closeTime
    ) {
      Alert.alert("Validation Error", "All required fields must be filled");
      return;
    }

    if (!position) {
      Alert.alert(
        "Validation Error",
        "Please select restaurant location on the map",
      );
      return;
    }

    setLoading(true);

    try {
      const token = await getAccessToken();

      // Upload images
      const uploadPromises = [];
      let logoUrl = null;

      if (files.logo) {
        uploadPromises.push(
          (async () => {
            setUploading((prev) => ({ ...prev, logo: true }));
            const url = await uploadToCloudinary(files.logo, "logo");
            setUploading((prev) => ({ ...prev, logo: false }));
            return url;
          })(),
        );
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      if (files.coverImage) {
        uploadPromises.push(
          (async () => {
            setUploading((prev) => ({ ...prev, coverImage: true }));
            const url = await uploadToCloudinary(
              files.coverImage,
              "cover_image",
            );
            setUploading((prev) => ({ ...prev, coverImage: false }));
            return url;
          })(),
        );
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      const [uploadedLogoUrl, coverImageUrl] =
        await Promise.all(uploadPromises);
      logoUrl = uploadedLogoUrl;

      // Submit to backend
      const res = await fetch(`${API_URL}/restaurant-onboarding/step-2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          address: resolvedAddress,
          city: resolvedCity,
          latitude: position.latitude.toString(),
          longitude: position.longitude.toString(),
          logoUrl,
          coverImageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data?.message || "Failed to save step 2");
        return;
      }
      navigation.navigate("AdminOnboardingStep3");
    } catch (err) {
      console.error("Step2 submit error", err);
      Alert.alert(
        "Error",
        err.message || "Failed to save restaurant details. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderImageUploader = (label, fieldKey, required = false) => {
    const uri = fileUris[fieldKey];
    const isUploading = uploading[fieldKey];

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TouchableOpacity
          style={styles.imageUploader}
          onPress={() => handleImagePick(fieldKey)}
          disabled={isUploading}
        >
          {uri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri }} style={styles.imagePreview} />
              <View style={styles.imageOverlay}>
                <Text style={styles.changeText}>Tap to change</Text>
              </View>
              <View style={styles.uploadedBadge}>
                <Text style={styles.uploadedBadgeText}>✓</Text>
              </View>
            </View>
          ) : isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#06C168" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>📷</Text>
              <Text style={styles.uploadText}>Tap to upload</Text>
              <Text style={styles.uploadHint}>JPG or PNG, max 5MB</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Background Decorations */}
      <View style={styles.bgDecoration1} />
      <View style={styles.bgDecoration2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          nestedScrollEnabled
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>🍴</Text>
            </View>
            <Text style={styles.headerTitle}>Restaurant Details</Text>
            <Text style={styles.headerSubtitle}>
              Provide restaurant identity and location details
            </Text>
          </View>

          {/* Progress Bar */}
          <StepProgress currentStep={2} totalSteps={5} />

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Restaurant Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Restaurant Name</Text>
              <TextInput
                style={styles.input}
                value={form.restaurantName}
                onChangeText={(value) => updateField("restaurantName", value)}
                placeholder="Enter restaurant name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Registration Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Business Registration Number
              </Text>
              <TextInput
                style={styles.input}
                value={form.registrationNumber}
                onChangeText={(value) =>
                  updateField("registrationNumber", value)
                }
                placeholder="Enter registration number"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.address}
                onChangeText={(value) => updateField("address", value)}
                placeholder="Enter complete address"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>

            {/* City & Postal Code Row */}
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  value={form.city}
                  onChangeText={(value) => updateField("city", value)}
                  placeholder="Enter city"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Postal Code</Text>
                <TextInput
                  style={styles.input}
                  value={form.postalCode}
                  onChangeText={(value) => updateField("postalCode", value)}
                  placeholder="Enter postal code"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Map Section */}
            <View style={styles.mapSection}>
              <Text style={styles.inputLabel}>Restaurant Location</Text>
              <Text style={styles.mapHint}>
                Allow location access for the current position, then tap the map
                to pin the restaurant accurately.
              </Text>

              <View
                style={styles.mapContainer}
                onStartShouldSetResponder={() => true}
                onResponderGrant={() => setScrollEnabled(false)}
                onResponderRelease={() => setScrollEnabled(true)}
                onResponderTerminate={() => setScrollEnabled(true)}
              >
                {mapLoading ? (
                  <View style={styles.mapLoadingWrap}>
                    <ActivityIndicator size="large" color="#06C168" />
                    <Text style={styles.mapLoadingText}>Loading map...</Text>
                  </View>
                ) : (
                  <OSMMapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={initialRegion}
                    onPress={handleMapPress}
                    showsUserLocation={Boolean(userLocation)}
                    userLocation={userLocation}
                    markers={
                      position
                        ? [
                            {
                              id: "restaurant",
                              coordinate: position,
                              type: "customer",
                              title: "Pinned restaurant location",
                              customHtml: buildRestaurantPinHtml(),
                              iconSize: [52, 52],
                              iconAnchor: [26, 50],
                            },
                          ]
                        : []
                    }
                  />
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.locationButton,
                  locating && styles.locationButtonDisabled,
                ]}
                onPress={handleUseMyLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.locationButtonIcon}>📍</Text>
                    <Text style={styles.locationButtonText}>
                      Find My Location
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.selectionCard}>
                <Text style={styles.selectionLabel}>Pinned location</Text>
                <Text style={styles.selectionValue} numberOfLines={2}>
                  {addressLabel || "Tap the map to select the restaurant pin"}
                </Text>
                {!!addressCity && (
                  <Text style={styles.selectionMeta}>{addressCity}</Text>
                )}
              </View>

              {position && (
                <Text style={styles.coordsText}>
                  Coordinates: {position.latitude.toFixed(6)},{" "}
                  {position.longitude.toFixed(6)}
                </Text>
              )}
            </View>

            {/* Time Pickers */}
            <View style={styles.row}>
              <TimePicker
                label="Opening Time"
                value={form.openingTime}
                onChange={(value) => updateField("openingTime", value)}
              />
              <View style={{ width: 16 }} />
              <TimePicker
                label="Closing Time"
                value={form.closeTime}
                onChange={(value) => updateField("closeTime", value)}
              />
            </View>

            {/* Image Uploads */}
            {renderImageUploader("Restaurant Logo (Optional)", "logo", false)}
            {renderImageUploader("Cover Image (Optional)", "coverImage", false)}

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  loading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View style={styles.buttonLoading}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.submitButtonText}>Uploading...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.submitButtonText}>Save & Continue</Text>
                    <Text style={styles.buttonArrow}>→</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06C168",
  },
  bgDecoration1: {
    position: "absolute",
    top: 100,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  bgDecoration2: {
    position: "absolute",
    bottom: 100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 16,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIconText: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  row: {
    flexDirection: "row",
    marginBottom: 20,
  },
  halfInput: {
    flex: 1,
    marginRight: 8,
  },
  mapSection: {
    marginBottom: 20,
  },
  mapHint: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#dcfce7",
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
  mapLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06C168",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  locationButtonDisabled: {
    backgroundColor: "#34D399",
  },
  locationButtonIcon: {
    fontSize: 16,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  selectionCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#DDE7E2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectionLabel: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  selectionValue: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
    lineHeight: 20,
  },
  selectionMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#06C168",
    fontWeight: "700",
  },
  coordsText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  imageUploader: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderStyle: "dashed",
    overflow: "hidden",
    minHeight: 140,
  },
  imagePreviewContainer: {
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: 140,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 8,
  },
  changeText: {
    color: "#ffffff",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  uploadedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadedBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  uploadingContainer: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  uploadPlaceholder: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 12,
    color: "#9ca3af",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  submitButton: {
    flex: 2,
    backgroundColor: "#06C168",
    borderRadius: 999,
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "#34D399",
  },
  buttonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonLoading: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  buttonArrow: {
    fontSize: 18,
    color: "#ffffff",
    marginLeft: 8,
  },
});
