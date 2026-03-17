// mobile/src/navigation/CustomerNavigator.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { useSafeAreaInsets }        from 'react-native-safe-area-context';
import { useTheme }                 from '../context/ThemeContext';

import HomeScreen            from '../screens/Customer/HomeScreen';
import RequestRideScreen     from '../screens/Customer/RequestRideScreen';
import RequestDeliveryScreen from '../screens/Customer/RequestDeliveryScreen';
import RideTrackingScreen    from '../screens/Customer/RideTrackingScreen'; // ← real screen
import HistoryScreen         from '../screens/Customer/HistoryScreen';
import ProfileScreen         from '../screens/Shared/ProfileScreen';
import EditProfileScreen     from '../screens/Shared/EditProfileScreen';
import WalletScreen          from '../screens/Customer/WalletScreen';
import NotificationsScreen   from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen  from '../screens/Shared/ChangePasswordScreen';
import SupportScreen         from '../screens/Shared/SupportScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home"            component={HomeScreen} />
    <Stack.Screen name="RequestRide"     component={RequestRideScreen} />
    <Stack.Screen name="RequestDelivery" component={RequestDeliveryScreen} />
    <Stack.Screen name="Notifications"   component={NotificationsScreen} />
    <Stack.Screen name="Support"         component={SupportScreen} />
    {/* Real tracking screen — driver pin moves live via socket */}
    <Stack.Screen name="RideTracking"    component={RideTrackingScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen} />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen} />
    <Stack.Screen name="Wallet"         component={WalletScreen} />
    <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="Support"        component={SupportScreen} />
    <Stack.Screen name="AppFeedback"    component={PlaceholderScreen} />
    <Stack.Screen name="Terms"          component={PlaceholderScreen} />
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
            HomeTab:    focused ? 'home'   : 'home-outline',
            History:    focused ? 'time'   : 'time-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
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
      <Tab.Screen name="HomeTab"    component={HomeStack}     options={{ title: 'Home'    }} />
      <Tab.Screen name="History"    component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack}  options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

export default CustomerNavigator;

function PlaceholderScreen({ navigation, route }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  return (
    <View style={[ph.root, { backgroundColor: theme.background, paddingTop: insets.top + 14 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={[ph.back, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 32, marginBottom: 60 },
  title:  { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub:    { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});