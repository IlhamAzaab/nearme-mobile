import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * ManagerReportsScreen - Hub for all report types
 */
const ManagerReportsScreen = ({ navigation }) => {
  const reportSections = [
    {
      title: 'Financial',
      items: [
        { label: 'Financial Reports', icon: '💰', screen: 'FinancialReports' },
        { label: 'Sales Reports', icon: '📊', screen: 'SalesReports' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Delivery Reports', icon: '🚚', screen: 'DeliveryReports' },
        { label: 'Restaurant Reports', icon: '🍽️', screen: 'RestaurantReports' },
        { label: 'Customer Reports', icon: '👥', screen: 'CustomerReports' },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { label: 'Time Analytics', icon: '⏱️', screen: 'TimeAnalytics' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>Insights and analytics for your platform</Text>

        {reportSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={styles.card}
                onPress={() => navigation.navigate(item.screen)}
              >
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 8 },
  cardIcon: { fontSize: 24, marginRight: 14 },
  cardLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  chevron: { fontSize: 22, color: '#D1D5DB' },
});

export default ManagerReportsScreen;
