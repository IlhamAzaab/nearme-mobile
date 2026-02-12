import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ManagerDashboardScreen from '../screens/manager/ManagerDashboardScreen';
import ActiveDeliveryScreen from '../screens/manager/ActiveDeliveryScreen';

const Stack = createNativeStackNavigator();

export default function ManagerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
      <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} />
    </Stack.Navigator>
  );
}
