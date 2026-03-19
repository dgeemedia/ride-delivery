// mobile/src/navigation/PartnerNavigator.js
import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Ionicons} from '@expo/vector-icons';
import {colors} from '../theme/colors';

import PartnerDashboardScreen from '../screens/Partner/PartnerDashboardScreen';
import ProfileScreen from '../screens/Shared/ProfileScreen';

const Tab = createBottomTabNavigator();

const PartnerNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({color, size}) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = 'cube';
          else if (route.name === 'Profile') iconName = 'person';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.secondary,
      })}>
      <Tab.Screen name="Dashboard" component={PartnerDashboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default PartnerNavigator;