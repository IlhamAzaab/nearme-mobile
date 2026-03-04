import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DRAWER_WIDTH = Dimensions.get("window").width * 0.75;

/**
 * ManagerDrawer – slide-in sidebar for sub-section navigation.
 *
 * Props:
 *  visible       {boolean}  Whether the drawer is open
 *  onClose       {function} Close the drawer
 *  sectionTitle  {string}   Header title (e.g. "Restaurant & Admin")
 *  items         {Array}    Array of { route, label, icon, tabTarget? }
 *  activeRoute   {string}   Current active route name
 *  navigation    {object}   Navigation object
 */
const ManagerDrawer = ({
  visible,
  onClose,
  sectionTitle = "Navigation",
  items = [],
  activeRoute,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleNavigate = (item) => {
    onClose();
    if (item.route === activeRoute) return;

    if (item.tabTarget) {
      // Tab root screen (e.g. Driver Deposits, Admin Payments)
      // Pop the entire sub-screen stack back to the tab's root screen
      if (navigation.canGoBack()) {
        navigation.popToTop();
      } else {
        navigation.navigate(item.tabTarget);
      }
    } else {
      // Sub-screen within the same tab – use navigate to preserve back history
      navigation.navigate(item.route);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Drawer panel */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: slideAnim }],
              paddingTop: insets.top + 12,
            },
          ]}
        >
          {/* Drawer header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.nmIcon}>
                <Text style={styles.nmText}>NM</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {sectionTitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Navigation items */}
          <View style={styles.navList}>
            {items.map((item) => {
              const isActive = activeRoute === item.route;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => handleNavigate(item)}
                  activeOpacity={0.7}
                >
                  {isActive && <View style={styles.activeBar} />}
                  <Ionicons
                    name={item.icon || "ellipse-outline"}
                    size={18}
                    color={isActive ? "#059669" : "#6B7280"}
                    style={styles.navIcon}
                  />
                  <Text
                    style={[styles.navText, isActive && styles.navTextActive]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: "#fff",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  nmIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#059669",
    justifyContent: "center",
    alignItems: "center",
  },
  nmText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  navList: {
    paddingTop: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "#F0FDF4",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: "#059669",
  },
  navIcon: {
    marginRight: 12,
    width: 20,
  },
  navText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    flex: 1,
  },
  navTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
});

export default ManagerDrawer;
