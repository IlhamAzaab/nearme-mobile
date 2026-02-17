import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * ManagerHeader - Header bar for manager screens
 */
const ManagerHeader = ({
  title = 'Manager',
  showBack = false,
  showNotifications = true,
  unreadCount = 0,
  rightAction,
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {showBack ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>📊</Text>
        </View>
      )}

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.rightContainer}>
        {rightAction || null}
        {showNotifications && (
          <TouchableOpacity
            onPress={() => navigation.navigate('ManagerNotifications')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
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
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: { padding: 4, marginRight: 8 },
  backText: { fontSize: 24, color: '#fff' },
  logoContainer: { marginRight: 8 },
  logo: { fontSize: 24 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  rightContainer: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4, marginLeft: 8, position: 'relative' },
  iconText: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

export default ManagerHeader;
