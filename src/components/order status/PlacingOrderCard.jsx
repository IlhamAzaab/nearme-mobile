import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export default function PlacingOrderCard({ restaurantName }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Placing Order ⏳</Text>

      <Text style={styles.subtitle}>
        {restaurantName
          ? `Confirming order with ${restaurantName}...`
          : "Confirming your order with the restaurant..."}
      </Text>

      <View style={styles.loaderBox}>
        <ActivityIndicator size="large" />
      </View>

      <Text style={styles.smallText}>
        Please wait. Do not close the app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#fff",
    elevation: 3,
    marginTop: 10,
  },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { marginTop: 8, fontSize: 14, color: "#555" },
  loaderBox: { marginTop: 20, alignItems: "center" },
  smallText: { marginTop: 12, fontSize: 12, color: "#777" },
});