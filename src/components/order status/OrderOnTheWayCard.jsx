import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function OrderOnTheWayCard({ etaMinutes, distanceKm }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>On The Way 🚗</Text>

      <Text style={styles.subtitle}>
        Driver is heading to your location.
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>ETA:</Text>
        <Text style={styles.value}>
          {etaMinutes != null ? `${etaMinutes} mins` : "Updating..."}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Distance:</Text>
        <Text style={styles.value}>
          {distanceKm != null ? `${distanceKm} km` : "Updating..."}
        </Text>
      </View>

      <Text style={styles.smallText}>
        You can track driver location on the map.
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