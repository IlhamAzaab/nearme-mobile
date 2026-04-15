import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

function formatDateTime(value) {
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

export default function DriverContractScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const loadContract = useCallback(async () => {
    setLoading(true);
    setNotFound(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      const res = await fetch(`${API_URL}/driver/contract`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 404) {
        setNotFound(true);
        setContract(null);
        return;
      }

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to load contract");
      }

      setContract(payload?.contract || null);
    } catch (error) {
      Alert.alert("Error", error?.message || "Unable to load contract.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const contractDocument = useMemo(() => {
    const body =
      contract?.contract_html || "<p>Contract content is unavailable.</p>";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            :root {
              color-scheme: light;
            }
            body {
              margin: 0;
              background: #f8fafc;
              color: #111827;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              line-height: 1.7;
              font-size: 15px;
            }
            .wrap {
              max-width: 820px;
              margin: 0 auto;
              padding: 22px 18px 26px;
            }
            h1, h2, h3, h4 {
              color: #0f172a;
              margin-top: 0;
            }
            h1, h2 {
              margin-top: 8px;
              margin-bottom: 10px;
            }
            p {
              margin: 0 0 12px;
            }
            ul, ol {
              padding-left: 22px;
              margin: 0 0 12px;
            }
            li {
              margin-bottom: 6px;
            }
            strong {
              color: #0f172a;
            }
          </style>
        </head>
        <body>
          <div class="wrap">${body}</div>
        </body>
      </html>
    `;
  }, [contract?.contract_html]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading contract...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Contract</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={loadContract}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      {notFound || !contract ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="document-text-outline" size={46} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No contract found</Text>
          <Text style={styles.emptyText}>
            Contract details are not available for this account yet.
          </Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Version</Text>
              <Text style={styles.metaValue}>
                {contract.contract_version || "-"}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Accepted On</Text>
              <Text style={styles.metaValue}>
                {formatDateTime(contract.accepted_at || contract.created_at)}
              </Text>
            </View>
          </View>

          <View style={styles.webWrap}>
            <WebView
              source={{ html: contractDocument }}
              style={styles.webView}
              originWhitelist={["*"]}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
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
  contentWrap: {
    flex: 1,
    gap: 10,
    paddingBottom: 10,
  },
  metaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  webWrap: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
  },
});
