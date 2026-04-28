// mobile/src/navigation/DriverNavigator.js
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { useSafeAreaInsets }        from 'react-native-safe-area-context';
import { useTheme }                 from '../context/ThemeContext';

import DriverDashboardScreen from '../screens/Driver/DriverDashboardScreen';
import IncomingRideScreen    from '../screens/Driver/IncomingRideScreen';
import ActiveRideScreen      from '../screens/Driver/ActiveRideScreen';
import FloorPriceScreen      from '../screens/Driver/FloorPriceScreen';
import DriverHistoryScreen   from '../screens/Driver/DriverHistoryScreen';
import EarningsScreen        from '../screens/Driver/EarningsScreen';
import WalletTopUpScreen     from '../screens/Shared/WalletTopUpScreen';
import WithdrawalScreen      from '../screens/Shared/WithdrawalScreen';
import ProfileScreen         from '../screens/Shared/ProfileScreen';
import EditProfileScreen     from '../screens/Shared/EditProfileScreen';
import NotificationsScreen   from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen  from '../screens/Shared/ChangePasswordScreen';
import SupportScreen         from '../screens/Shared/SupportScreen';
import SubmitTicketScreen    from '../screens/Shared/SubmitTicketScreen';
import MyTicketsScreen       from '../screens/Shared/MyTicketsScreen';
import TicketDetailScreen    from '../screens/Shared/TicketDetailScreen';
import AppFeedbackScreen     from '../screens/Shared/AppFeedbackScreen';
import LegalScreen           from '../screens/Shared/LegalScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverDashboard"  component={DriverDashboardScreen} />
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
    <Stack.Screen name="ActiveRide"      component={ActiveRideScreen}      />
    <Stack.Screen name="FloorPrice"      component={FloorPriceScreen}      />
    <Stack.Screen name="Notifications"   component={NotificationsScreen}   />
    <Stack.Screen name="DriverDocuments" component={SupportScreen}         />
    <Stack.Screen name="Support"         component={SupportScreen}         />
    <Stack.Screen name="SubmitTicket"    component={SubmitTicketScreen}    />
    <Stack.Screen name="MyTickets"       component={MyTicketsScreen}       />
    <Stack.Screen name="TicketDetail"    component={TicketDetailScreen}    />
  </Stack.Navigator>
);

const EarningsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="EarningsHome"  component={EarningsScreen}        />
    <Stack.Screen name="DriverHistory" component={DriverHistoryScreen}   />
    <Stack.Screen name="WalletTopUp"   component={WalletTopUpScreen}     />
    <Stack.Screen name="Withdrawal"    component={WithdrawalScreen}      />
    <Stack.Screen name="Support"       component={SupportScreen}         />
    <Stack.Screen name="SubmitTicket"  component={SubmitTicketScreen}    />
    <Stack.Screen name="MyTickets"     component={MyTicketsScreen}       />
    <Stack.Screen name="TicketDetail"  component={TicketDetailScreen}    />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}         />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}     />
    <Stack.Screen name="Notifications"  component={NotificationsScreen}   />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen}  />
    <Stack.Screen name="FloorPrice"     component={FloorPriceScreen}      />
    <Stack.Screen name="AppFeedback"    component={AppFeedbackScreen}     />
    <Stack.Screen name="Support"        component={SupportScreen}         />
    <Stack.Screen name="SubmitTicket"   component={SubmitTicketScreen}    />
    <Stack.Screen name="MyTickets"      component={MyTicketsScreen}       />
    <Stack.Screen name="TicketDetail"   component={TicketDetailScreen}    />
    <Stack.Screen name="Legal"          component={LegalScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

// ── DriverNavigator ───────────────────────────────────────────────────────────
const DriverNavigator = () => {
  const { theme }  = useTheme();
  // ✅ FIX: read device bottom inset so the tab bar clears the Android
  //         gesture navigation bar and the iOS home indicator.
  const insets = useSafeAreaInsets();

  // Tab bar sits above the gesture bar.
  // Content height (icons + labels) = 54px; add the device's bottom inset on top.
  const TAB_CONTENT_H = 54;
  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const tabBarHeight = TAB_CONTENT_H + insets.bottom + EXTRA_BOTTOM;
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            DashboardTab: focused ? 'car-sport' : 'car-sport-outline',
            EarningsTab:  focused ? 'wallet'    : 'wallet-outline',
            ProfileTab:   focused ? 'person'    : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   theme.accent,
        tabBarInactiveTintColor: theme.hint,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor:  theme.border,
          borderTopWidth:  1,
          // ✅ FIX: dynamic height = content + safe area bottom inset
          height:          tabBarHeight,
          // ✅ FIX: paddingBottom pushes labels/icons above the gesture bar
          paddingBottom: EXTRA_BOTTOM + 4,
          paddingTop:      8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStack} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="EarningsTab"  component={EarningsStack}  options={{ title: 'Earnings'  }} />
      <Tab.Screen name="ProfileTab"   component={ProfileStack}   options={{ title: 'Profile'   }} />
    </Tab.Navigator>
  );
};

export default DriverNavigator;