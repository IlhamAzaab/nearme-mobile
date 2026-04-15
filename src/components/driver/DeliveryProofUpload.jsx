import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_BASE_URL } from "../../constants/api";
import OptimizedImage from "../common/OptimizedImage";

export default function DeliveryProofUpload({
  deliveryId,
  existingProofUrl = null,
  onUploaded,
}) {
  const [proofUrl, setProofUrl] = useState(existingProofUrl);
  const [uploading, setUploading] = useState(false);

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission", "Camera permission is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    await uploadAsset(result.assets[0]);
  };

  const uploadAsset = async (asset) => {
    if (!deliveryId || !asset?.uri) return;

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: `delivery_proof_${deliveryId}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });

      const res = await fetch(
        `${API_BASE_URL}/driver/deliveries/${deliveryId}/proof`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Upload failed");
      }

      const nextUrl = data?.url || asset.uri;
      setProofUrl(nextUrl);
      onUploaded?.(nextUrl);
    } catch (error) {
      Alert.alert("Upload failed", error?.message || "Please try again");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Delivery Proof</Text>
        <Text style={styles.optional}>Optional</Text>
      </View>

      {proofUrl ? (
        <OptimizedImage uri={proofUrl} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photo uploaded</Text>
        </View>
      )}

      <Pressable
        style={styles.captureBtn}
        onPress={handleCapture}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.captureBtnText}>
            {proofUrl ? "Retake Photo" : "Take Photo"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 13, fontWeight: "800", color: "#374151" },
  optional: {
    fontSize: 10,
    color: "#6B7280",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  preview: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 12,
  },
  placeholder: {
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  placeholderText: { color: "#6B7280", fontSize: 12 },
  captureBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
