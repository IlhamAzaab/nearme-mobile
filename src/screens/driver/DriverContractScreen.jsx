import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DriverProfileLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";
import {
  getDriverProfileScreenCache,
  setDriverProfileScreenCache,
} from "../../utils/driverProfileScreenCache";

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

function decodeHtmlEntities(text) {
  if (!text) return "";
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToReadableParagraphs(html) {
  if (!html) return ["Contract content is unavailable."];

  const normalized = String(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "- ")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<\s*h[1-6]\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "");

  const decoded = decodeHtmlEntities(normalized)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!decoded) return ["Contract content is unavailable."];

  return decoded
    .split(/\n\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isHeadingLine(line) {
  if (!line) return false;
  const cleaned = line.replace(/[\s:.-]+$/g, "").trim();
  if (!cleaned) return false;
  const compact = cleaned.replace(/[^a-zA-Z]/g, "");
  if (compact.length < 4 || compact.length > 70) return false;
  const uppercaseRatio =
    compact.split("").filter((ch) => ch === ch.toUpperCase()).length /
    compact.length;
  return /^\d+(\.\d+)*\s+/.test(cleaned) || uppercaseRatio > 0.75;
}

export default function DriverContractScreen({ navigation }) {
  const { user } = useAuth();
  const userScope = String(user?.id || "anon");
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const loadContract = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
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
        await setDriverProfileScreenCache("contract-details", {
          contract: null,
          notFound: true,
        });
        return;
      }

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to load contract");
      }

      const nextContract = payload?.contract || null;
      setContract(nextContract);
      await setDriverProfileScreenCache("contract-details", {
        contract: nextContract,
        notFound: !nextContract,
      });
    } catch (error) {
      if (!silent) {
        Alert.alert("Error", error?.message || "Unable to load contract.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    setContract(null);
    setNotFound(false);
    setLoading(true);

    (async () => {
      const cached = await getDriverProfileScreenCache("contract-details");
      if (cached && mounted) {
        setContract(cached.contract || null);
        setNotFound(!!cached.notFound);
        setLoading(false);
        loadContract({ silent: true });
        return;
      }
      loadContract();
    })();

    return () => {
      mounted = false;
    };
  }, [loadContract, userScope]);

  const contractParagraphs = useMemo(
    () => htmlToReadableParagraphs(contract?.contract_html),
    [contract?.contract_html],
  );

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
            <View style={styles.badgeRow}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>DRIVER AGREEMENT</Text>
              </View>
            </View>
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

          <View style={styles.contractCard}>
            <ScrollView
              contentContainerStyle={styles.contractScroll}
              showsVerticalScrollIndicator={false}
            >
              {contractParagraphs.map((line, index) => (
                <Text
                  key={`${index}:${line.slice(0, 16)}`}
                  style={
                    isHeadingLine(line)
                      ? styles.contractHeading
                      : styles.contractParagraph
                  }
                >
                  {line}
                </Text>
              ))}
            </ScrollView>
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
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  badgeRow: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    marginBottom: 6,
  },
  badgePill: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
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
  contractCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  contractScroll: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  contractHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  contractParagraph: {
    fontSize: 14,
    lineHeight: 22,
    color: "#334155",
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
