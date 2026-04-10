import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/**
 * ManagerHeader – website-style header for all manager screens.
 *
 * Props:
 *  title       {string}   Screen title (required)
 *  onRefresh   {function} Optional refresh handler – shows refresh icon
 *  onMenuPress {function} Optional menu handler – shows hamburger icon
 *  showBack    {boolean}  Show back chevron (default false)
 */
const ManagerHeader = ({
  title = "Dashboard",
  onRefresh,
  onMenuPress,
  showBack = false,
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Left section */}
      <View style={styles.leftSection}>
        {showBack && navigation.canGoBack() && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#374151" />
          </TouchableOpacity>
        )}
        {onMenuPress && (
          <TouchableOpacity
            onPress={onMenuPress}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={22} color="#374151" />
          </TouchableOpacity>
        )}
        <View style={styles.nmIcon}>
          <Text style={styles.nmText}>MEEZO</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Right section */}
      <View style={styles.rightSection}>
        {onRefresh && (
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color="#374151" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => navigation.navigate("ManagerAccount")}
          style={styles.iconBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="person-circle-outline" size={26} color="#374151" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 8,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nmIcon: {
    minWidth: 56,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#06C168",
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  nmText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ManagerHeader;
