import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerDrawer from "../../components/manager/ManagerDrawer";
import ManagerHeader from "../../components/manager/ManagerHeader";

const REPORT_DRAWER_ITEMS = [
  {
    route: "SendNotification",
    label: "Send Notification",
    icon: "megaphone-outline",
  },
  { route: "SalesReports", label: "Sales", icon: "trending-up-outline" },
  { route: "DeliveryReports", label: "Delivery", icon: "car-outline" },
  {
    route: "RestaurantReports",
    label: "Restaurants",
    icon: "restaurant-outline",
  },
  { route: "FinancialReports", label: "Financial", icon: "calculator-outline" },
  { route: "CustomerReports", label: "Customers", icon: "people-outline" },
  { route: "TimeAnalytics", label: "Time Analytics", icon: "time-outline" },
];

const ManagerReportsScreen = ({ navigation }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activePages = [
    {
      icon: "options-outline",
      title: "Operations Config",
      desc: "Configure driver earnings, fees, thresholds, and working hours",
      iconBg: "#B8F0D0",
      iconColor: "#06C168",
      screen: "OperationsConfig",
    },
    {
      icon: "megaphone-outline",
      title: "Send Notification",
      desc: "Broadcast announcements to customers, admins, and drivers",
      iconBg: "#E2E8F0",
      iconColor: "#111816",
      screen: "SendNotification",
    },
    {
      icon: "bicycle-outline",
      title: "Pending Deliveries",
      desc: "View deliveries waiting for a driver to accept",
      iconBg: "#FEE2E2",
      iconColor: "#DC2626",
      screen: "Deliveries", // tab name
      isTab: true,
    },
  ];

  const reportCards = [
    {
      icon: "trending-up-outline",
      title: "Sales Reports",
      desc: "Track daily, weekly, and monthly sales performance",
      iconBg: "#DBEAFE",
      iconColor: "#2563EB",
      screen: "SalesReports",
    },
    {
      icon: "car-outline",
      title: "Delivery Reports",
      desc: "Monitor delivery metrics and driver performance",
      iconBg: "#EDE9FE",
      iconColor: "#7C3AED",
      screen: "DeliveryReports",
    },
    {
      icon: "restaurant-outline",
      title: "Restaurant Reports",
      desc: "Analyze restaurant performance and commission reports",
      iconBg: "#FEF3C7",
      iconColor: "#D97706",
      screen: "RestaurantReports",
    },
    {
      icon: "card-outline",
      title: "Financial Reports",
      desc: "View payment summaries and commission breakdowns",
      iconBg: "#B8F0D0",
      iconColor: "#06C168",
      screen: "FinancialReports",
    },
    {
      icon: "people-outline",
      title: "Customer Management",
      desc: "Manage customer accounts, suspension, and order-based views",
      iconBg: "#FEE2E2",
      iconColor: "#DC2626",
      screen: "CustomerReports",
    },
    {
      icon: "time-outline",
      title: "Time-based Analytics",
      desc: "Peak hours analysis and scheduling insights",
      iconBg: "#E0E7FF",
      iconColor: "#4F46E5",
      screen: "TimeAnalytics",
    },
  ];

  const handleNavigate = (item) => {
    if (item.isTab) {
      navigation.navigate("PendingDeliveries");
    } else {
      navigation.navigate(item.screen);
    }
  };

  const renderCard = (item, index) => (
    <TouchableOpacity
      key={index}
      style={styles.card}
      onPress={() => handleNavigate(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: item.iconBg }]}>
          <Ionicons name={item.icon} size={20} color={item.iconColor} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
      </View>
      <Text style={styles.cardDesc}>{item.desc}</Text>
      <View style={styles.cardOpenRow}>
        <Ionicons name="arrow-forward" size={14} color="#13ECB9" />
        <Text style={styles.cardOpenText}>OPEN</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader title="Reports" onMenuPress={() => setDrawerOpen(true)} />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Reports"
        items={REPORT_DRAWER_ITEMS}
        activeRoute="Reports"
        navigation={navigation}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="bar-chart-outline" size={32} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Reports & Analytics</Text>
          <Text style={styles.heroSubtitle}>
            Explore detailed analytics to understand and improve your platform
          </Text>
        </View>

        {/* Active Pages */}
        <Text style={styles.sectionLabel}>Active Pages</Text>
        <View style={styles.grid}>
          {activePages.map((item, i) => renderCard(item, i))}
        </View>

        {/* Report Pages */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>
          Report Pages
        </Text>
        <View style={styles.grid}>
          {reportCards.map((item, i) => renderCard(item, i))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { padding: 16 },

  // Hero
  hero: {
    backgroundColor: "#06C168",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(17,24,22,0.7)",
    textAlign: "center",
  },

  // Section
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Grid
  grid: { gap: 10, marginBottom: 12 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#111816", flex: 1 },
  cardDesc: {
    fontSize: 12,
    color: "#618980",
    lineHeight: 17,
    marginBottom: 10,
  },
  cardOpenRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardOpenText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#13ECB9",
    letterSpacing: 1,
  },
});

export default ManagerReportsScreen;
