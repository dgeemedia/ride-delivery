// mobile/src/navigation/DriverNavigator.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { useSafeAreaInsets }        from 'react-native-safe-area-context';
import { useTheme }                 from '../context/ThemeContext';

import DriverDashboardScreen from '../screens/Driver/DriverDashboardScreen';
import IncomingRideScreen    from '../screens/Driver/IncomingRideScreen';
import ActiveRideScreen      from '../screens/Driver/ActiveRideScreen';
import EarningsScreen        from '../screens/Driver/EarningsScreen';
import FloorPriceScreen      from '../screens/Driver/FloorPriceScreen';      // ← NEW
import ProfileScreen         from '../screens/Shared/ProfileScreen';
import EditProfileScreen     from '../screens/Shared/EditProfileScreen';
import NotificationsScreen   from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen  from '../screens/Shared/ChangePasswordScreen';
import SupportScreen         from '../screens/Shared/SupportScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();
const DA    = '#FFB800';

// ── Dashboard stack ────────────────────────────────────────────────────────
const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard"  component={DriverDashboardScreen} />

    {/* IncomingRide as transparent modal — driver sees the dashboard behind it */}
    <Stack.Screen
      name="IncomingRide"
      component={IncomingRideScreen}
      options={{
        presentation:       'transparentModal',
        cardOverlayEnabled: true,
        animationEnabled:   false,
        gestureEnabled:     false,
      }}
    />

    <Stack.Screen name="ActiveRide"      component={ActiveRideScreen}   />
    <Stack.Screen name="FloorPrice"      component={FloorPriceScreen}   />
    <Stack.Screen name="Notifications"   component={NotificationsScreen} />
    <Stack.Screen name="Support"         component={SupportScreen}       />
    <Stack.Screen name="DriverDocuments" component={PlaceholderScreen}  />
    <Stack.Screen name="DriverHistory"   component={PlaceholderScreen}  />
  </Stack.Navigator>
);

// ── Profile stack ──────────────────────────────────────────────────────────
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}       />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}   />
    <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen}/>
    <Stack.Screen name="Support"        component={SupportScreen}       />
    <Stack.Screen name="DriverEarnings" component={EarningsScreen}      />
    <Stack.Screen name="AppFeedback"    component={PlaceholderScreen}   />
    <Stack.Screen name="Terms"          component={PlaceholderScreen}   />
  </Stack.Navigator>
);

// ── Tab navigator ──────────────────────────────────────────────────────────
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

// ── Placeholder ────────────────────────────────────────────────────────────
function PlaceholderScreen({ navigation, route }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  return (
    <View style={[ph.root, { backgroundColor: theme.background, paddingTop: insets.top + 14 }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[ph.back, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>
      <View style={ph.center}>
        <Ionicons name="construct-outline" size={40} color={theme.hint} />
        <Text style={[ph.title, { color: theme.foreground }]}>{route.name}</Text>
        <Text style={[ph.sub, { color: theme.hint }]}>Coming soon</Text>
      </View>
    </View>
  );
}
const ph = StyleSheet.create({
  root:   { flex: 1 },
  back:   { marginHorizontal: 20, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 80 },
  title:  { fontSize: 18, fontWeight: '800' },
  sub:    { fontSize: 13 },
});