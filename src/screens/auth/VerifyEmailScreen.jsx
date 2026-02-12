import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { API_BASE_URL } from "../../constants/api";

export default function VerifyEmailScreen({ navigation }) {
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const run = async () => {
      try {
        // Example deep link:
        // nearme://verify-email?token=ACCESS_TOKEN
        // or nearme://verify-email?access_token=ACCESS_TOKEN
        const url = await Linking.getInitialURL();

        console.log("=== VERIFY EMAIL SCREEN LOADED ===");
        console.log("Initial URL:", url);

        if (!url) {
          setStatus("error");
          setMessage("No verification link found. Please open the link from your email.");
          return;
        }

        const parsed = Linking.parse(url);
        console.log("Parsed link:", parsed);

        // support multiple param names
        const token =
          parsed?.queryParams?.token ||
          parsed?.queryParams?.access_token ||
          parsed?.queryParams?.accessToken;

        const error = parsed?.queryParams?.error;
        const errorDescription =
          parsed?.queryParams?.error_description || parsed?.queryParams?.errorDescription;

        if (error) {
          setStatus("error");
          setMessage(errorDescription || "Verification failed. The link may have expired.");
          return;
        }

        if (!token) {
          setStatus("error");
          setMessage("Invalid verification link. Please check your email and try again.");
          return;
        }

        console.log("✅ Token found - verifying with backend...");

        const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));
        console.log("Backend verification response:", data);

        if (response.ok && data?.userId) {
          setStatus("success");
          setMessage("Email verified successfully!");

          setTimeout(() => {
            // You should create CompleteProfile screen later
            // navigation.replace("CompleteProfile", { userId: data.userId });
            navigation.navigate("Login"); // temporary fallback
          }, 2000);
        } else {
          setStatus("error");
          setMessage(data?.message || "Failed to verify email. Please try again.");
        }
      } catch (e) {
        console.error("❌ Verification error:", e);
        setStatus("error");
        setMessage("An error occurred during verification. Please try again.");
      }
    };

    run();
  }, [navigation]);

  return (
    <LinearGradient colors={["#FFF7ED", "#FEE2E2"]} style={styles.container}>
      <View style={styles.card}>
        {status === "verifying" && (
          <>
            <ActivityIndicator size="large" />
            <Text style={styles.title}>Verifying Email</Text>
            <Text style={styles.text}>{message}</Text>
          </>
        )}

        {status === "success" && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.icon, { color: "#22C55E" }]}>✓</Text>
            </View>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.text}>{message}</Text>
            <Text style={styles.small}>Redirecting...</Text>
          </>
        )}

        {status === "error" && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Text style={[styles.icon, { color: "#EF4444" }]}>✕</Text>
            </View>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.text}>{message}</Text>

            <Pressable
              onPress={() => navigation.navigate("Signup")}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.buttonText}>Back to Signup</Text>
            </Pressable>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "900", color: "#111827", marginTop: 12, marginBottom: 6 },
  text: { textAlign: "center", color: "#4B5563", fontSize: 14 },
  small: { marginTop: 10, color: "#6B7280", fontSize: 12 },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  icon: { fontSize: 34, fontWeight: "900" },

  button: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "#25f916",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "800" },
});