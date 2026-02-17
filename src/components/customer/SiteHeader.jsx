import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * SiteHeader - Customer app top header bar
 */
const SiteHeader = ({ title = 'NearMe', showBack = false, showNotifications = true, rightAction }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {showBack ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🍔</Text>
        </View>
      )}

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.rightContainer}>
        {rightAction || null}
        {showNotifications && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconText}>🔔</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4, marginRight: 8 },
  backText: { fontSize: 24, color: '#333' },
  logoContainer: { marginRight: 8 },
  logo: { fontSize: 24 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  rightContainer: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4, marginLeft: 8 },
  iconText: { fontSize: 20 },
});

export default SiteHeader;
