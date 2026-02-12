import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function DriverAcceptedCard({ driverName, vehicleNumber }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Driver Accepted 🚗</Text>

      <Text style={styles.subtitle}>
        A driver has accepted your order. Driver is going to restaurant now.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.label}>Driver:</Text>
        <Text style={styles.value}>{driverName || "Assigned"}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.label}>Vehicle:</Text>
        <Text style={styles.value}>{vehicleNumber || "N/A"}</Text>
      </View>
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

  infoBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: "#ddd",
  },
  label: { fontSize: 14, color: "#444" },
  value: { fontSize: 14, fontWeight: "700", color: "#000" },
});