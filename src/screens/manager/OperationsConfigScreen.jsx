import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

/**
 * OperationsConfigScreen - Platform configuration settings
 */
const OperationsConfigScreen = ({ navigation }) => {
  const [config, setConfig] = useState({
    deliveryRadius: 10,
    maxDeliveriesPerDriver: 3,
    commissionRate: 15,
    minOrderAmount: 50,
    autoAssignDrivers: true,
    allowScheduledOrders: false,
    maintenanceMode: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/manager/config');
      if (response.data) setConfig({ ...config, ...response.data });
    } catch (error) {
      console.warn('Failed to fetch config:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key, value) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    try {
      await api.put('/manager/config', { [key]: value });
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
      setConfig(config); // revert
    }
  };

  const ConfigToggle = ({ label, configKey, description }) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDesc}>{description}</Text>}
      </View>
      <Switch
        value={config[configKey]}
        onValueChange={(val) => updateConfig(configKey, val)}
        trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
        thumbColor={config[configKey] ? '#059669' : '#9CA3AF'}
      />
    </View>
  );

  const ConfigValue = ({ label, value, unit }) => (
    <View style={styles.valueRow}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={styles.valueText}>{value} {unit}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Operations Config</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Settings</Text>
          <ConfigValue label="Delivery Radius" value={config.deliveryRadius} unit="km" />
          <ConfigValue label="Max Deliveries/Driver" value={config.maxDeliveriesPerDriver} unit="" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial</Text>
          <ConfigValue label="Commission Rate" value={config.commissionRate} unit="%" />
          <ConfigValue label="Min Order Amount" value={config.minOrderAmount} unit="ETB" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <ConfigToggle label="Auto-Assign Drivers" configKey="autoAssignDrivers" description="Automatically assign nearest driver" />
          <ConfigToggle label="Scheduled Orders" configKey="allowScheduledOrders" description="Allow customers to schedule orders" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System</Text>
          <ConfigToggle label="Maintenance Mode" configKey="maintenanceMode" description="Disable ordering temporarily" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  toggleDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  valueLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  valueText: { fontSize: 15, fontWeight: '700', color: '#3B82F6' },
});

export default OperationsConfigScreen;
