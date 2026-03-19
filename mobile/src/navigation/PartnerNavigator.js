// mobile/src/navigation/PartnerNavigator.js
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { useTheme }                 from '../context/ThemeContext';

import PartnerDashboardScreen  from '../screens/Partner/PartnerDashboardScreen';
import PartnerEarningsScreen   from '../screens/Partner/PartnerEarningsScreen';
import PartnerHistoryScreen    from '../screens/Partner/PartnerHistoryScreen';
import IncomingDeliveryScreen  from '../screens/Partner/IncomingDeliveryScreen';
import ActiveDeliveryScreen    from '../screens/Partner/ActiveDeliveryScreen';
import CourierFloorPriceScreen from '../screens/Partner/CourierFloorPriceScreen';
import WalletTopUpScreen       from '../screens/Shared/WalletTopUpScreen';
import WithdrawalScreen        from '../screens/Shared/WithdrawalScreen';
import ProfileScreen           from '../screens/Shared/ProfileScreen';
import EditProfileScreen       from '../screens/Shared/EditProfileScreen';
import NotificationsScreen     from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen    from '../screens/Shared/ChangePasswordScreen';
import SupportScreen           from '../screens/Shared/SupportScreen';

const COURIER_ACCENT = '#34D399';
const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard"        component={PartnerDashboardScreen}  />
    <Stack.Screen name="IncomingDelivery" component={IncomingDeliveryScreen}  />
    <Stack.Screen name="ActiveDelivery"   component={ActiveDeliveryScreen}    />
    <Stack.Screen name="FloorPrice"       component={CourierFloorPriceScreen} />
    <Stack.Screen name="Notifications"    component={NotificationsScreen}     />
    <Stack.Screen name="Support"          component={SupportScreen}           />
  </Stack.Navigator>
);

const EarningsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="EarningsHome"   component={PartnerEarningsScreen}  />
    <Stack.Screen name="PartnerHistory" component={PartnerHistoryScreen}   />
    <Stack.Screen name="WalletTopUp"    component={WalletTopUpScreen}      />
    <Stack.Screen name="Withdrawal"     component={WithdrawalScreen}       />
    <Stack.Screen name="Support"        component={SupportScreen}          />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}           />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}       />
    <Stack.Screen name="Notifications"  component={NotificationsScreen}     />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen}    />
    <Stack.Screen name="FloorPrice"     component={CourierFloorPriceScreen} />
    <Stack.Screen name="Support"        component={SupportScreen}           />
  </Stack.Navigator>
);

const PartnerNavigator = () => {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            DashboardTab: focused ? 'cube'   : 'cube-outline',
            EarningsTab:  focused ? 'wallet' : 'wallet-outline',
            ProfileTab:   focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   COURIER_ACCENT,
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
      <Tab.Screen name="DashboardTab" component={DashboardStack} options={{ title: 'Deliveries' }} />
      <Tab.Screen name="EarningsTab"  component={EarningsStack}  options={{ title: 'Earnings'   }} />
      <Tab.Screen name="ProfileTab"   component={ProfileStack}   options={{ title: 'Profile'    }} />
    </Tab.Navigator>
  );
};

export default PartnerNavigator;