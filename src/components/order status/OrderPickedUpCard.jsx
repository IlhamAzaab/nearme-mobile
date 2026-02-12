import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function OrderPickedUpCard({ pickedUpTime }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Order Picked Up ✅</Text>

      <Text style={styles.subtitle}>
        Driver has picked up your order from the restaurant.
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Picked Up Time:</Text>
        <Text style={styles.value}>
          {pickedUpTime || "Just now"}
        </Text>
      </View>

      <Text style={styles.smallText}>
        Driver will start delivery soon.
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