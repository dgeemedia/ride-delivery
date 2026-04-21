// mobile/src/navigation/CustomerNavigator.js  [UPDATED]
// ── Premium Glass Tab Bar ─────────────────────────────────────────────────────

import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { BlurView }                 from 'expo-blur';
import { useSafeAreaInsets }        from 'react-native-safe-area-context';
import { useTheme }                 from '../context/ThemeContext';

import HomeScreen                from '../screens/Customer/HomeScreen';
import RequestRideScreen         from '../screens/Customer/RequestRideScreen';
import RequestDeliveryScreen     from '../screens/Customer/RequestDeliveryScreen';
import NearbyDriversScreen       from '../screens/Customer/NearbyDriversScreen';
import RideTrackingScreen        from '../screens/Customer/RideTrackingScreen';
import DeliveryTrackingScreen    from '../screens/Customer/DeliveryTrackingScreen';
import HistoryScreen             from '../screens/Customer/HistoryScreen';
import WalletScreen              from '../screens/Customer/WalletScreen';
import ShieldScreen              from '../screens/Customer/ShieldScreen';
import ShieldBeneficiariesScreen from '../screens/Customer/ShieldBeneficiariesScreen';
import CorporateScreen           from '../screens/Customer/CorporateScreen';
import DuoPayScreen              from '../screens/Customer/DuoPayScreen';
import RateRideScreen            from '../screens/Customer/RateRideScreen';
import RateDeliveryScreen        from '../screens/Customer/RateDeliveryScreen';
import ProfileScreen             from '../screens/Shared/ProfileScreen';
import EditProfileScreen         from '../screens/Shared/EditProfileScreen';
import NotificationsScreen       from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen      from '../screens/Shared/ChangePasswordScreen';
import SupportScreen             from '../screens/Shared/SupportScreen';
import SubmitTicketScreen        from '../screens/Shared/SubmitTicketScreen';
import MyTicketsScreen           from '../screens/Shared/MyTicketsScreen';
import TicketDetailScreen        from '../screens/Shared/TicketDetailScreen';

// ── NEW wallet-flow screens ──────────────────────────────────────────────────
import TransferScreen            from '../screens/Shared/TransferScreen';
import WalletTopUpScreen         from '../screens/Shared/WalletTopUpScreen';
import WithdrawalScreen          from '../screens/Shared/WithdrawalScreen';
// ─────────────────────────────────────────────────────────────────────────────

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Stack definitions ────────────────────────────────────────────────────────

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home"                component={HomeScreen}                />
    <Stack.Screen name="RequestRide"         component={RequestRideScreen}         />
    <Stack.Screen name="RequestDelivery"     component={RequestDeliveryScreen}     />
    <Stack.Screen name="NearbyDrivers"       component={NearbyDriversScreen}       />
    <Stack.Screen name="RideTracking"        component={RideTrackingScreen}        />
    <Stack.Screen name="DeliveryTracking"    component={DeliveryTrackingScreen}    />
    <Stack.Screen name="RateRide"     component={RateRideScreen}     options={{ presentation: 'modal' }} />
    <Stack.Screen name="RateDelivery" component={RateDeliveryScreen} options={{ presentation: 'modal' }} />
    <Stack.Screen name="Shield"              component={ShieldScreen}              />
    <Stack.Screen name="ShieldBeneficiaries" component={ShieldBeneficiariesScreen} />
    <Stack.Screen name="Corporate"           component={CorporateScreen}           />
    <Stack.Screen name="DuoPay"              component={DuoPayScreen}              />
    <Stack.Screen name="Notifications"       component={NotificationsScreen}       />
    <Stack.Screen name="Support"             component={SupportScreen}             />
    <Stack.Screen name="SubmitTicket"        component={SubmitTicketScreen}        />
    <Stack.Screen name="MyTickets"           component={MyTicketsScreen}           />
    <Stack.Screen name="TicketDetail"        component={TicketDetailScreen}        />
  </Stack.Navigator>
);

const HistoryStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HistoryHome"  component={HistoryScreen}      />
    <Stack.Screen name="RateRide"     component={RateRideScreen}     options={{ presentation: 'modal' }} />
    <Stack.Screen name="RateDelivery" component={RateDeliveryScreen} options={{ presentation: 'modal' }} />
    <Stack.Screen name="Support"      component={SupportScreen}      />
    <Stack.Screen name="SubmitTicket" component={SubmitTicketScreen} />
    <Stack.Screen name="MyTickets"    component={MyTicketsScreen}    />
    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
  </Stack.Navigator>
);

