import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DriverProfileLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";
import {
  getDriverProfileScreenCache,
  setDriverProfileScreenCache,
} from "../../utils/driverProfileScreenCache";

const RENEWABLE_DOC_TYPES = [
  { value: "license_front", label: "License Front" },
  { value: "license_back", label: "License Back" },
  { value: "insurance", label: "Insurance" },
  { value: "revenue_license", label: "Annual License" },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTypeLabel(value) {
  const matched = RENEWABLE_DOC_TYPES.find((item) => item.value === value);
  if (matched) return matched.label;
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DriverDocumentsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [renewalRequests, setRenewalRequests] = useState([]);
  const [selectedType, setSelectedType] = useState(
    RENEWABLE_DOC_TYPES[0].value,
  );
  const [selectedFile, setSelectedFile] = useState(null);

  const loadDocuments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`${API_URL}/driver/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load documents");
      }

      const nextDocs = payload?.documents || [];
      const nextRenewals = payload?.renewalRequests || [];
      setDocuments(nextDocs);
      setRenewalRequests(nextRenewals);
      await setDriverProfileScreenCache("documents-details", {
        documents: nextDocs,
        renewalRequests: nextRenewals,
      });
    } catch (error) {
      if (!silent) {
        Alert.alert("Error", error?.message || "Unable to load documents.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const cached = await getDriverProfileScreenCache("documents-details");
      if (cached && mounted) {
        if (Array.isArray(cached)) {
          setDocuments(cached);
          setRenewalRequests([]);
        } else {
          setDocuments(
            Array.isArray(cached?.documents) ? cached.documents : [],
          );
          setRenewalRequests(
            Array.isArray(cached?.renewalRequests)
              ? cached.renewalRequests
              : [],
          );
        }
        setLoading(false);
        loadDocuments({ silent: true });
        return;
      }

      loadDocuments();
    })();

    return () => {
      mounted = false;
    };
  }, [loadDocuments]);

  const pickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const file = result.assets[0];
    setSelectedFile(file);
  }, []);

  const uploadDocument = useCallback(async () => {
    if (!selectedFile) {
      Alert.alert(
        "File required",
        "Please select a PDF or image before upload.",
      );
      return;
    }

    setUploading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No authentication token");

      const uploadData = new FormData();
      uploadData.append("file", {
        uri: selectedFile.uri,
        type: selectedFile.mimeType || "application/octet-stream",
        name: selectedFile.name || `${selectedType}.bin`,
      });
      uploadData.append("docType", selectedType);

      const uploadResponse = await fetch(
        `${API_URL}/onboarding/upload-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          body: uploadData,
        },
      );

      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || !uploadPayload?.url) {
        throw new Error(uploadPayload?.message || "File upload failed");
      }

      const saveResponse = await fetch(`${API_URL}/driver/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: selectedType,
          documentUrl: uploadPayload.url,
        }),
      });

      const savePayload = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) {
        throw new Error(
          savePayload?.message || "Failed to save uploaded document",
        );
      }

      setSelectedFile(null);
      await loadDocuments({ silent: true });
      Alert.alert(
        "Submitted",
        "Renewed document submitted successfully. It will replace the current document after manager approval.",
      );
    } catch (error) {
      Alert.alert("Error", error?.message || "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }, [selectedFile, selectedType, loadDocuments]);

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort(
        (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at),
      ),
    [documents],
  );

  const sortedRenewals = useMemo(
    () =>
      [...renewalRequests].sort(
        (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at),
      ),
    [renewalRequests],
  );

  const normalizeRenewalStatus = (status) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Pending review";
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top", "bottom"]}>
        <DriverProfileLoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Documents</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => loadDocuments()}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Upload Renewed Document</Text>
          <Text style={styles.uploadSubTitle}>
            Upload updated license and insurance files when they are renewed.
          </Text>

          <Text style={styles.fieldLabel}>Document type</Text>
          <View style={styles.typeWrap}>
            {RENEWABLE_DOC_TYPES.map((type) => {
              const active = selectedType === type.value;
              return (
                <TouchableOpacity
                  key={type.value}
                  style={[styles.typePill, active && styles.typePillActive]}
                  onPress={() => setSelectedType(type.value)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.typeText, active && styles.typeTextActive]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>PDF / Image file</Text>
          <TouchableOpacity
            style={styles.filePicker}
            onPress={pickFile}
            activeOpacity={0.85}
          >
            <Ionicons name="attach-outline" size={16} color="#334155" />
            <Text style={styles.filePickerText}>
              {selectedFile?.name || "Choose file"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.uploadButton,
              uploading && styles.uploadButtonDisabled,
            ]}
            onPress={uploadDocument}
            disabled={uploading}
            activeOpacity={0.85}
          >
            <Text style={styles.uploadButtonText}>
              {uploading ? "Uploading..." : "Upload Document"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Uploaded Documents</Text>
          {sortedDocuments.length === 0 ? (
            <Text style={styles.emptyText}>No documents uploaded yet.</Text>
          ) : (
            sortedDocuments.map((doc, index) => (
              <View
                key={doc.id || `${doc.document_type}-${index}`}
                style={[
                  styles.docRow,
                  index === sortedDocuments.length - 1 && styles.docRowLast,
                ]}
              >
                <View style={styles.docInfo}>
                  <Text style={styles.docType}>
                    {normalizeTypeLabel(doc.document_type)}
                  </Text>
                  <Text style={styles.docMeta}>
                    Uploaded: {formatDate(doc.uploaded_at)}
                  </Text>
                  <Text style={styles.docMeta}>
                    Status: {doc.verified ? "Verified" : "Pending review"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => Linking.openURL(doc.document_url)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Renewal Requests</Text>
          {sortedRenewals.length === 0 ? (
            <Text style={styles.emptyText}>No renewal requests yet.</Text>
          ) : (
            sortedRenewals.map((renewal, index) => (
              <View
                key={renewal.id || `${renewal.document_type}-${index}`}
                style={[
                  styles.docRow,
                  index === sortedRenewals.length - 1 && styles.docRowLast,
                ]}
              >
                <View style={styles.docInfo}>
                  <Text style={styles.docType}>
                    {normalizeTypeLabel(renewal.document_type)}
                  </Text>
                  <Text style={styles.docMeta}>
                    Submitted: {formatDate(renewal.submitted_at)}
                  </Text>
                  <Text style={styles.docMeta}>
                    Status: {normalizeRenewalStatus(renewal.status)}
                  </Text>
                  {!!renewal.review_reason && (
                    <Text style={styles.docMeta}>
                      Reason: {renewal.review_reason}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => Linking.openURL(renewal.proposed_document_url)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 12,
  },
  uploadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  uploadSubTitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },
  fieldLabel: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
  },
  typeWrap: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typePill: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#FFFFFF",
  },
  typePillActive: {
    borderColor: "#0F172A",
    backgroundColor: "#111827",
  },
  typeText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
  },
  typeTextActive: {
    color: "#FFFFFF",
  },
  filePicker: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 11,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  filePickerText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
    flex: 1,
  },
  uploadButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  listTitle: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyText: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 13,
    color: "#64748B",
  },
  docRow: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  docRowLast: {
    borderBottomWidth: 0,
  },
  docInfo: {
    flex: 1,
  },
  docType: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
  },
  docMeta: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  viewButton: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewButtonText: {
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "700",
  },
});
