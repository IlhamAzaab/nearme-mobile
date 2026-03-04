import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * ManagerSectionTabs – horizontal scrollable tab bar for manager sub-section screens.
 *
 * Props:
 *  tabs         {Array}  Array of { route, label } objects
 *  activeRoute  {string} Current route name (use useRoute().name)
 *  navigation   {object} Navigation object for replace()
 */
const ManagerSectionTabs = ({ tabs = [], activeRoute, navigation }) => {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces={false}
      >
        {tabs.map((tab) => {
          const isActive = activeRoute === tab.route;
          return (
            <TouchableOpacity
              key={tab.route}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => {
                if (!isActive) navigation.replace(tab.route);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  scroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  tabActive: {
    backgroundColor: "#059669",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#fff",
  },
});

export default ManagerSectionTabs;
