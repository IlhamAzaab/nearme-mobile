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
import { useAuth } from "../../app/providers/AuthProvider";
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

function maskAccountNumber(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return "-";
  if (text.length <= 4) return text;
  const hidden = "*".repeat(Math.max(text.length - 4, 4));
  return `${hidden}${text.slice(-4)}`;
}

function DetailRow({ label, value, isLast = false }) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "-"}</Text>
    </View>
  );
}

export default function AdminBankDetailsScreen({ navigation }) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bank, setBank] = useState(null);

  const loadBankDetails = useCallback(async () => {
    setLoading(true);
    setNotFound(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        await logout();
        return;
      }

      const res = await fetch(`${API_URL}/admin/bank-account`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 401 || res.status === 403) {
        await logout();
        return;
      }

      if (res.status === 404) {
        setNotFound(true);
        setBank(null);
        return;
      }

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.bankAccount) {
        Alert.alert(
          "Error",
          payload?.message || "Failed to load bank details.",
        );
        setBank(null);
        return;
      }

      setBank(payload.bankAccount);
    } catch {
      Alert.alert("Error", "Network error while loading bank details.");
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadBankDetails();
  }, [loadBankDetails]);

  const accountNumber = useMemo(
    () => maskAccountNumber(bank?.account_number),
    [bank?.account_number],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading bank details...</Text>
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

        <Text style={styles.headerTitle}>Bank Account Details</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={loadBankDetails}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      {notFound || !bank ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="card-outline" size={46} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No bank details found</Text>
          <Text style={styles.emptyText}>
            Bank account details are not available yet for this restaurant.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>Payout Account</Text>
              <Text style={styles.cardSubTitle}>Restaurant bank account</Text>
            </View>
            <View
              style={[
                styles.verificationPill,
                bank.verified && styles.verificationPillVerified,
              ]}
            >
              <Text
                style={[
                  styles.verificationText,
                  bank.verified && styles.verificationTextVerified,
                ]}
              >
                {bank.verified ? "Verified" : "Pending"}
              </Text>
            </View>
          </View>

          <DetailRow
            label="Account Holder Name"
            value={bank.account_holder_name || "-"}
          />
          <DetailRow label="Bank Name" value={bank.bank_name || "-"} />
          <DetailRow label="Branch" value={bank.branch || "-"} />
          <DetailRow label="Account Number" value={accountNumber} />
          <DetailRow
            label="Saved On"
            value={formatDateTime(bank.created_at)}
            isLast
          />
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
  card: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  cardSubTitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  verificationPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  verificationPillVerified: {
    backgroundColor: "#DCFCE7",
  },
  verificationText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
  },
  verificationTextVerified: {
    color: "#166534",
  },
  detailRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "700",
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
