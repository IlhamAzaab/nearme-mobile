import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLinking from "expo-linking";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_BASE_URL } from "../../constants/api";
import { persistAuthSession } from "../../lib/authStorage";

export default function VerifyEmailScreen({ navigation, route }) {
  const { refreshAuthState } = useAuth();
  const pendingEmail = route?.params?.email || "";
  const pendingUserId = route?.params?.userId || null;
  const pendingLoginToken = route?.params?.pendingLoginToken || "";

  const [mode, setMode] = useState("pending"); // pending | verifying | success | error
  const [message, setMessage] = useState("Waiting for email verification...");
  const [busy, setBusy] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  const pollTimerRef = useRef(null);
  const handledTokenRef = useRef(false);
  const autoStartDoneRef = useRef(false);

  const canPoll = useMemo(() => Boolean(pendingUserId), [pendingUserId]);

  const finalizeAuthenticatedFlow = useCallback(
    async (data = {}) => {
      await persistAuthSession(data, {
        userEmail: data?.email || pendingEmail,
        profileCompleted: !!data?.profileCompleted,
      });

      setShowLoginSuccess(true);

      setTimeout(async () => {
        if (data?.role === "customer" && !data?.profileCompleted) {
          navigation.replace("CompleteProfile", {
            userId: data?.userId || pendingUserId,
            accessToken: data?.token || null,
          });
          return;
        }

        await refreshAuthState();
      }, 1300);
    },
    [navigation, pendingEmail, pendingUserId, refreshAuthState],
  );

  const completeEmailLogin = useCallback(async () => {
    if (!pendingLoginToken || isStarting) return;

    setIsStarting(true);
    setMode("verifying");
    setMessage("Preparing your account...");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/complete-email-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-platform": "react-native",
        },
        body: JSON.stringify({ pendingLoginToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMode("error");
        setMessage(
          data?.message || "Unable to complete login. Please verify again.",
        );
        setIsStarting(false);
        return;
      }

      setMode("success");
      setMessage("Email verified. Signing you in...");
      await finalizeAuthenticatedFlow(data);
    } catch {
      setMode("error");
      setMessage("Network error while preparing your account.");
      setIsStarting(false);
    }
  }, [finalizeAuthenticatedFlow, isStarting, pendingLoginToken]);

  const completeVerification = useCallback(
    async (token) => {
      if (!token || handledTokenRef.current) return;
      handledTokenRef.current = true;
      setMode("verifying");
      setMessage("Verifying your email...");

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-platform": "react-native",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMode("error");
          setMessage(data?.message || "Verification failed.");
          handledTokenRef.current = false;
          return;
        }

        setMode("success");
        setMessage("Email verified. Signing you in...");
        await finalizeAuthenticatedFlow(data);
      } catch (error) {
        console.error("Mobile verify-email error:", error);
        setMode("error");
        setMessage("Network error during verification.");
        handledTokenRef.current = false;
      }
    },
    [finalizeAuthenticatedFlow],
  );

  useEffect(() => {
    const consumeUrl = async (url) => {
      if (!url) return;
      const parsed = ExpoLinking.parse(url);
      const token =
        parsed?.queryParams?.token ||
        parsed?.queryParams?.access_token ||
        parsed?.queryParams?.accessToken;

      if (token) {
        await completeVerification(String(token));
      }
    };

    ExpoLinking.getInitialURL()
      .then(consumeUrl)
      .catch(() => {});

    const sub = ExpoLinking.addEventListener("url", ({ url }) => {
      consumeUrl(url);
    });

    return () => sub.remove();
  }, [completeVerification]);

  useEffect(() => {
    if (!canPoll || mode !== "pending") return;

    const check = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/auth/check-email-verified?userId=${encodeURIComponent(pendingUserId)}`,
        );
        const data = await res.json().catch(() => ({}));

        if (data?.verified) {
          setIsVerified(true);
          setMessage("Email verified successfully. Signing you in...");
        }
      } catch {
        // Ignore transient polling errors.
      }
    };

    check();
    pollTimerRef.current = setInterval(check, 5000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [canPoll, mode, pendingUserId]);

  useEffect(() => {
    if (!isVerified || !pendingLoginToken || autoStartDoneRef.current) return;
    autoStartDoneRef.current = true;
    completeEmailLogin();
  }, [completeEmailLogin, isVerified, pendingLoginToken]);

  const handleResend = async () => {
    if (!pendingEmail || busy) return;
    setBusy(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/auth/resend-verification-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: pendingEmail }),
        },
      );
      const data = await res.json().catch(() => ({}));
      setMessage(data?.message || "Verification email sent.");
    } catch {
      setMessage("Failed to resend verification email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={["#123321", "#1db95b", "#0a1f14"]}
      style={styles.container}
    >
      {showLoginSuccess ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCircle}>
            <Text style={styles.successTick}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Login Successful!</Text>
          <Text style={styles.successSub}>
            Open your app and start ordering.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>
          {mode === "verifying"
            ? "Verifying email"
            : mode === "success"
              ? "Verified"
              : mode === "error"
                ? "Verification failed"
                : "Check your email"}
        </Text>

        <Text style={styles.text}>{message}</Text>

        {mode === "pending" ? (
          <Text style={styles.textMuted}>
            Verification link sent to {pendingEmail || "your email"}.
          </Text>
        ) : null}

        {mode === "pending" ? (
          <>
            <Pressable
              onPress={() => Linking.openURL("mailto:")}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Open Mail App</Text>
            </Pressable>

            <Pressable
              onPress={handleResend}
              disabled={busy || !pendingEmail}
              style={({ pressed }) => [
                styles.secondaryBtn,
                (pressed || busy) && { opacity: 0.8 },
              ]}
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.secondaryBtnText}>
                  Resend verification email
                </Text>
              )}
            </Pressable>
          </>
        ) : null}

        {mode === "error" ? (
          <Pressable
            onPress={() => navigation.navigate("Signup")}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>Back to signup</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 18 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 24,
  },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTick: { fontSize: 56, color: "#fff", fontWeight: "900" },
  successTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  successSub: { color: "rgba(255,255,255,0.85)", marginTop: 6 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 10,
  },
  text: { fontSize: 14, color: "#374151", marginBottom: 10 },
  textMuted: { fontSize: 12, color: "#6B7280", marginBottom: 14 },
  primaryBtn: {
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 2,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "700" },
});
