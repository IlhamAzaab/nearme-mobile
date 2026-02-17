import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * OrderStatusLayout - Displays order status with progress steps
 * @param {Object} props - { currentStatus, steps, children }
 */
const OrderStatusLayout = ({ currentStatus, steps = [], children }) => {
  const defaultSteps = steps.length > 0 ? steps : [
    { key: 'placed', label: 'Order Placed', icon: '📝' },
    { key: 'confirmed', label: 'Confirmed', icon: '✅' },
    { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
    { key: 'picked_up', label: 'Picked Up', icon: '📦' },
    { key: 'on_the_way', label: 'On the Way', icon: '🛵' },
    { key: 'delivered', label: 'Delivered', icon: '🎉' },
  ];

  const currentIndex = defaultSteps.findIndex((s) => s.key === currentStatus);

  return (
    <View style={styles.container}>
      <View style={styles.stepsContainer}>
        {defaultSteps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={styles.stepIndicator}>
                <View
                  style={[
                    styles.dot,
                    isCompleted && styles.dotCompleted,
                    isCurrent && styles.dotCurrent,
                  ]}
                >
                  <Text style={styles.stepIcon}>
                    {isCompleted ? '✓' : step.icon}
                  </Text>
                </View>
                {index < defaultSteps.length - 1 && (
                  <View
                    style={[styles.line, isCompleted && styles.lineCompleted]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isCompleted && styles.labelCompleted,
                  isCurrent && styles.labelCurrent,
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  stepsContainer: { marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepIndicator: { alignItems: 'center', marginRight: 12 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCompleted: { backgroundColor: '#10B981' },
  dotCurrent: { backgroundColor: '#FF6B35', borderWidth: 3, borderColor: '#FF6B3540' },
  stepIcon: { fontSize: 14 },
  line: { width: 2, height: 24, backgroundColor: '#E5E7EB', marginVertical: 2 },
  lineCompleted: { backgroundColor: '#10B981' },
  stepLabel: { fontSize: 14, color: '#9CA3AF', paddingTop: 6, flex: 1 },
  labelCompleted: { color: '#10B981', fontWeight: '500' },
  labelCurrent: { color: '#FF6B35', fontWeight: '700' },
});

export default OrderStatusLayout;
