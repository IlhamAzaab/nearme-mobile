import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useCustomerNotifications from '../../hooks/useCustomerNotifications';
import { formatRelativeTime } from '../../utils/etaFormatter';

/**
 * CustomerNotificationsScreen - Dedicated notifications list for customer
 */
const CustomerNotificationsScreen = ({ navigation }) => {
  const { notifications, loading, markAsRead } = useCustomerNotifications();

  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', delivery: '🛵', promotion: '🎁' };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, !item.read && styles.unread]}
      onPress={() => {
        markAsRead(item.id);
        // Navigate based on notification type
        if (item.data?.orderId) {
          navigation.navigate('TrackOrder', { orderId: item.data.orderId });
        }
      }}
    >
      <Text style={styles.icon}>{icons[item.type] || icons.info}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.time}>{formatRelativeTime(item.timestamp || item.created_at)}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 16 },
  item: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  unread: { backgroundColor: '#FFF7ED', borderColor: '#FFD9BD' },
  icon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  textContainer: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  message: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  time: { fontSize: 11, color: '#9CA3AF' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35', marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});

export default CustomerNotificationsScreen;
