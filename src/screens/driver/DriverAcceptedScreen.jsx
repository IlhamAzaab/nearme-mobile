import React from "react";
import {
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import api from "../../services/api";

/**
 * DriverAcceptedScreen - Shows details of an accepted delivery
 */
const DriverAcceptedScreen = ({ navigation, route }) => {
  const { deliveryId } = route.params || {};
  const queryClient = useQueryClient();

  const deliveryQuery = useQuery({
    queryKey: ["driver", "accepted-delivery", String(deliveryId || "")],
    enabled: Boolean(deliveryId),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    initialData: () =>
      queryClient.getQueryData([
        "driver",
        "accepted-delivery",
        String(deliveryId || ""),
      ]),
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await api.get(`/deliveries/${deliveryId}`);
      return response.data || null;
    },
  });

  const delivery = deliveryQuery.data || null;
  const loading = deliveryQuery.isLoading && !delivery;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Loading delivery details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <DriverScreenSection screenKey="DriverAccepted" sectionIndex={0}>
            <Text style={styles.title}>Delivery Accepted ✅</Text>
          </DriverScreenSection>

          {delivery && (
            <>
              <DriverScreenSection screenKey="DriverAccepted" sectionIndex={1}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Pickup</Text>
                  <Text style={styles.restaurantName}>
                    {delivery.restaurantName || "Restaurant"}
                  </Text>
                  <Text style={styles.address}>
                    {delivery.pickupAddress || "N/A"}
                  </Text>
                </View>
              </DriverScreenSection>

              <DriverScreenSection screenKey="DriverAccepted" sectionIndex={2}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Dropoff</Text>
                  <Text style={styles.customerName}>
                    {delivery.customerName || "Customer"}
                  </Text>
                  <Text style={styles.address}>
                    {delivery.dropoffAddress || "N/A"}
                  </Text>
                </View>
              </DriverScreenSection>

              <DriverScreenSection screenKey="DriverAccepted" sectionIndex={3}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Order Details</Text>
                  <Text style={styles.items}>
                    {delivery.itemCount || 0} items
                  </Text>
                  <Text style={styles.earnings}>
                    Earnings: ETB {delivery.earnings || 0}
                  </Text>
                </View>
              </DriverScreenSection>

              <DriverScreenSection screenKey="DriverAccepted" sectionIndex={4}>
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() =>
                    navigation.navigate("DriverMap", { deliveryId })
                  }
                >
                  <Text style={styles.navigateBtnText}>
                    🗺️ Navigate to Pickup
                  </Text>
                </TouchableOpacity>
              </DriverScreenSection>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },
  restaurantName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  customerName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  address: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  items: { fontSize: 15, color: "#374151" },
  earnings: { fontSize: 16, fontWeight: "700", color: "#06C168", marginTop: 4 },
  navigateBtn: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  navigateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default DriverAcceptedScreen;
