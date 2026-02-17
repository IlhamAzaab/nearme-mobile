import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../app/providers/AuthProvider';

/**
 * CustomerProfileScreen - Customer profile management screen
 */
const CustomerProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { icon: '📋', label: 'My Orders', screen: 'Orders' },
    { icon: '📍', label: 'Saved Addresses', screen: null },
    { icon: '💳', label: 'Payment Methods', screen: null },
    { icon: '🔔', label: 'Notification Settings', screen: null },
    { icon: '🌙', label: 'App Settings', screen: null },
    { icon: '❓', label: 'Help & Support', screen: null },
    { icon: '📜', label: 'Terms of Service', screen: null },
  ];

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || '👤'}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name || 'Customer'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => item.screen && navigation.navigate(item.screen)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  profileHeader: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  menu: { marginBottom: 32 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 15, color: '#374151' },
  menuArrow: { fontSize: 20, color: '#9CA3AF' },
  logoutBtn: { padding: 16, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center' },
  logoutText: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
});

export default CustomerProfileScreen;
