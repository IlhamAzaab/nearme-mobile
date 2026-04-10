import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../../config/env";
import StepProgress from "../../../components/driver/StepProgress";
import { NEARME_LOGO_ARTBOARD5_XML } from "../../../assets/NearMeLogoArtboard5Xml";

const DOCUMENT_TYPES = [
  { key: "nic_front", label: "NIC Front Side", icon: "" },
  { key: "nic_back", label: "NIC Back Side", icon: "" },
  { key: "license_front", label: "Driving License Front", icon: "" },
  { key: "license_back", label: "Driving License Back", icon: "" },
  { key: "insurance", label: "Insurance Certificate", icon: "" },
  { key: "revenue_license", label: "Vehicle Annual License", icon: "" },
];

export default function OnboardingStep3Screen({ navigation }) {
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const pickAndUpload = async (docType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted")
      return Alert.alert(
        "Permission needed",
        "Please grant media library permission",
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    setUploading((prev) => ({ ...prev, [docType]: true }));
    try {
      const token = await AsyncStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        type: file.mimeType || "image/jpeg",
        name: file.fileName || `${docType}.jpg`,
      });
      formData.append("docType", docType);
      const res = await fetch(`${API_URL}/onboarding/upload-document`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setDocuments((prev) => ({ ...prev, [docType]: data.url }));
      } else {
        Alert.alert("Upload Error", data.message || "Failed to upload");
      }
    } catch (e) {
      Alert.alert("Error", "Upload failed. Please try again.");
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
    }
  };

  const handleSubmit = async () => {
    const uploaded = DOCUMENT_TYPES.filter((d) => documents[d.key]);
    if (uploaded.length < DOCUMENT_TYPES.length) {
      return Alert.alert(
        "Error",
        `Please upload all ${DOCUMENT_TYPES.length} documents (${uploaded.length}/${DOCUMENT_TYPES.length} done)`,
      );
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const docsArray = DOCUMENT_TYPES.map((d) => ({
        documentType: d.key,
        documentUrl: documents[d.key],
      }));
      const res = await fetch(`${API_URL}/onboarding/step-3`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documents: docsArray }),
      });
      const data = await res.json();
      if (res.ok) navigation.replace("DriverOnboardingStep4");
      else Alert.alert("Error", data.message || "Failed. Try again.");
    } catch (e) {
      Alert.alert("Error", "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadedCount = DOCUMENT_TYPES.filter((d) => documents[d.key]).length;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <StepProgress currentStep={3} />
        <View style={s.logoWrap}>
          <SvgXml xml={NEARME_LOGO_ARTBOARD5_XML} width={152} height={152} />
        </View>
        <Text style={s.title}>Upload Documents</Text>
        <Text style={s.subtitle}>
          Step 3 of 5 {uploadedCount}/{DOCUMENT_TYPES.length} uploaded
        </Text>
        <View style={s.card}>
          {DOCUMENT_TYPES.map((doc) => {
            const isUploaded = !!documents[doc.key];
            const isLoading = uploading[doc.key];
            return (
              <TouchableOpacity
                key={doc.key}
                style={[s.docBtn, isUploaded && s.docBtnDone]}
                onPress={() => pickAndUpload(doc.key)}
                disabled={isLoading}
              >
                <Text style={s.docIcon}>{doc.icon}</Text>
                <View style={s.docInfo}>
                  <Text style={[s.docLabel, isUploaded && s.docLabelDone]}>
                    {doc.label}
                  </Text>
                  <Text style={s.docStatus}>
                    {isLoading
                      ? "Uploading..."
                      : isUploaded
                        ? " Uploaded"
                        : "Tap to upload"}
                  </Text>
                </View>
                {isLoading && (
                  <ActivityIndicator size="small" color="#06C168" />
                )}
              </TouchableOpacity>
            );
          })}
          <View style={s.progressBar}>
            <View
              style={[
                s.progressFill,
                { width: `${(uploadedCount / DOCUMENT_TYPES.length) * 100}%` },
              ]}
            />
          </View>
          <TouchableOpacity
            style={[
              s.nextBtn,
              (submitting || uploadedCount < DOCUMENT_TYPES.length) &&
                s.btnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || uploadedCount < DOCUMENT_TYPES.length}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.nextBtnText}>Continue </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.backBtnText}> Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#06C168" },
  scroll: { flexGrow: 1, padding: 20 },
  logoWrap: { alignItems: "center", marginBottom: 8 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 8,
  },
  docBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  docBtnDone: { backgroundColor: "#EDFBF2", borderColor: "#6EDE9A" },
  docIcon: { fontSize: 28 },
  docInfo: { flex: 1 },
  docLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  docLabelDone: { color: "#06C168" },
  docStatus: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  progressBar: {
    height: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressFill: { height: 6, backgroundColor: "#06C168", borderRadius: 3 },
  nextBtn: {
    backgroundColor: "#06C168",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  backBtn: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  backBtnText: { fontSize: 14, color: "#6b7280" },
});
