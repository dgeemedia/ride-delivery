import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme';

// Screens
import HomeScreen from '../screens/Customer/HomeScreen';
import ServiceSelectionScreen from '../screens/Customer/ServiceSelectionScreen';
import RequestRideScreen from '../screens/Customer/RequestRideScreen';
import RequestDeliveryScreen from '../screens/Customer/RequestDeliveryScreen';
import TrackingScreen from '../screens/Customer/TrackingScreen';
import HistoryScreen from '../screens/Customer/HistoryScreen';
import ProfileScreen from '../screens/Shared/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ServiceSelection" component={ServiceSelectionScreen} />
    <Stack.Screen name="RequestRide" component={RequestRideScreen} />
    <Stack.Screen name="RequestDelivery" component={RequestDeliveryScreen} />
    <Stack.Screen name="Tracking" component={TrackingScreen} />
  </Stack.Navigator>
);

const CustomerNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') iconName = 'home';
          else if (route.name === 'History') iconName = 'history';
          else if (route.name === 'Profile') iconName = 'person';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home', headerShown: false }} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default CustomerNavigator;