import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../app/providers/AuthProvider';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        </View>
        
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem}>
            <Text>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text>Saved Addresses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text>Payment Methods</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text>Settings</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 95,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 20,
  },
  menuItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
