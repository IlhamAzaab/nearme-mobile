import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SW } = Dimensions.get("window");

// ─── Context ────────────────────────────────────────────────────────────────
const CustomAlertContext = createContext(null);

export function useCustomAlert() {
  return useContext(CustomAlertContext);
}

// ─── Provider ───────────────────────────────────────────────────────────────
export function CustomAlertProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [buttons, setButtons] = useState([]);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const show = useCallback(
    (t, msg, btns) => {
      setTitle(t || "");
      setMessage(msg || "");
      setButtons(btns && btns.length > 0 ? btns : [{ text: "OK" }]);
      setVisible(true);

      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 100,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [scaleAnim, opacityAnim],
  );

  const dismiss = useCallback(
    (cb) => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        if (typeof cb === "function") cb();
      });
    },
    [scaleAnim, opacityAnim],
  );

  // ── Monkey-patch Alert.alert once ──
  const patched = useRef(false);
  if (!patched.current) {
    patched.current = true;
    const _original = Alert.alert.bind(Alert);
    Alert.alert = (t, msg, btns, opts) => {
      // Use our custom modal
      show(t, msg, btns);
    };
    // Keep reference in case someone needs native
    Alert._originalAlert = _original;
  }

  // ─── Determine button type (colour) based on style / title ──
  const getButtonStyle = (btn, index, total) => {
    if (btn.style === "destructive") return "destructive";
    if (btn.style === "cancel") return "cancel";
    // Last button (primary action) → green
    if (total === 1) return "primary";
    if (index === total - 1) return "primary";
    return "cancel";
  };

  return (
    <CustomAlertContext.Provider value={{ show }}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => dismiss()}
      >
        <View style={s.backdrop}>
          <Animated.View
            style={[
              s.card,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Title */}
            {!!title && <Text style={s.title}>{title}</Text>}

            {/* Message */}
            {!!message && <Text style={s.message}>{message}</Text>}

            {/* Buttons */}
            <View style={s.btnWrap}>
              {buttons.map((btn, idx) => {
                const type = getButtonStyle(btn, idx, buttons.length);
                return (
                  <Pressable
                    key={idx}
                    onPress={() => dismiss(btn.onPress)}
                    style={({ pressed }) => [
                      s.btn,
                      type === "primary" && s.btnPrimary,
                      type === "destructive" && s.btnDestructive,
                      type === "cancel" && s.btnCancel,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text
                      style={[
                        s.btnText,
                        type === "primary" && s.btnTextPrimary,
                        type === "destructive" && s.btnTextDestructive,
                        type === "cancel" && s.btnTextCancel,
                      ]}
                    >
                      {btn.text || "OK"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: Math.min(SW - 64, 340),
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 26,
  },
  message: {
    fontSize: 14,
    fontWeight: "400",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  btnWrap: {
    width: "100%",
    gap: 10,
  },

  // ── Button base ──
  btn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Primary (green) ──
  btnPrimary: {
    backgroundColor: "#06C168",
  },
  btnTextPrimary: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Destructive (red) ──
  btnDestructive: {
    backgroundColor: "#EF4444",
  },
  btnTextDestructive: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Cancel (outline) ──
  btnCancel: {
    backgroundColor: "#F1F5F9",
  },
  btnTextCancel: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
  },

  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
