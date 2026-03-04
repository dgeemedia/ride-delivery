import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme';

import PartnerDashboardScreen from '../screens/Partner/PartnerDashboardScreen';
import IncomingDeliveryScreen from '../screens/Partner/IncomingDeliveryScreen';
import ActiveDeliveryScreen from '../screens/Partner/ActiveDeliveryScreen';
import ProofOfDeliveryScreen from '../screens/Partner/ProofOfDeliveryScreen';
import ProfileScreen from '../screens/Shared/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const DashboardStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Dashboard" component={PartnerDashboardScreen} options={{ headerShown: false }} />
    <Stack.Screen name="IncomingDelivery" component={IncomingDeliveryScreen} />
    <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} />
    <Stack.Screen name="ProofOfDelivery" component={ProofOfDeliveryScreen} />
  </Stack.Navigator>
);

const PartnerNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'DashboardTab') iconName = 'dashboard';
          else if (route.name === 'Earnings') iconName = 'attach-money';
          else if (route.name === 'Profile') iconName = 'person';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStack} options={{ title: 'Dashboard', headerShown: false }} />
      <Tab.Screen name="Earnings" component={ProfileScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default PartnerNavigator;