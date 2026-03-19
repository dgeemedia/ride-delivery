// mobile/src/navigation/CustomerNavigator.js
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { useTheme }                 from '../context/ThemeContext';

import HomeScreen             from '../screens/Customer/HomeScreen';
import RequestRideScreen      from '../screens/Customer/RequestRideScreen';
import RequestDeliveryScreen  from '../screens/Customer/RequestDeliveryScreen';
import NearbyDriversScreen    from '../screens/Customer/NearbyDriversScreen';
import RideTrackingScreen     from '../screens/Customer/RideTrackingScreen';
import DeliveryTrackingScreen from '../screens/Customer/DeliveryTrackingScreen';
import HistoryScreen          from '../screens/Customer/HistoryScreen';
import WalletScreen           from '../screens/Customer/WalletScreen';
import ProfileScreen          from '../screens/Shared/ProfileScreen';
import EditProfileScreen      from '../screens/Shared/EditProfileScreen';
import NotificationsScreen    from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen   from '../screens/Shared/ChangePasswordScreen';
import SupportScreen          from '../screens/Shared/SupportScreen';

const DA  = '#FFB800';
const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home"              component={HomeScreen}             />
    <Stack.Screen name="RequestRide"       component={RequestRideScreen}      />
    <Stack.Screen name="RequestDelivery"   component={RequestDeliveryScreen}  />
    <Stack.Screen name="NearbyDrivers"     component={NearbyDriversScreen}    />
    <Stack.Screen name="RideTracking"      component={RideTrackingScreen}     />
    <Stack.Screen name="DeliveryTracking"  component={DeliveryTrackingScreen} />
    <Stack.Screen name="Notifications"     component={NotificationsScreen}    />
    <Stack.Screen name="Support"           component={SupportScreen}          />
  </Stack.Navigator>
);

const HistoryStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HistoryHome"  component={HistoryScreen}       />
    <Stack.Screen name="Support"      component={SupportScreen}       />
  </Stack.Navigator>
);

const WalletStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WalletHome" component={WalletScreen}  />
    <Stack.Screen name="Support"    component={SupportScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}       />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}   />
    <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen}/>
    <Stack.Screen name="Support"        component={SupportScreen}       />
  </Stack.Navigator>
);

const CustomerNavigator = () => {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            HomeTab:    focused ? 'home'    : 'home-outline',
            HistoryTab: focused ? 'time'    : 'time-outline',
            WalletTab:  focused ? 'wallet'  : 'wallet-outline',
            ProfileTab: focused ? 'person'  : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   DA,
        tabBarInactiveTintColor: theme.hint,
        tabBarStyle: {
          backgroundColor: theme.backgroundAlt,
          borderTopColor:  theme.border,
          borderTopWidth:  1,
          height:          Platform.OS === 'ios' ? 82 : 62,
          paddingBottom:   Platform.OS === 'ios' ? 24 : 8,
          paddingTop:      8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      })}
    >
      <Tab.Screen name="HomeTab"    component={HomeStack}    options={{ title: 'Home'    }} />
      <Tab.Screen name="HistoryTab" component={HistoryStack} options={{ title: 'History' }} />
      <Tab.Screen name="WalletTab"  component={WalletStack}  options={{ title: 'Wallet'  }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

export default CustomerNavigator;