import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../../app/providers/NotificationProvider';

/**
 * SiteHeader - Customer app top header bar
 */
const SiteHeader = ({ title = 'NearMe', showBack = false, showNotifications = true, rightAction }) => {
  const navigation = useNavigation();
  const { unreadCount } = useNotifications();

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
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
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
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});

export default SiteHeader;
