import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerHeader from "../../components/manager/ManagerHeader";
import { API_URL } from "../../config/env";

const ROLE_CONFIG = {
  customer: {
    label: "Customers",
    endpoint: "/manager/customers",
    icon: "person-outline",
    color: "#2563EB",
    nameField: "username",
  },
  admin: {
    label: "Restaurant Admins",
    endpoint: "/manager/admins",
    icon: "business-outline",
    color: "#D97706",
    nameField: "restaurant_name",
  },
  driver: {
    label: "Drivers",
    endpoint: "/manager/drivers",
    icon: "bicycle-outline",
    color: "#059669",
    nameField: "full_name",
  },
};

const parseDateToIso = (value) => {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default function SendNotificationFormScreen({ route, navigation }) {
  const role = route?.params?.role;
  const config = ROLE_CONFIG[role];

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [scheduleInput, setScheduleInput] = useState("");
  const [sendToAll, setSendToAll] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (!config) return;

    const fetchRecipients = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_URL}${config.endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));

        const list = data.customers || data.admins || data.drivers || [];
        setRecipients(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error("Failed to fetch recipients:", error);
        setRecipients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipients();
  }, [config]);

  const filteredRecipients = useMemo(() => {
    if (!searchQuery.trim()) return recipients;
    const q = searchQuery.toLowerCase();

    return recipients.filter((recipient) => {
      const name = (
        recipient?.[config?.nameField] ||
        recipient?.full_name ||
        recipient?.username ||
        recipient?.restaurant_name ||
        recipient?.restaurants?.restaurant_name ||
        ""
      )
        .toString()
        .toLowerCase();
      const email = (recipient?.email || "").toLowerCase();

      return name.includes(q) || email.includes(q);
    });
  }, [recipients, searchQuery, config]);

  const getDisplayName = (recipient) => {
    if (role === "admin") {
      return (
        recipient?.restaurants?.restaurant_name ||
        recipient?.restaurant_name ||
        recipient?.full_name ||
        recipient?.email ||
        "Restaurant Admin"
      );
    }

    return (
      recipient?.[config?.nameField] ||
      recipient?.full_name ||
      recipient?.username ||
      recipient?.email ||
      "User"
    );
  };

  const toggleRecipient = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAllVisible = () => {
    const ids = filteredRecipients.map((r) => r.id).filter(Boolean);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => setSelectedIds([]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Validation", "Title and body are required.");
      return;
    }

    if (!sendToAll && selectedIds.length === 0) {
      Alert.alert("Validation", "Please select at least one recipient.");
      return;
    }

    const scheduledTime = sendNow ? null : parseDateToIso(scheduleInput);
    if (!sendNow && !scheduledTime) {
      Alert.alert(
        "Validation",
        "Enter a valid schedule as YYYY-MM-DD HH:mm (24h format).",
      );
      return;
    }

    setSending(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const payload = {
        role,
        title: title.trim(),
        body: body.trim(),
        scheduledTime,
        recipientIds: sendToAll ? "all" : selectedIds,
      };

      const res = await fetch(`${API_URL}/manager/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        Alert.alert(
          "Success",
          data.message || "Notification sent successfully.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.goBack();
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Failed",
          data?.message || `Unable to send notification (${res.status}).`,
        );
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!config) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ManagerHeader title="Send Notification" showBack />
        <View style={styles.centered}>
          <Text style={styles.invalidText}>Invalid audience selected.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ManagerHeader title={`Notify ${config.label}`} showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#06C168" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader title={`Notify ${config.label}`} showBack />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heroCard}>
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: `${config.color}22` },
              ]}
            >
              <Ionicons name={config.icon} size={22} color={config.color} />
            </View>
            <Text style={styles.heroTitle}>Send to {config.label}</Text>
            <Text style={styles.heroSub}>
              {recipients.length} recipients available in this group.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              placeholder="Enter notification title"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.counter}>{title.length}/100</Text>

            <Text style={[styles.label, { marginTop: 10 }]}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={body}
              onChangeText={setBody}
              maxLength={500}
              multiline
              textAlignVertical="top"
              placeholder="Write your notification message"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.counter}>{body.length}/500</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Send now</Text>
              <Switch value={sendNow} onValueChange={setSendNow} />
            </View>

            {!sendNow && (
              <>
                <Text style={[styles.helper, { marginBottom: 8 }]}>
                  Format: YYYY-MM-DD HH:mm
                </Text>
                <TextInput
                  style={styles.input}
                  value={scheduleInput}
                  onChangeText={setScheduleInput}
                  placeholder="2026-04-09 18:30"
                  placeholderTextColor="#94A3B8"
                />
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Send to all</Text>
              <Switch
                value={sendToAll}
                onValueChange={(value) => {
                  setSendToAll(value);
                  if (value) clearSelection();
                }}
              />
            </View>

            {!sendToAll && (
              <>
                <TextInput
                  style={styles.input}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search recipients"
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.selectionActions}>
                  <TouchableOpacity onPress={selectAllVisible}>
                    <Text style={styles.selectionActionText}>
                      Select visible
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearSelection}>
                    <Text style={styles.selectionActionText}>Clear</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={filteredRecipients}
                  keyExtractor={(item, index) => String(item.id ?? index)}
                  scrollEnabled={false}
                  renderItem={({ item }) => {
                    const selected = selectedIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        style={styles.recipientRow}
                        onPress={() => toggleRecipient(item.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recipientName} numberOfLines={1}>
                            {getDisplayName(item)}
                          </Text>
                          {!!item.email && (
                            <Text
                              style={styles.recipientEmail}
                              numberOfLines={1}
                            >
                              {item.email}
                            </Text>
                          )}
                        </View>
                        <Ionicons
                          name={selected ? "checkbox" : "square-outline"}
                          size={21}
                          color={selected ? "#06C168" : "#94A3B8"}
                        />
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.helper}>
                      No recipients found for this search.
                    </Text>
                  }
                />

                <Text style={styles.helper}>{selectedIds.length} selected</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, sending && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleSend}
            disabled={sending}
          >
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {sending ? "Sending..." : "Send Notification"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  invalidText: {
    color: "#DC2626",
    marginBottom: 14,
    fontSize: 14,
    fontWeight: "600",
  },
  scroll: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
    color: "#64748B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  textArea: {
    minHeight: 90,
  },
  counter: {
    marginTop: 4,
    alignSelf: "flex-end",
    fontSize: 11,
    color: "#94A3B8",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  helper: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 8,
  },
  selectionActions: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  selectionActionText: {
    color: "#06C168",
    fontSize: 12,
    fontWeight: "700",
  },
  recipientRow: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
  },
  recipientName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111816",
    marginBottom: 1,
  },
  recipientEmail: {
    fontSize: 12,
    color: "#64748B",
  },
  primaryBtn: {
    backgroundColor: "#111816",
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
