// mobile/src/navigation/CustomerNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { useTheme }                 from '../context/ThemeContext';

// ── Tab screens ───────────────────────────────────────────────────────────────
import HomeScreen           from '../screens/Customer/HomeScreen';
import RequestRideScreen    from '../screens/Customer/RequestRideScreen';
import HistoryScreen        from '../screens/Customer/HistoryScreen';

// ── Profile & account screens ─────────────────────────────────────────────────
import ProfileScreen        from '../screens/Shared/ProfileScreen';
import EditProfileScreen    from '../screens/Shared/EditProfileScreen';
import WalletScreen         from '../screens/Customer/WalletScreen';
import NotificationsScreen  from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen from '../screens/Shared/ChangePasswordScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Home stack ────────────────────────────────────────────────────────────────
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home"        component={HomeScreen} />
    <Stack.Screen name="RequestRide" component={RequestRideScreen} />
    {/* Notifications accessible from home header bell icon too */}
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

// ── Profile stack ─────────────────────────────────────────────────────────────
// Every screen reachable from ProfileScreen must live in this stack.
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"     component={ProfileScreen} />
    <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
    <Stack.Screen name="Wallet"          component={WalletScreen} />
    <Stack.Screen name="Notifications"   component={NotificationsScreen} />
    <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
  </Stack.Navigator>
);

// ── Tab navigator ─────────────────────────────────────────────────────────────
const CustomerNavigator = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            HomeTab:    focused ? 'home'              : 'home-outline',
            History:    focused ? 'time'              : 'time-outline',
            ProfileTab: focused ? 'person'            : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   theme.accent,
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
      <Tab.Screen name="HomeTab"    component={HomeStack}    options={{ title: 'Home'    }} />
      <Tab.Screen name="History"    component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

// Platform needed for tab bar height
import { Platform } from 'react-native';

export default CustomerNavigator;