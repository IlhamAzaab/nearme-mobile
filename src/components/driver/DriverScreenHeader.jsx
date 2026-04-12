import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function DriverScreenHeader({
  title,
  onBackPress,
  rightIcon,
  onRightPress,
  backgroundColor = "#fff",
  textColor = "#111827",
  rightIconColor = "#111827",
}) {
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBackPress}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={30} color={textColor} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: textColor }]}>{title}</Text>

      <TouchableOpacity
        style={styles.rightBtn}
        onPress={onRightPress}
        activeOpacity={0.7}
      >
        {rightIcon && typeof rightIcon === "string" && rightIcon.length > 2 ? (
          <Ionicons name={rightIcon} size={26} color={rightIconColor} />
        ) : (
          <Text style={[styles.rightIcon, { color: textColor }]}>
            {rightIcon}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomColor: "#f3f4f6",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 24,
    fontWeight: "600",
  },
  title: {
    flex: 2,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
  },
  rightBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  rightIcon: {
    fontSize: 20,
  },
});
