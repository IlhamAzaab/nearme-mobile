import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function OrderReceivedCard({ restaurantName, prepTime }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Order Received 🍽️</Text>

      <Text style={styles.subtitle}>
        {restaurantName
          ? `${restaurantName} has received your order.`
          : "Restaurant has received your order."}
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Preparation Time:</Text>
        <Text style={styles.value}>
          {prepTime ? `${prepTime} mins` : "Updating..."}
        </Text>
      </View>

      <Text style={styles.smallText}>
        Your food is being prepared now.
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

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  label: { fontSize: 14, color: "#444" },
  value: { fontSize: 14, fontWeight: "700", color: "#000" },

  smallText: { marginTop: 12, fontSize: 12, color: "#777" },
});