// ── WalletStack — FIXED: all wallet-flow screens registered ─────────────────
const WalletStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* Main wallet dashboard */}
    <Stack.Screen name="WalletHome"    component={WalletScreen}       />

    {/* Wallet actions — previously missing, now registered */}
    <Stack.Screen name="WalletTopUp"   component={WalletTopUpScreen}  />
    <Stack.Screen name="Transfer"      component={TransferScreen}      />
    <Stack.Screen name="Withdraw"      component={WithdrawalScreen}    />

    {/* Other features reachable from wallet */}
    <Stack.Screen name="DuoPay"        component={DuoPayScreen}        />
    <Stack.Screen name="Support"       component={SupportScreen}       />
    <Stack.Screen name="SubmitTicket"  component={SubmitTicketScreen}  />
    <Stack.Screen name="MyTickets"     component={MyTicketsScreen}     />
    <Stack.Screen name="TicketDetail"  component={TicketDetailScreen}  />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}        />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}    />
    <Stack.Screen name="Notifications"  component={NotificationsScreen}  />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="Corporate"      component={CorporateScreen}      />
    <Stack.Screen name="DuoPay"         component={DuoPayScreen}         />
    <Stack.Screen name="Support"        component={SupportScreen}        />
    <Stack.Screen name="SubmitTicket"   component={SubmitTicketScreen}   />
    <Stack.Screen name="MyTickets"      component={MyTicketsScreen}      />
    <Stack.Screen name="TicketDetail"   component={TicketDetailScreen}   />
  </Stack.Navigator>
);

// ── Glass Tab Bar Background ─────────────────────────────────────────────────
const GlassTabBar = ({ mode }) => {
  const insets = useSafeAreaInsets();
  const darkMode = mode === 'dark';

  const style = {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkMode 
      ? 'rgba(4,4,4,0.94)' 
      : 'rgba(252,252,252,0.96)',
    paddingBottom: insets.bottom,   // helps on some devices
  };

  if (Platform.OS === 'ios') {
    return <BlurView intensity={darkMode ? 80 : 60} tint={darkMode ? 'dark' : 'light'} style={style} />;
  }
  return <View style={style} />;
};

// ── CUSTOMER NAVIGATOR ───────────────────────────────────────────────────────
const CustomerNavigator = () => {
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const darkMode = mode === 'dark';

  const TAB_CONTENT_H = 54;                    // icons + labels height
  const tabBarHeight = TAB_CONTENT_H + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarIcon: ({ focused, color }) => {
          const icons = {
            HomeTab:    focused ? 'home'   : 'home-outline',
            HistoryTab: focused ? 'time'   : 'time-outline',
            WalletTab:  focused ? 'wallet' : 'wallet-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
          return (
            <View style={focused
              ? [tb.iconActive, { backgroundColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)' }]
              : tb.icon
            }>
              <Ionicons name={icons[route.name]} size={focused ? 20 : 22} color={color} />
            </View>
          );
        },

        tabBarActiveTintColor:   theme.foreground,
        tabBarInactiveTintColor: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',

        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    '700',
          letterSpacing: 0.3,
          marginTop:     2,
        },

        // ── FIXED TAB BAR STYLE ─────────────────────────────────────
        tabBarStyle: {
          backgroundColor: 'transparent',     // important for glass effect
          borderTopColor:  darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderTopWidth:  StyleSheet.hairlineWidth,

          // Dynamic height including safe area bottom inset
          height:          tabBarHeight,

          // This is the most important fix for Android gesture navigation
          paddingBottom:   insets.bottom + 8,   // was +16 → too much in some cases

          paddingTop:      8,                   // reduced from 10
          paddingHorizontal: 10,                // optional: better spacing

          // Remove absolute positioning when using safe area properly
          position:        'relative',          // or just remove it
          bottom:          0,
          left:            0,
          right:           0,
          elevation:       0,

          // Extra safety for Android gesture navigation
          paddingBottom: Platform.OS === 'android' 
            ? insets.bottom + 12 
            : insets.bottom + 8,
        },

        tabBarBackground: () => <GlassTabBar mode={mode} />,
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

const tb = StyleSheet.create({
  icon:       { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  iconActive: { width: 40, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});