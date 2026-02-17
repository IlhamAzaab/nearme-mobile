import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * DriverPendingScreen - Shown while driver application is pending approval
 */
const DriverPendingScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Application Pending</Text>
        <Text style={styles.subtitle}>
          Your driver application is being reviewed. We'll notify you once it's approved.
        </Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoStep}>1. Our team reviews your documents</Text>
          <Text style={styles.infoStep}>2. Background verification check</Text>
          <Text style={styles.infoStep}>3. Approval notification via app & email</Text>
          <Text style={styles.infoStep}>4. Start accepting deliveries! 🎉</Text>
        </View>
        <Text style={styles.timeNote}>This usually takes 1-3 business days</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  infoCard: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 20, width: '100%', marginBottom: 20 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#9A3412', marginBottom: 12 },
  infoStep: { fontSize: 14, color: '#92400E', marginBottom: 6, paddingLeft: 4 },
  timeNote: { fontSize: 13, color: '#9CA3AF' },
});

export default DriverPendingScreen;
