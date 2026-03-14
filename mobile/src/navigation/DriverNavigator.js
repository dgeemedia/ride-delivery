// mobile/src/navigation/DriverNavigator.js
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { useTheme }                 from '../context/ThemeContext';

// ── Driver screens ────────────────────────────────────────────────────────────
import DriverDashboardScreen from '../screens/Driver/DriverDashboardScreen';
import EarningsScreen        from '../screens/Driver/EarningsScreen';
import ActiveRideScreen      from '../screens/Driver/ActiveRideScreen';

// ── Shared screens ────────────────────────────────────────────────────────────
import ProfileScreen         from '../screens/Shared/ProfileScreen';
import EditProfileScreen     from '../screens/Shared/EditProfileScreen';
import NotificationsScreen   from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen  from '../screens/Shared/ChangePasswordScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// Driver role accent color — amber, matches DriverDashboardScreen
const DA = '#FFB800';

// ── Dashboard stack (includes ActiveRide so it covers full screen) ────────────
const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard"     component={DriverDashboardScreen} />
    <Stack.Screen name="ActiveRide"    component={ActiveRideScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    {/* Placeholder screens — build these when needed */}
    {/* <Stack.Screen name="DriverDocuments" component={DriverDocumentsScreen} /> */}
    {/* <Stack.Screen name="DriverHistory"   component={DriverHistoryScreen} /> */}
  </Stack.Navigator>
);

// ── Profile stack ─────────────────────────────────────────────────────────────
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen} />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen} />
    <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    {/* DriverEarnings reachable from ProfileScreen's "Earnings & Payouts" menu item */}
    <Stack.Screen name="DriverEarnings" component={EarningsScreen} />
  </Stack.Navigator>
);

// ── Tab navigator ─────────────────────────────────────────────────────────────
const DriverNavigator = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => {
          const color = focused ? DA : theme.hint;
          const icons = {
            DashboardTab: focused ? 'car'    : 'car-outline',
            Earnings:     focused ? 'cash'   : 'cash-outline',
            ProfileTab:   focused ? 'person' : 'person-outline',
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStack} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Earnings"     component={EarningsScreen}  options={{ title: 'Earnings'  }} />
      <Tab.Screen name="ProfileTab"   component={ProfileStack}    options={{ title: 'Profile'   }} />
    </Tab.Navigator>
  );
};

export default DriverNavigator;