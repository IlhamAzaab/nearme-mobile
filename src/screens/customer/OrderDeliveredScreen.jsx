import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PRIMARY = "#10B981";

/**
 * OrderDeliveredScreen - Premium confirmation that order has been delivered
 */
const OrderDeliveredScreen = ({ navigation, route }) => {
  const { orderId } = route.params || {};

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.closeBtn, pressed && { backgroundColor: "#F1F5F9" }]}
        >
          <Ionicons name="close" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Order Status</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Hero Illustration */}
        <View style={styles.heroSection}>
          {/* Decorative glow */}
          <View style={styles.glowCircle} />
          {/* Success icon */}
          <View style={styles.successCircle}>
            <View style={styles.successInner}>
              <Ionicons name="checkmark" size={60} color="#fff" />
            </View>
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textSection}>
          <Text style={styles.title}>Order Delivered!</Text>
          <Text style={styles.subtitle}>
            Your meal has been delivered safely.{"\n"}We hope you enjoy it!
          </Text>
          <View style={styles.orderTag}>
            <Text style={styles.orderTagText}>Order #{orderId || "—"}</Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1, minHeight: 40 }} />

        {/* Action Buttons */}
        <View style={styles.buttonsSection}>
          {/* Rate Button */}
          <Pressable
            onPress={() => {
              /* TODO: Navigate to rating screen */
            }}
            style={({ pressed }) => [styles.rateBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={styles.rateBtnText}>Rate Your Experience</Text>
          </Pressable>

          {/* Back to Home */}
          <Pressable
            onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
            style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </Pressable>
        </View>

        {/* Help Link */}
        <Pressable
          onPress={() => {
            /* TODO: Navigate to support */
          }}
          style={styles.helpLink}
        >
          <Text style={styles.helpText}>Need help with this order?</Text>
          <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  // Content
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  // Hero
  heroSection: {
    width: SCREEN_WIDTH * 0.55,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  glowCircle: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: `${PRIMARY}08`,
    transform: [{ scale: 1.3 }],
  },
  successCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${PRIMARY}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  successInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  // Text
  textSection: {
    alignItems: "center",
    marginTop: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
    marginBottom: 16,
  },
  orderTag: {
    backgroundColor: `${PRIMARY}15`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  orderTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Buttons
  buttonsSection: {
    width: "100%",
    gap: 12,
  },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  rateBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  homeBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#F1F5F9",
  },
  homeBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
  },

  // Help
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 28,
  },
  helpText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
});

export default OrderDeliveredScreen;
