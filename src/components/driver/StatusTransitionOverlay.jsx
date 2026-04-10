import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { SVG_ARTBOARD8_XML } from "../../assets/SvgArtboard8Xml";

export default function StatusTransitionOverlay({
  visible,
  status,
  actionType = "pickup",
  errorMessage = "",
  onComplete,
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const logoPulseAnim = useRef(new Animated.Value(1)).current;
  const logoFadeAnim = useRef(new Animated.Value(1)).current;
  const haloScaleAnim = useRef(new Animated.Value(0.9)).current;
  const haloFadeAnim = useRef(new Animated.Value(0)).current;
  const successPopAnim = useRef(new Animated.Value(0.88)).current;
  const processingLoopRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    fadeAnim.setValue(0);
    scaleAnim.setValue(0.96);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    if (status === "processing") {
      logoPulseAnim.setValue(1);
      logoFadeAnim.setValue(1);
      haloScaleAnim.setValue(0.9);
      haloFadeAnim.setValue(0);
      processingLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(logoPulseAnim, {
              toValue: 1.14,
              duration: 760,
              useNativeDriver: true,
            }),
            Animated.timing(logoFadeAnim, {
              toValue: 0.62,
              duration: 760,
              useNativeDriver: true,
            }),
            Animated.timing(haloScaleAnim, {
              toValue: 1.28,
              duration: 760,
              useNativeDriver: true,
            }),
            Animated.timing(haloFadeAnim, {
              toValue: 0.28,
              duration: 760,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(logoPulseAnim, {
              toValue: 1,
              duration: 760,
              useNativeDriver: true,
            }),
            Animated.timing(logoFadeAnim, {
              toValue: 1,
              duration: 760,
              useNativeDriver: true,
            }),
            Animated.timing(haloScaleAnim, {
              toValue: 0.9,
              duration: 760,
              useNativeDriver: true,
            }),
            Animated.timing(haloFadeAnim, {
              toValue: 0,
              duration: 760,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      processingLoopRef.current.start();
    }

    return () => {
      processingLoopRef.current?.stop();
    };
  }, [
    visible,
    status,
    fadeAnim,
    scaleAnim,
    logoPulseAnim,
    logoFadeAnim,
    haloScaleAnim,
    haloFadeAnim,
  ]);

  useEffect(() => {
    if (!visible || status !== "success") return;

    processingLoopRef.current?.stop();
    successPopAnim.setValue(0.88);
    Animated.spring(successPopAnim, {
      toValue: 1,
      friction: 6,
      tension: 75,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => onComplete?.());
    }, 1500);

    return () => clearTimeout(timer);
  }, [visible, status, fadeAnim, successPopAnim, onComplete]);

  if (!visible) return null;

  const isPickup = actionType === "pickup";
  const title =
    status === "processing"
      ? isPickup
        ? "Picking up order..."
        : "Completing delivery..."
      : status === "success"
        ? isPickup
          ? "Order Picked Up!"
          : "Delivered Successfully!"
        : isPickup
          ? "Pickup Failed"
          : "Delivery Failed";

  const subtitle =
    status === "processing"
      ? "Updating live order status"
      : status === "success"
        ? isPickup
          ? "Head to the customer now"
          : "Great job!"
        : errorMessage || "Something went wrong. Please try again.";

  const bgColor =
    status === "error"
      ? "rgba(239,68,68,0.95)"
      : status === "success"
        ? "rgba(6,95,70,0.92)"
        : "rgba(2,6,23,0.86)";

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          backgroundColor: bgColor,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="auto"
    >
      <View style={styles.card}>
        <View style={styles.logoStage}>
          {status === "processing" ? (
            <Animated.View
              style={[
                styles.processingHalo,
                {
                  opacity: haloFadeAnim,
                  transform: [{ scale: haloScaleAnim }],
                },
              ]}
            />
          ) : null}

          <Animated.View
            style={[
              styles.logoWrap,
              status === "processing"
                ? {
                    opacity: logoFadeAnim,
                    transform: [{ scale: logoPulseAnim }],
                  }
                : { opacity: 1, transform: [{ scale: successPopAnim }] },
            ]}
          >
            <SvgXml xml={SVG_ARTBOARD8_XML} width={420} height={420} />
          </Animated.View>
        </View>

        {status === "success" ? (
          <Animated.View
            style={[
              styles.successBadge,
              { transform: [{ scale: successPopAnim }] },
            ]}
          >
            <Text style={styles.successIcon}>✓</Text>
          </Animated.View>
        ) : null}

        {status === "error" ? <Text style={styles.errorIcon}>⚠</Text> : null}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {status === "error" ? (
          <Pressable style={styles.retryBtn} onPress={() => onComplete?.()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  logoStage: {
    width: 430,
    height: 430,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 14,
  },
  logoWrap: {
    position: "absolute",
    width: 430,
    height: 430,
    alignItems: "center",
    justifyContent: "center",
  },
  processingHalo: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: "#10B981",
  },
  successBadge: {
    marginTop: -6,
    marginBottom: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: { color: "#fff", fontSize: 22, fontWeight: "900" },
  errorIcon: { color: "#fff", fontSize: 28, marginBottom: 8 },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 22,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: { color: "#dc2626", fontSize: 14, fontWeight: "800" },
});
