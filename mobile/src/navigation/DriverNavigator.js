import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme';

import DriverDashboardScreen from '../screens/Driver/DriverDashboardScreen';
import IncomingRideScreen from '../screens/Driver/IncomingRideScreen';
import ActiveRideScreen from '../screens/Driver/ActiveRideScreen';
import EarningsScreen from '../screens/Driver/EarningsScreen';
import ProfileScreen from '../screens/Shared/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const DashboardStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Dashboard" component={DriverDashboardScreen} options={{ headerShown: false }} />
    <Stack.Screen name="IncomingRide" component={IncomingRideScreen} />
    <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
  </Stack.Navigator>
);

const DriverNavigator = () => {
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
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default DriverNavigator;