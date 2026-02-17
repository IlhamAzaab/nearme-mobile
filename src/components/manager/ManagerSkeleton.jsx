import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton, { SkeletonCard, SkeletonList } from '../common/Skeleton';

/**
 * ManagerSkeleton - Loading skeleton specific to manager dashboard layout
 */
const ManagerSkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <Skeleton width={200} height={24} />
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.statCard}>
            <Skeleton width={40} height={40} borderRadius={8} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={14} style={{ marginBottom: 4 }} />
            <Skeleton width="50%" height={20} />
          </View>
        ))}
      </View>

      {/* Chart placeholder */}
      <View style={styles.chartCard}>
        <Skeleton width="60%" height={18} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={180} borderRadius={12} />
      </View>

      {/* List items */}
      <SkeletonList count={3} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
});

export default ManagerSkeleton;
